/**
 * Runtime-neutral rules for prompt safety screening (Waffo content safety).
 * The network call lives in contentSafetyNode.ts; everything here is pure so
 * it can be unit-tested and shared with the logging mutation.
 */

/** off: never scan · monitor: scan and log, never block · enforce: block unless allowed. */
export type ContentSafetyMode = "off" | "monitor" | "enforce";
export type ScanSemanticMode = "off" | "shadow" | "enforce";
export type ScanLocale = "ja" | "en" | "zh";
export type ScanVerdictAction = "allow" | "review" | "block";

export type ScanVerdict = {
  action: ScanVerdictAction;
  reasonCode: string;
  matchedCategories: string[];
  requestId: string;
  semanticStatus?: string;
};

export type CombinedScanVerdict = {
  action: ScanVerdictAction;
  reasonCode: string;
  matchedCategories: string[];
  requestIds: string[];
  semanticStatus?: string;
};

/** Waffo accepts 1–10,000 characters per scan. */
export const MAX_SCAN_PROMPT_CHARS = 10_000;

/** Secure default: anything other than an explicit off/monitor enforces. */
export function resolveContentSafetyMode(raw: string | undefined): ContentSafetyMode {
  const value = raw?.trim().toLowerCase();
  if (value === "off" || value === "monitor") return value;
  return "enforce";
}

/** Omitted unless explicitly configured, so Waffo applies its service default. */
export function resolveSemanticMode(raw: string | undefined): ScanSemanticMode | undefined {
  const value = raw?.trim().toLowerCase();
  return value === "off" || value === "shadow" || value === "enforce" ? value : undefined;
}

/** Kana means Japanese; other CJK ideographs mean Chinese; everything else English. */
export function detectScanLocale(text: string): ScanLocale {
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return "ja";
  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)) return "zh";
  return "en";
}

/**
 * Split a prompt into scan-sized chunks on line boundaries so that every
 * character that reaches the model is screened. Over-long lines are hard-split.
 */
export function chunkPromptForScan(text: string, maxChars = MAX_SCAN_PROMPT_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const line of trimmed.split("\n")) {
    if (line.length > maxChars) {
      flush();
      for (let start = 0; start < line.length; start += maxChars) {
        const piece = line.slice(start, start + maxChars).trim();
        if (piece) chunks.push(piece);
      }
      continue;
    }
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars) {
      flush();
      current = line;
    } else {
      current = next;
    }
  }
  flush();
  return chunks;
}

const severity: Record<ScanVerdictAction, number> = { allow: 0, review: 1, block: 2 };

/** The most severe chunk verdict decides; categories and request IDs are merged. */
export function combineScanVerdicts(verdicts: readonly ScanVerdict[]): CombinedScanVerdict {
  if (verdicts.length === 0) {
    return { action: "allow", reasonCode: "allowed", matchedCategories: [], requestIds: [] };
  }
  const worst = verdicts.reduce((current, candidate) =>
    severity[candidate.action] > severity[current.action] ? candidate : current
  );
  return {
    action: worst.action,
    reasonCode: worst.reasonCode,
    matchedCategories: [...new Set(verdicts.flatMap((verdict) => verdict.matchedCategories))],
    requestIds: verdicts.map((verdict) => verdict.requestId).filter(Boolean),
    semanticStatus: worst.semanticStatus,
  };
}

/** A verdict that stands in for "could not be screened" (fail closed). */
export function degradedVerdict(reasonCode = "service_degraded"): ScanVerdict {
  return { action: "review", reasonCode, matchedCategories: [], requestId: "" };
}

export const CONTENT_SAFETY_ERROR_PREFIX = "Content safety:";

/** Single-line, user-facing reason; callers keep only the first line of errors. */
export function contentSafetyRejectionMessage(verdict: CombinedScanVerdict): string {
  const reference = verdict.requestIds[0] ? ` Reference: ${verdict.requestIds[0]}.` : "";
  if (verdict.action === "block") {
    return `${CONTENT_SAFETY_ERROR_PREFIX} this request was not generated because it may conflict with our AI Acceptable Use Policy (neotypelab.com/acceptable-use). Please revise your description and try again. To appeal, email hello@neotypelab.com.${reference}`;
  }
  if (verdict.reasonCode === "review_required") {
    return `${CONTENT_SAFETY_ERROR_PREFIX} this request needs an additional safety review and was not generated. Please try again later or revise your description.${reference}`;
  }
  return `${CONTENT_SAFETY_ERROR_PREFIX} our safety check is temporarily unavailable, so this request was not generated. Please try again in a few minutes.${reference}`;
}
