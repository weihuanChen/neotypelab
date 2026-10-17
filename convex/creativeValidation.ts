import { ZodError, type ZodIssue } from "zod";
import { ConvexError } from "convex/values";

function issuesIn(error: ZodError): ZodIssue[] {
  return error.issues.flatMap(issue => issue.code === "invalid_union"
    ? issue.unionErrors.flatMap(issuesIn)
    : [issue]);
}

/** Describe schema failures without including provider values, source quotes or prompts. */
export function creativeValidationMessage(error: unknown, stage: string) {
  if (!(error instanceof ZodError)) return error instanceof Error ? error.message : `${stage} failed`;
  const issues = issuesIn(error).slice(0, 8).map(issue => {
    const path = issue.path.length ? issue.path.join(".") : "output";
    const detail = issue.code === "invalid_type" ? `expected ${issue.expected}, received ${issue.received}`
      : issue.code === "invalid_literal" ? `expected ${String(issue.expected)}`
        : issue.code === "invalid_enum_value" ? "invalid enum value"
          : issue.code === "unrecognized_keys" ? "unexpected fields"
            : issue.code === "custom" ? issue.message : issue.code;
    return `${path}: ${detail}`;
  });
  return `${stage} output failed validation (${issues.join("; ")})`.slice(0, 500);
}

export function validateCreativeValue<T>(stage: string, validate: () => T): T {
  try { return validate(); }
  catch (error) { throw new Error(creativeValidationMessage(error, stage)); }
}

/** Only output validation failures permit a palette correction, never provider or database failures. */
export function validatePaletteValue<T>(validate: () => T): T {
  try { return validate(); }
  catch (error) { throw new ConvexError({ code: "PALETTE_VALIDATION_FAILED", message: creativeValidationMessage(error, "Palette") }); }
}

export function paletteValidationFeedback(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (!data || typeof data !== "object" || !("code" in data) || data.code !== "PALETTE_VALIDATION_FAILED" || !("message" in data) || typeof data.message !== "string") return null;
  return data.message.slice(0, 500);
}
