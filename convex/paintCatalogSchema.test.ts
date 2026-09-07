// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("paint catalog schema migration", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("keeps legacy paint mapping records valid", async () => {
    const paint = await t.run(async (ctx) => {
      const paintMappingId = await ctx.db.insert("paintMappings", {
        mappingKey: "mr-color-dark-yellow",
        brand: "Mr. Color",
        line: "Lacquer",
        code: "C39",
        colorName: "Dark Yellow",
        finishType: "matte",
        paintType: "lacquer",
        hexPreview: "#A38A45",
        isActive: true,
        searchText: "Mr. Color Lacquer C39 Dark Yellow matte",
      });
      return await ctx.db.get(paintMappingId);
    });

    expect(paint).toMatchObject({
      mappingKey: "mr-color-dark-yellow",
      code: "C39",
      colorName: "Dark Yellow",
    });
    expect(paint?.externalKey).toBeUndefined();
  });

  it("stores normalized product identity and a preferred color measurement", async () => {
    const result = await t.run(async (ctx) => {
      const now = Date.now();
      const brandId = await ctx.db.insert("paintBrands", {
        name: "GSI Creos",
        slug: "gsi-creos",
        aliases: ["Mr. Hobby"],
        isActive: true,
        searchText: "GSI Creos Mr. Hobby",
        createdAt: now,
        updatedAt: now,
      });
      const paintLineId = await ctx.db.insert("paintLines", {
        brandId,
        name: "Mr. Color",
        slug: "mr-color",
        aliases: [],
        defaultPaintType: "lacquer",
        isActive: true,
        searchText: "GSI Creos Mr. Color lacquer",
        createdAt: now,
        updatedAt: now,
      });
      const paintMappingId = await ctx.db.insert("paintMappings", {
        externalKey: "gsi-creos:mr-color:c5",
        brandId,
        paintLineId,
        series: "C",
        normalizedCode: "C5",
        name: "Blue",
        sheen: "gloss",
        opacity: "opaque",
        effects: [],
        dataVersion: 1,
        mappingKey: "gsi-creos-mr-color-c5",
        brand: "GSI Creos",
        line: "Mr. Color",
        code: "C5",
        colorName: "Blue",
        finishType: "gloss",
        paintType: "lacquer",
        hexPreview: "#0054A7",
        isActive: true,
        searchText: "GSI Creos Mr. Color C C5 Blue gloss lacquer",
      });
      const measurementId = await ctx.db.insert("paintColorMeasurements", {
        measurementKey: "gsi-creos:mr-color:c5:photoshoplus-digital",
        paintMappingId,
        hex: "#0054A7",
        rgb: { r: 0, g: 84, b: 167 },
        rgbColorSpace: "srgb",
        lab: {
          l: 36.232017735391295,
          a: 12.022521981033595,
          b: -50.4830071392556,
        },
        labIlluminant: "D65",
        labObserver: "2deg",
        labMethod: "derived_from_srgb",
        conversionVersion: "srgb-d65-cielab-v1",
        accuracy: "approximate",
        sourceAuthority: "third_party",
        sourceType: "digital_color_chart",
        sourceName: "Photoshoplus digital color chart",
        sourceUrl: "https://www.photoshoplus.fr/couleurs/couleurs-mr-hobby/",
        substrate: "digital",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(paintMappingId, {
        preferredMeasurementId: measurementId,
      });

      const [brand, paintLine, paint, measurement] = await Promise.all([
        ctx.db.get(brandId),
        ctx.db.get(paintLineId),
        ctx.db.get(paintMappingId),
        ctx.db.get(measurementId),
      ]);
      return { brand, paintLine, paint, measurement };
    });

    expect(result.brand?.name).toBe("GSI Creos");
    expect(result.paintLine).toMatchObject({
      brandId: result.brand?._id,
      name: "Mr. Color",
    });
    expect(result.paint).toMatchObject({
      externalKey: "gsi-creos:mr-color:c5",
      preferredMeasurementId: result.measurement?._id,
    });
    expect(result.measurement).toMatchObject({
      hex: "#0054A7",
      labMethod: "derived_from_srgb",
      conversionVersion: "srgb-d65-cielab-v1",
    });
  });
});
