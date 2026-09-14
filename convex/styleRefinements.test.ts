import { describe, expect, it } from "vitest";
import { readStyleIntent, resolveStyleRefinements } from "./styleRefinements";
import { styleIntentSchema } from "./creativeContracts";
const materials = [
  { _id: "matte", slug: "military", finishType: "matte" },
  { _id: "satin", slug: "clean", finishType: "satin" },
];
const intent = styleIntentSchema.parse({
  version: "style-intent.v1", source: "private", styleType: "custom", name: "Desert",
  palette: { primary: "sand" }, surfaceLogic: "rough", graphicLanguage: "military",
  contrast: "low", markingDensity: "low", materialIntent: ["armor"], mood: "field fatigue",
  weathering: "heavy", finish: "matte", paintability: "high",
});
describe("Auto refinements", () => {
  it("derives finish, weathering and mood from the style instead of fixed clean defaults", () => {
    expect(resolveStyleRefinements(intent, materials)).toMatchObject({ material: materials[0], weathering: "heavy", mood: "field fatigue" });
  });
  it("uses curated legacy recommendations and handles an empty material catalog", () => {
    expect(resolveStyleRefinements(null, materials, ["military"]).material?._id).toBe("matte");
    expect(resolveStyleRefinements(intent, []).material).toBeNull();
    expect(readStyleIntent("invalid")).toBeNull();
  });
  it("matches semi-gloss with satin when exact finish is unavailable", () => {
    expect(resolveStyleRefinements({ ...intent, finish: "semi-gloss" }, materials).material?._id).toBe("satin");
  });
});
