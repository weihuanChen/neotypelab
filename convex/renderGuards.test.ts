/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { styleIntentSchema } from "./creativeContracts";
import {
  patternGuardLine,
  patternNegativeTerms,
  renderWeatheringLevel,
  sceneGuardLine,
  sceneNegativeTerms,
  scrubWearText,
  styleIntentForRender,
} from "./renderGuards";
import schema from "./schema";
import { additionalStylePresets, revisedSeedPresetFragments } from "./stylePresetSeeds";

const modules = import.meta.glob("./**/*.ts");

const legacyExcavatorIntent = styleIntentSchema.parse({
  version: "style-intent.v1",
  source: "official",
  styleType: "preset",
  name: "Excavator Yellow",
  palette: { primary: "Construction yellow #F2B705" },
  surfaceLogic:
    "Semi-gloss equipment enamel; hydraulic-style joints and pistons in polished steel; mud and dust concentrated below the knees, oil around joints.",
  graphicLanguage: "Black/yellow chevrons on feet.",
  contrast: "high",
  markingDensity: "medium",
  materialIntent: ["semi-gloss painted armor", "hydraulic steel frame"],
  mood: "Rugged, heavy-duty, worksite-proven",
  weathering: "heavy",
  finish: "semi-gloss",
  paintability: "high",
});

describe("render scene guards", () => {
  it("excludes mud and scenery at every weathering level", () => {
    for (const level of ["clean", "light", "heavy"] as const) {
      const terms = sceneNegativeTerms(level);
      expect(terms).toContain("mud");
      expect(terms).toContain("terrain");
      expect(terms).toContain("construction site");
    }
    expect(sceneNegativeTerms("clean")).toContain("chipping");
    expect(sceneNegativeTerms("heavy")).not.toContain("chipping");
  });

  it("tells the model that style names are hues, not scenes", () => {
    const line = sceneGuardLine("clean");
    expect(line).toContain("Excavator Yellow");
    expect(line).toContain("never add a scene");
    expect(line).toContain("CLEAN");
  });

  it("strips mud from a frozen intent and aligns the weathering level", () => {
    const clean = styleIntentForRender(legacyExcavatorIntent, "clean");
    expect(clean.weathering).toBe("clean");
    expect(clean.surfaceLogic).not.toMatch(/mud|dust|oil/);
    expect(clean.surfaceLogic).toContain("polished steel");
    expect(clean.mood).toBe("Rugged, heavy-duty, worksite-proven");

    const heavy = styleIntentForRender(legacyExcavatorIntent, "heavy");
    expect(heavy.weathering).toBe("heavy");
    expect(heavy.surfaceLogic).not.toMatch(/mud/);
  });

  it("scrubs repaint notes and keeps weathering previews worn", () => {
    expect(scrubWearText("Mud gradient on the shins. Grease on the joints.", "light")).toBe("Grease on the joints.");
    expect(scrubWearText("Edge chipping on feet.", "clean")).toBe("");
    expect(renderWeatheringLevel("clean", true)).toBe("heavy");
    expect(renderWeatheringLevel("clean", false)).toBe("clean");
  });
});

const jungleIntent = styleIntentSchema.parse({
  version: "style-intent.v2",
  source: "private",
  styleType: "custom",
  name: "Jungle Camo Ranger",
  palette: { primary: "olive drab", secondary: "khaki", accent: "signal orange" },
  surfaceLogic: "Olive drab main armor with khaki limbs. Leaf camouflage pattern across the shield.",
  graphicLanguage: "Disruptive foliage stripes; small stencilled unit numbers.",
  contrast: "medium",
  markingDensity: "low",
  materialIntent: ["matte painted armor", "camouflage print panels"],
  mood: "Stealthy, jungle-ready, camouflaged",
  weathering: "clean",
  finish: "matte",
  paintability: "high",
  colors: [
    { role: "primary", name: "olive drab", hex: "#5B6237", coverage: 45 },
    { role: "secondary", name: "khaki", hex: "#A79B6B", coverage: 25 },
    { role: "frame", name: "dark earth", hex: "#3B3226", coverage: 20 },
    { role: "accent", name: "signal orange", hex: "#C8662B", coverage: 10 },
  ],
  pattern: "none",
});

describe("render pattern guards", () => {
  it("turns theme words into solid colors when the intent decided no pattern", () => {
    const render = styleIntentForRender(jungleIntent, "clean");
    const text = JSON.stringify({ ...render, colors: undefined });
    expect(text).not.toMatch(/camo|camouflage|leaf|foliage|stripe|print/i);
    expect(render.name).toBe("Jungle Ranger");
    expect(render.surfaceLogic).toContain("Olive drab main armor");
    expect(render.graphicLanguage).toBe("small stencilled unit numbers.");
    expect(render.materialIntent).toEqual(["matte painted armor"]);
    expect(render.colors).toEqual(jungleIntent.colors);
    expect(patternGuardLine(jungleIntent)).toContain("one solid color");
    expect(patternNegativeTerms(jungleIntent)).toContain("camouflage pattern");
  });

  it("keeps requested patterns and legacy livery graphics", () => {
    const requested = { ...jungleIntent, pattern: "camouflage" as const };
    expect(styleIntentForRender(requested, "clean").graphicLanguage).toContain("stripes");
    expect(patternGuardLine(requested)).toBe("");
    expect(patternNegativeTerms(legacyExcavatorIntent)).toEqual([]);
    expect(styleIntentForRender(legacyExcavatorIntent, "clean").graphicLanguage).toBe("Black/yellow chevrons on feet.");
  });
});

describe("revised seed presets", () => {
  it("no official preset asks for mud", () => {
    for (const preset of additionalStylePresets) {
      expect(preset.systemPromptFragment).not.toMatch(/\bmud\b|\bdirt\b/i);
      expect(preset.styleSpec.renderBehavior).not.toMatch(/\bmud\b/i);
      expect(JSON.parse(preset.styleIntentJson).surfaceLogic).not.toMatch(/\bmud\b/i);
    }
  });

  it("rewrites only rows that still carry the previous seed fragment", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.seedMissingStylePresets, {});
    await t.run(async (ctx) => {
      const row = await ctx.db.query("stylePresets").withIndex("by_slug", (q) => q.eq("slug", "excavator-yellow")).first();
      await ctx.db.patch(row!._id, {
        systemPromptFragment: revisedSeedPresetFragments["excavator-yellow"],
        weatheringProfile: "heavy",
      });
    });
    const first = await t.mutation(internal.init.refreshRevisedSeedPresets, {});
    expect(first).toEqual([{ slug: "excavator-yellow", status: "updated" }]);
    const row = await t.run((ctx) =>
      ctx.db.query("stylePresets").withIndex("by_slug", (q) => q.eq("slug", "excavator-yellow")).first()
    );
    expect(row?.weatheringProfile).toBe("light");
    expect(row?.styleSpec?.renderBehavior).not.toMatch(/mud/);
    const again = await t.mutation(internal.init.refreshRevisedSeedPresets, {});
    expect(again).toEqual([{ slug: "excavator-yellow", status: "skipped" }]);
  });
});
