import { describe, expect, it } from "vitest";
import { buildModelPromptContext, normalizeModelGeometryAnchors, normalizeModelGeometryText } from "./modelPromptContext";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./types";

describe("Model DNA geometry boundary", () => {
  it("normalizes only the known color-bearing identity phrase", () => {
    const original = ["single horn", "green chest accents", "narrow waist", "Red Frame unit name", "green chest accent lights"];
    expect(normalizeModelGeometryAnchors(original)).toEqual(["single horn", "chest accent panel geometry", "narrow waist", "Red Frame unit name", "green chest accent lights"]);
    expect(original[1]).toBe("green chest accents");
    expect(normalizeModelGeometryText("Keep GREEN CHEST ACCENTS and shoulder pylons.")).toBe("Keep chest accent panel geometry and shoulder pylons.");
  });

  it("sanitizes prompt and snapshot for old stored EVA catalog records without mutation", async () => {
    const model = { _id: "model", name: "EVA Unit", slug: "eva-kit", baseUnitId: "unit", aliases: [], tags: [], promptAnchor: "Preserve green chest accents and shoulder pylons." } as unknown as Doc<"baseModels">;
    const unit = { _id: "unit", name: "EVA Unit", slug: "eva-unit", ipSeriesId: "series", aliases: [], keyShapeAnchors: ["single horn", "green chest accents", "narrow waist"], nativeEquipment: ["rifle"], forbiddenChanges: ["no extra limbs"], promptAnchor: "Preserve green chest accents." } as unknown as Doc<"baseUnits">;
    const series = { _id: "series", name: "Series", slug: "series", visualDNA: "Distinct green chest accents.", promptAnchor: "Preserve green chest accents." } as unknown as Doc<"ipSeries">;
    const ctx = { db: { get: async (id: string) => id === "unit" ? unit : series } } as unknown as QueryCtx;
    const result = await buildModelPromptContext(ctx, model);
    expect(result.promptText).not.toContain("green chest accents");
    expect(JSON.stringify(result.snapshot)).not.toContain("green chest accents");
    expect(result.snapshot.baseUnit?.keyShapeAnchors).toEqual(["single horn", "chest accent panel geometry", "narrow waist"]);
    expect(unit.keyShapeAnchors[1]).toBe("green chest accents");
    expect(model.promptAnchor).toContain("green chest accents");
    expect(result.snapshot.name).toBe(model.name);
    expect(result.snapshot.baseUnit?.nativeEquipment).toEqual(["rifle"]);
  });
});
