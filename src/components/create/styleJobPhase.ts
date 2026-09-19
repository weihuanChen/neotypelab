import type { InterpretationResult } from "@/convex/styleInterpretations";
import type { StyleJobPhase } from "@/src/components/job-wait";

export function resolveStyleJobPhase({
  acceptedExisting,
  adjusting,
  busy,
  error,
  hasDirectionMatch,
  hasSavedStyle,
  interpretation,
  savedCompositionId,
}: {
  acceptedExisting: boolean;
  adjusting: boolean;
  busy: boolean;
  error: string;
  hasDirectionMatch: boolean;
  hasSavedStyle: boolean;
  interpretation: InterpretationResult | null;
  savedCompositionId: string | null;
}): StyleJobPhase {
  if (busy && !interpretation) return "forming";
  if (error && !interpretation) return "interrupted";
  if (interpretation && !adjusting && (savedCompositionId === interpretation.promptCompositionId || hasSavedStyle)) {
    return "stored";
  }
  if (interpretation && !adjusting) return "review";
  if (hasDirectionMatch && !acceptedExisting && !adjusting && !busy) return "existing";
  return "input";
}
