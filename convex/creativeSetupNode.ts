"use node";

import { internalAction } from "./_generated/server";

export const inspectModels = internalAction({
  args: {},
  handler: async () => {
    const key = process.env.GEMINI_API_KEY_OFFCIAL;
    if (!key) throw new Error("GEMINI_API_KEY_OFFCIAL is not configured in this Convex deployment");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
      headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Gemini model discovery failed: HTTP ${response.status}`);
    const payload = await response.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    return {
      imageKeyConfigured: Boolean(process.env.OPEMAI_IMAGE_FOR_LLM_RELAY),
      textModels: (payload.models ?? []).filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
        .map((model) => model.name.replace(/^models\//, "")),
    };
  },
});

export const probeTextProtocol = internalAction({
  args: {},
  handler: async () => {
    const key = process.env.GEMINI_API_KEY_OFFCIAL;
    if (!key) throw new Error("Gemini key is missing");
    const checks = [];
    for (const model of ["gemini-2.5-flash", "gemini-3.5-flash"]) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Return JSON: {\"ok\":true}" }], response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(45000),
      });
      const payload = await response.json() as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };
      checks.push({ model, status: response.status, error: payload.error?.message?.replaceAll(key, "[redacted]"), content: payload.choices?.[0]?.message?.content });
      if (response.ok) break;
    }
    return checks;
  },
});
