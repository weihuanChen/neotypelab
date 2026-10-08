import { describe, expect, it } from "vitest";
import {
  CONTENT_SAFETY_ERROR_PREFIX,
  chunkPromptForScan,
  combineScanVerdicts,
  contentSafetyRejectionMessage,
  degradedVerdict,
  detectScanLocale,
  resolveContentSafetyMode,
  resolveSemanticMode,
} from "./contentSafetyPolicy";

describe("content safety policy", () => {
  it("enforces unless explicitly turned off or set to monitor", () => {
    expect(resolveContentSafetyMode(undefined)).toBe("enforce");
    expect(resolveContentSafetyMode("")).toBe("enforce");
    expect(resolveContentSafetyMode("typo")).toBe("enforce");
    expect(resolveContentSafetyMode(" Monitor ")).toBe("monitor");
    expect(resolveContentSafetyMode("off")).toBe("off");
  });

  it("only passes a known semantic mode", () => {
    expect(resolveSemanticMode("shadow")).toBe("shadow");
    expect(resolveSemanticMode("nope")).toBeUndefined();
    expect(resolveSemanticMode(undefined)).toBeUndefined();
  });

  it("detects the scan locale from the script used", () => {
    expect(detectScanLocale("Crimson armor with gold trim")).toBe("en");
    expect(detectScanLocale("红色装甲，金色点缀")).toBe("zh");
    expect(detectScanLocale("赤いアーマーと金色のライン")).toBe("ja");
  });

  it("covers every character when chunking long prompts", () => {
    expect(chunkPromptForScan("   ")).toEqual([]);
    expect(chunkPromptForScan(" short ")).toEqual(["short"]);
    const lines = Array.from({ length: 30 }, (_, index) => `line ${index} ${"x".repeat(40)}`);
    const chunks = chunkPromptForScan(lines.join("\n"), 200);
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true);
    expect(chunks.join("\n")).toBe(lines.join("\n"));
    const hardSplit = chunkPromptForScan("y".repeat(450), 200);
    expect(hardSplit.map((chunk) => chunk.length)).toEqual([200, 200, 50]);
  });

  it("lets the most severe chunk decide", () => {
    expect(combineScanVerdicts([]).action).toBe("allow");
    const combined = combineScanVerdicts([
      { action: "allow", reasonCode: "allowed", matchedCategories: [], requestId: "a" },
      { action: "block", reasonCode: "restricted_content", matchedCategories: ["violence"], requestId: "b" },
      { action: "review", reasonCode: "review_required", matchedCategories: ["violence", "hate"], requestId: "c" },
    ]);
    expect(combined.action).toBe("block");
    expect(combined.reasonCode).toBe("restricted_content");
    expect(combined.matchedCategories).toEqual(["violence", "hate"]);
    expect(combined.requestIds).toEqual(["a", "b", "c"]);
  });

  it("fails closed and explains the outcome on one line", () => {
    expect(degradedVerdict().action).toBe("review");
    for (const verdict of [
      { action: "block" as const, reasonCode: "restricted_content" },
      { action: "review" as const, reasonCode: "review_required" },
      { action: "review" as const, reasonCode: "service_degraded" },
    ]) {
      const message = contentSafetyRejectionMessage({ ...verdict, matchedCategories: [], requestIds: ["req_1"] });
      expect(message.startsWith(CONTENT_SAFETY_ERROR_PREFIX)).toBe(true);
      expect(message).toContain("req_1");
      expect(message).not.toContain("\n");
      expect(message.length).toBeLessThanOrEqual(500);
    }
  });
});
