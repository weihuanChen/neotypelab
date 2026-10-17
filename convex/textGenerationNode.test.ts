import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionCtx } from "./_generated/server";
import { executeTextRequest } from "./textGenerationNode";
import { requestTextCompletion } from "./llmProtocol";
import { screenPromptBeforeGeneration } from "./contentSafetyNode";

vi.mock("./llmProtocol", () => ({ requestTextCompletion: vi.fn() }));
vi.mock("./contentSafetyNode", () => ({ screenPromptBeforeGeneration: vi.fn() }));

function context() {
  return { runQuery: vi.fn().mockResolvedValue({
    route: { primary: { profile: { _id: "profile", modelId: "fixture", timeoutMs: 90000 } } },
    policy: { fallbackBehavior: "fail-job", maxRetryCount: 0, timeoutMs: 90000 },
  }) } as unknown as ActionCtx;
}

beforeEach(() => {
  vi.mocked(requestTextCompletion).mockReset();
  vi.mocked(screenPromptBeforeGeneration).mockReset();
});

describe("bounded palette provider requests", () => {
  it("screens the correction and caps its timeout to the same deadline without sending internal controls", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    vi.mocked(requestTextCompletion).mockResolvedValue({ json: {}, text: "{}", model: "fixture", providerRequestId: null, usage: null });
    const ctx = context();
    const args = { templateKind: "palette-plan" as const, systemPrompt: "Palette rules", userPrompt: "Original palette", deadlineMs: 6000 };
    await executeTextRequest(ctx, args);
    await executeTextRequest(ctx, { ...args, userPrompt: "Palette correction with validation feedback" });
    expect(screenPromptBeforeGeneration).toHaveBeenCalledTimes(2);
    expect(vi.mocked(screenPromptBeforeGeneration).mock.calls[1][1].prompt).toContain("Palette correction");
    expect(vi.mocked(screenPromptBeforeGeneration).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(requestTextCompletion).mock.invocationCallOrder[1]);
    for (const [input] of vi.mocked(requestTextCompletion).mock.calls) {
      expect(input.profile.timeoutMs).toBe(5000);
      expect(input).not.toHaveProperty("deadlineMs");
      expect(input).not.toHaveProperty("safetyReference");
    }
  });

  it("does not call the provider after the deadline or when correction screening fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const args = { templateKind: "palette-plan" as const, systemPrompt: "Palette rules", userPrompt: "Correction", deadlineMs: 999 };
    await expect(executeTextRequest(context(), args)).rejects.toThrow(/Text generation failed/);
    expect(requestTextCompletion).not.toHaveBeenCalled();
    vi.mocked(screenPromptBeforeGeneration).mockRejectedValueOnce(new Error("Content safety screening blocked"));
    await expect(executeTextRequest(context(), { ...args, deadlineMs: 6000 })).rejects.toThrow(/screening blocked/);
    expect(requestTextCompletion).not.toHaveBeenCalled();
  });
});
