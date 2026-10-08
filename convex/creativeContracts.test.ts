import { describe, expect, it } from "vitest";
import { styleIntentSchema, creativeInputKey, stylePlanningRules } from "./creativeContracts";

const v1Intent = {
  version: "style-intent.v1", source: "private", styleType: "custom", name: "Cyan Performance",
  palette: { primary: "cyan teal", secondary: "charcoal", accent: "magenta" },
  surfaceLogic: "clean semi-gloss", graphicLanguage: "racing livery", contrast: "high",
  markingDensity: "medium", materialIntent: ["painted armor", "dark mechanical frame"],
  mood: "energetic futuristic", weathering: "clean", finish: "semi-gloss", paintability: "high",
};

const jungleColors = [
  { role: "primary", name: "olive drab", hex: "#5B6237", coverage: 45 },
  { role: "secondary", name: "khaki", hex: "#A79B6B", coverage: 25 },
  { role: "frame", name: "dark earth", hex: "#3B3226", coverage: 20 },
  { role: "accent", name: "signal orange", hex: "#C8662B", coverage: 10 },
];

describe("StyleIntent v1", () => {
  it("accepts a structured custom style", () => {
    const result = styleIntentSchema.safeParse(v1Intent);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Fixture is invalid");
    const intent = result.data;
    const key = creativeInputKey({ styleIntentJson: JSON.stringify(intent) });
    expect(creativeInputKey({ styleIntentJson: JSON.stringify(intent, null, 2) })).toBe(key);
    expect(creativeInputKey({ styleIntentJson: JSON.stringify({ ...intent, palette: { primary: "red" } }) })).not.toBe(key);
  });
});

describe("StyleIntent v2", () => {
  it("requires anchored colors and an explicit pattern decision", () => {
    expect(styleIntentSchema.safeParse({ ...v1Intent, version: "style-intent.v2" }).success).toBe(false);
    expect(styleIntentSchema.safeParse({ ...v1Intent, version: "style-intent.v2", colors: jungleColors }).success).toBe(false);
    const parsed = styleIntentSchema.parse({ ...v1Intent, version: "style-intent.v2", colors: jungleColors, pattern: "none" });
    expect(parsed.colors?.[0]).toEqual(jungleColors[0]);
    expect(JSON.stringify(styleIntentSchema.parse(JSON.parse(JSON.stringify(parsed))))).toBe(JSON.stringify(parsed));
  });

  it("rejects malformed color anchors", () => {
    const bad = (color: Record<string, unknown>) => styleIntentSchema.safeParse({
      ...v1Intent, version: "style-intent.v2", pattern: "none", colors: [color, ...jungleColors.slice(1)],
    }).success;
    expect(bad({ ...jungleColors[0], hex: "olive" })).toBe(false);
    expect(bad({ ...jungleColors[0], coverage: 0 })).toBe(false);
    expect(bad({ ...jungleColors[0], role: "pattern" })).toBe(false);
  });

  it("tells the palette planner to anchor HEX values and keep solid panels", () => {
    expect(stylePlanningRules).toContain("anchor palette");
    expect(stylePlanningRules).toContain("pattern is \"none\"");
  });
});
