import type { LlmApiFormat } from "./domain";

export type LlmRequestProfile = {
  apiFormat: LlmApiFormat;
  baseUrl: string;
  modelId: string;
  name: string;
  keyEnvName: string;
  headersJson?: string;
  requestDefaultsJson?: string;
  timeoutMs?: number;
};

export function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseObjectSetting(value: string | undefined, label: string) {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${label} must be valid JSON`); }
  const object = jsonObject(parsed);
  if (!object) throw new Error(`${label} must be a JSON object`);
  return object;
}

export function imageGenerationUrl(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return base.endsWith("/images/generations") ? base : `${base}/images/generations`;
}

export function imageDefaults(modelId: string, quality: string) {
  return {
    model: modelId,
    n: 1,
    size: "1024x1024",
    quality,
    // LLMRelay documents these five fields for gpt-image-2.
    ...(modelId === "gpt-image-2" ? {} : { output_format: "png", background: "opaque" }),
  };
}

export function imagesApiImage(payload: unknown) {
  const data = jsonObject(payload)?.data;
  const first = Array.isArray(data) ? jsonObject(data[0]) : null;
  if (!first || !(typeof first.b64_json === "string" && first.b64_json.trim()) &&
    !(typeof first.url === "string" && /^https?:\/\//.test(first.url))) {
    throw new Error("Images API returned no usable image payload");
  }
  return {
    b64_json: typeof first.b64_json === "string" ? first.b64_json : undefined,
    url: typeof first.url === "string" ? first.url : undefined,
    revised_prompt: typeof first.revised_prompt === "string" ? first.revised_prompt : undefined,
  };
}

export function completionUrl(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

export function completionText(payload: unknown) {
  const root = jsonObject(payload);
  const choices = root?.choices;
  const choice = Array.isArray(choices) ? jsonObject(choices[0]) : null;
  const message = jsonObject(choice?.message);
  if (message?.refusal) throw new Error("Model refused the generation request");
  if (choice?.finish_reason === "length") throw new Error("Model output was truncated");
  if (choice?.finish_reason === "content_filter") throw new Error("Model output was filtered");
  const content = message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content)
    ? content.map((part) => {
        const block = jsonObject(part);
        return block?.type === "text" && typeof block.text === "string" ? block.text : "";
      }).join("\n") : "";
  if (!text.trim()) throw new Error("Model returned no text output");
  return text;
}

export function structuredCompletion(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1");
  let value: unknown;
  try { value = JSON.parse(cleaned); } catch { throw new Error("Model returned invalid JSON"); }
  const result = jsonObject(value);
  if (!result) throw new Error("Model JSON output must be an object");
  return result;
}

export function chatImage(payload: unknown): { b64_json?: string; url?: string; revised_prompt?: string } {
  const root = jsonObject(payload);
  const choices = root?.choices;
  const choice = Array.isArray(choices) ? jsonObject(choices[0]) : null;
  const message = jsonObject(choice?.message);
  if (message?.refusal || choice?.finish_reason === "content_filter") {
    throw new Error("Model refused the image request");
  }
  if (choice?.finish_reason === "length") throw new Error("Model image output was truncated");
  const candidates: unknown[] = [
    ...(Array.isArray(message?.images) ? message.images : []),
    ...(Array.isArray(message?.content) ? message.content : []),
    message?.content,
  ];
  for (const candidate of candidates) {
    const block = jsonObject(candidate);
    const imageUrl = jsonObject(block?.image_url);
    const value = imageUrl?.url ?? block?.image_url ?? block?.url ?? block?.text ?? candidate;
    if (typeof value !== "string") continue;
    const raw = value.trim();
    const src = raw.match(/!\[[^\]]*\]\(([^\s)]+)\)/)?.[1] ?? raw;
    const data = src.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (data) return { b64_json: data[1] };
    if (/^https?:\/\/[^\s]+$/.test(src)) return { url: src };
  }
  throw new Error("Chat completion returned no usable image payload");
}

// Never include provider response bodies in errors: gateways may echo credentials or prompts.
export async function requestTextCompletion(input: {
  profile: LlmRequestProfile;
  systemPrompt: string;
  userPrompt: string;
  jsonOutput?: boolean;
  parameterOverridesJson?: string;
}, env: Record<string, string | undefined> = process.env) {
  const { profile } = input;
  const apiKey = env[profile.keyEnvName];
  if (!apiKey) throw new Error(`${profile.keyEnvName} is not configured`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  for (const [key, value] of Object.entries(parseObjectSetting(profile.headersJson, "Provider headers"))) {
    if (typeof value !== "string") throw new Error("Provider header values must be strings");
    headers[key] = value.replace(/\{\{apiKey\}\}/g, apiKey)
      .replace(/\{\{env:([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name: string) => env[name] ?? "");
  }
  headers.Authorization = `Bearer ${apiKey}`;
  const body = {
    ...parseObjectSetting(profile.requestDefaultsJson, "Provider defaults"),
    ...parseObjectSetting(input.parameterOverridesJson, "Binding overrides"),
    model: profile.modelId,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    stream: false,
    ...(input.jsonOutput ? { response_format: { type: "json_object" } } : {}),
  };
  const controller = new AbortController();
  const timeoutMs = profile.timeoutMs ?? 90000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(completionUrl(profile.baseUrl), {
      method: "POST", headers, body: JSON.stringify(body), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${profile.name} text generation failed: HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const text = completionText(payload);
    const root = jsonObject(payload);
    return {
      text,
      json: input.jsonOutput ? structuredCompletion(text) : null,
      model: typeof root?.model === "string" ? root.model : profile.modelId,
      providerRequestId: typeof root?.id === "string" ? root.id : null,
      usage: jsonObject(root?.usage),
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Text generation timed out after ${timeoutMs}ms`);
    throw error;
  } finally { clearTimeout(timer); }
}
