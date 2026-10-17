type CreationStage = "palette" | "specification" | "render";

const messages = {
  palette: "We couldn't match the palette to your color requirements. Try again or adjust your style description.",
  specification: "We couldn't finish the paint plan for this kit. Try again or review your style and kit settings.",
  render: "We couldn't finish the preview image. Please try again.",
  timeout: "Generation took too long to finish. Please try again.",
  canceled: "Preview generation was canceled. You can try again when you're ready.",
  conflict: "Some style requirements conflict. Review your style description and selected settings, then try again.",
  safety: "We couldn't generate this preview under our content policy. Please revise your description or reference.",
} as const;
const safeMessages = new Set<string>(Object.values(messages));

/** Map private diagnostics to fixed public copy; never echo a provider response or workflow stack. */
export function creationFailureMessage(reason: string | null | undefined, stage: CreationStage): string {
  if (reason && safeMessages.has(reason)) return reason;
  if (/content.?filter|content safety|content policy|safety.*block|policy.block/i.test(reason ?? "")) return messages.safety;
  if (/conflict/i.test(reason ?? "")) return messages.conflict;
  if (/timed?\s*out|timeout|deadline/i.test(reason ?? "")) return messages.timeout;
  if (/cancel(?:ed|led)/i.test(reason ?? "")) return messages.canceled;
  return messages[stage];
}
