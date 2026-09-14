import { describe, expect, it } from "vitest";
import { styleIntentSchema, creativeInputKey } from "./creativeContracts";

describe("StyleIntent v1", () => {
  it("accepts a structured custom style", () => {
    const result = styleIntentSchema.safeParse({
      version: "style-intent.v1", source: "private", styleType: "custom", name: "Cyan Performance",
      palette: { primary: "cyan teal", secondary: "charcoal", accent: "magenta" },
      surfaceLogic: "clean semi-gloss", graphicLanguage: "racing livery", contrast: "high",
      markingDensity: "medium", materialIntent: ["painted armor", "dark mechanical frame"],
      mood: "energetic futuristic", weathering: "clean", finish: "semi-gloss", paintability: "high",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Fixture is invalid");
    const intent = result.data;
    const key = creativeInputKey({ styleIntentJson: JSON.stringify(intent) });
    expect(creativeInputKey({ styleIntentJson: JSON.stringify(intent, null, 2) })).toBe(key);
    expect(creativeInputKey({ styleIntentJson: JSON.stringify({ ...intent, palette: { primary: "red" } }) })).not.toBe(key);
  });
});
