import { describe, expect, it } from "vitest";
import { normalizedUserIntentSchema } from "./creativeContracts";
import { creativeValidationMessage } from "./creativeValidation";

describe("creative validation diagnostics", () => {
  it("keeps useful nested field paths without exposing raw user values", () => {
    const parsed = normalizedUserIntentSchema.safeParse({
      version: "normalized-user-intent.v1", requirements: [{ id: "one", property: "colors", operation: "replace",
        scope: { kind: "exterior-armor", part: null }, colors: [{ name: "private source phrase", family: "blue", hex: null }],
        evidence: { inputRef: "notes", quote: "private source phrase" } }], unresolved: [],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Fixture should fail schema validation");
    const message = creativeValidationMessage(parsed.error, "Normalization");
    expect(message).toContain("requirements.0.scope.part: expected string, received null");
    expect(message).toContain("requirements.0.colors.0.hex: expected string, received null");
    expect(message).not.toContain("private source phrase");
    expect(message).not.toContain("ZodError");
  });
});
