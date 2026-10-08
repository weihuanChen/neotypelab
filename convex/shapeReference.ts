import type { LlmApiFormat } from "./domain";

// Kit full-body line art is attached to image renders as a geometry lock.
// It must never leak its drawing style or (absent) colors into the output.
export const SHAPE_REFERENCE_DIRECTIVE = [
  "SHAPE REFERENCE (attached image): the attached image is the official full-body line art of this exact kit.",
  "Treat it as the authoritative geometry reference: match its silhouette, proportions, armor volumes and thickness, panel break lines, head and antenna shape, chest block, shoulder armor shape and layering, skirt armor, knee guards, legs, feet, and backpack.",
  "Any emblem, insignia, symbol, or engraved mark drawn in the reference is molded kit design, not paint: keep its outline, size, and position, and never replace it with style, faction, or unit insignia; it may be tinted with the approved marking or accent colors. Place style decals only on panels that carry no such mark.",
  "Do not copy its drawing style: the output must be a fully painted, photographed physical scale model, never line art, a sketch, a monochrome drawing, or a flat illustration.",
  "The reference carries no color information; take every color only from the approved palette and repaint specification below.",
  "Pose, camera angle, and layout follow the render instructions; when they differ from the reference, keep the same part shapes as seen from the new angle.",
  "If the text and the reference disagree about shape, the reference wins; if they disagree about color, finish, decals, or weathering, the text wins.",
].join(" ");

export function supportsShapeReference(apiFormat: LlmApiFormat | undefined) {
  return apiFormat === "cloudflare-ai-run" || apiFormat === "openai-chat-completions";
}

export function withShapeReferenceDirective(prompt: string) {
  return `${SHAPE_REFERENCE_DIRECTIVE}\n\n${prompt}`;
}

const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function referenceContentType(header: string | null, url: string) {
  const declared = header?.split(";")[0]?.trim().toLowerCase();
  if (declared && (SUPPORTED_REFERENCE_TYPES as readonly string[]).includes(declared)) return declared;
  if (declared === "image/jpg") return "image/jpeg";
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return null;
}

export async function loadShapeReferenceDataUri(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20_000
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = referenceContentType(response.headers.get("content-type"), url);
    if (!contentType) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_REFERENCE_BYTES) return null;
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
