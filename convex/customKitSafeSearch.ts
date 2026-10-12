import { z } from "zod";
import type { kitSafetyCategories } from "./customKitContracts";

/** Google Cloud Vision SafeSearch: the first screening layer for Custom Kit references, before any model call. */
export const safeSearchEndpoint = "https://vision.googleapis.com/v1/images:annotate";
const likelihood = z.enum(["UNKNOWN", "VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY"]);
export type Likelihood = z.infer<typeof likelihood>;
const annotationSchema = z.object({ adult: likelihood, spoof: likelihood, medical: likelihood, violence: likelihood, racy: likelihood });
export type SafeSearchAnnotation = z.infer<typeof annotationSchema>;
const responseSchema = z.object({ responses: z.array(z.object({
  safeSearchAnnotation: annotationSchema.partial().optional(),
  error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
})).min(1) });

const rank: Record<Likelihood, number> = { UNKNOWN: -1, VERY_UNLIKELY: 0, UNLIKELY: 1, POSSIBLE: 2, LIKELY: 3, VERY_LIKELY: 4 };
const atLeast = (value: Likelihood, floor: Likelihood) => rank[value] >= rank[floor];

export function safeSearchRequestBody(base64Image: string) {
  return { requests: [{ image: { content: base64Image }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }] };
}

export function parseSafeSearchResponse(payload: unknown): SafeSearchAnnotation {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Image screening returned an unexpected response");
  const [first] = parsed.data.responses;
  if (first.error) throw new Error(`Image screening failed${first.error.code ? ` (${first.error.code})` : ""}`);
  const annotation = annotationSchema.safeParse(first.safeSearchAnnotation);
  if (!annotation.success) throw new Error("Image screening returned no result");
  return annotation.data;
}

/**
 * Thresholds keep mecha combat and non-explicit character figures usable: violence alone and racy alone
 * never block, because revealing commercial mecha-girl kits score racy LIKELY without being explicit.
 * Returns the blocking category, or null when the image may continue to the Gemini scan.
 */
export function safeSearchVerdict(annotation: SafeSearchAnnotation): Exclude<(typeof kitSafetyCategories)[number], "none"> | null {
  if (annotation.adult === "UNKNOWN" || annotation.racy === "UNKNOWN") throw new Error("Image screening was inconclusive. Try again");
  if (atLeast(annotation.adult, "LIKELY") || (annotation.adult === "POSSIBLE" && annotation.racy === "VERY_LIKELY")) return "adult-content";
  if (annotation.medical === "VERY_LIKELY" && atLeast(annotation.violence, "LIKELY")) return "graphic-injury";
  return null;
}

export function safeSearchMode(value = process.env.CUSTOM_KIT_SAFESEARCH_MODE): "enforce" | "monitor" {
  return value === "monitor" ? "monitor" : "enforce";
}
