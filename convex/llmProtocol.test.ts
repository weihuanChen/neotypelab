import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chatImage, completionText, completionUrl, imageDefaults, imageGenerationUrl,
  imagesApiImage, requestTextCompletion, structuredCompletion,
} from "./llmProtocol";

const profile = {
  name: "Gemini official", modelId: "configured-gemini-model",
  apiFormat: "openai-compatible" as const,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
  keyEnvName: "GEMINI_API_KEY_OFFCIAL",
};
const completion = (content: unknown, finish_reason = "stop") => ({
  id: "request-1", model: profile.modelId,
  choices: [{ message: { content }, finish_reason }], usage: { total_tokens: 12 },
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("LLM protocols", () => {
  it("uses LLMRelay's documented image endpoint and parameter subset", () => {
    const endpoint = "https://llmrelay.site/v1/images/generations";
    expect(imageGenerationUrl("https://llmrelay.site/v1/")).toBe(endpoint);
    expect(imageGenerationUrl(endpoint)).toBe(endpoint);
    expect(imageDefaults("gpt-image-2", "high")).toEqual({ model: "gpt-image-2", n: 1, size: "1024x1024", quality: "high" });
    expect(imageDefaults("gpt-image-1", "medium")).toMatchObject({ output_format: "png", background: "opaque" });
    expect(imagesApiImage({ data: [{ b64_json: "aW1hZ2U=" }] }).b64_json).toBe("aW1hZ2U=");
    expect(() => imagesApiImage({ data: [] })).toThrow(/no usable image/);
  });

  it("parses image blocks and markdown but does not accept ordinary prose as an image", () => {
    expect(chatImage(completion([{ type: "image_url", image_url: { url: "data:image/png;base64,aW1hZ2U=" } }])).b64_json).toBe("aW1hZ2U=");
    expect(chatImage({ choices: [{ message: { images: [{ image_url: { url: "https://cdn.example/image.png" } }] } }] }).url).toBe("https://cdn.example/image.png");
    expect(chatImage(completion("![image](https://cdn.example/image.png)")).url).toBe("https://cdn.example/image.png");
    expect(() => chatImage(completion("Here is your image."))).toThrow(/no usable image/);
  });

  it("rejects refusals, truncation, malformed JSON, and non-object JSON", () => {
    expect(() => completionText(completion('{"ok":', "length"))).toThrow(/truncated/);
    expect(() => completionText({ choices: [{ message: { refusal: "No" } }] })).toThrow(/refused/);
    expect(() => structuredCompletion("not json")).toThrow(/invalid JSON/);
    expect(() => structuredCompletion("[]")).toThrow(/must be an object/);
    expect(structuredCompletion('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it("executes Gemini official text with environment credentials and locked model/messages", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(completion('{"ok":true}'))));
    vi.stubGlobal("fetch", mockFetch);
    const result = await requestTextCompletion({
      profile: { ...profile, requestDefaultsJson: '{"temperature":0.2,"model":"wrong","stream":true}' },
      systemPrompt: "Return JSON", userPrompt: "Test", jsonOutput: true,
      parameterOverridesJson: '{"temperature":0.1,"messages":[]}',
    }, { GEMINI_API_KEY_OFFCIAL: "test-secret" });
    expect(mockFetch.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(completionUrl(mockFetch.mock.calls[0][0])).toBe(mockFetch.mock.calls[0][0]);
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers.Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(init.body)).toMatchObject({ model: profile.modelId, stream: false, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return JSON" }, { role: "user", content: "Test" }] });
    expect(result).toMatchObject({ json: { ok: true }, providerRequestId: "request-1", usage: { total_tokens: 12 } });
  });

  it("fails before a request without the key and redacts HTTP error bodies", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("echoed-secret", { status: 401 }));
    vi.stubGlobal("fetch", mockFetch);
    const input = { profile, systemPrompt: "test", userPrompt: "test" };
    await expect(requestTextCompletion(input, {})).rejects.toThrow(/GEMINI_API_KEY_OFFCIAL/);
    expect(mockFetch).not.toHaveBeenCalled();
    await expect(requestTextCompletion(input, { GEMINI_API_KEY_OFFCIAL: "test" })).rejects.toThrow("Gemini official text generation failed: HTTP 401");
  });

  it("aborts timed-out requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    const pending = requestTextCompletion({ profile: { ...profile, timeoutMs: 50 }, systemPrompt: "test", userPrompt: "test" }, { GEMINI_API_KEY_OFFCIAL: "test" });
    const assertion = expect(pending).rejects.toThrow(/timed out after 50ms/);
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
});
