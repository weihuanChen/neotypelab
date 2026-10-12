import { withShapeReferenceDirective } from "./shapeReference";

export const CLOUDFLARE_IMAGE_PROMPT_LIMIT = 32000;

/** Match the exact text sent by the image adapter, including its reference and negative suffix. */
export function finalImagePrompt(prompt: string, negativePrompt?: string | null, shapeReferenceApplied = false) {
  const referencePrompt = shapeReferenceApplied ? withShapeReferenceDirective(prompt) : prompt;
  return negativePrompt ? `${referencePrompt}\n\nAvoid: ${negativePrompt}` : referencePrompt;
}

export function assertImagePromptCapacity(prompt: string) {
  if (prompt.length > CLOUDFLARE_IMAGE_PROMPT_LIMIT) {
    throw new Error(`The approved render instructions require ${prompt.length} characters; this image route supports ${CLOUDFLARE_IMAGE_PROMPT_LIMIT}. Start a new preview with simpler refinements or render layout; an administrator may need to shorten the render template.`);
  }
}
