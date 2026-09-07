import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import {
  listResolvedPaintMappings,
  resolvePaintMapping,
} from "./paintCatalogCompatibility";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("paint catalog compatibility reads", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("resolves canonical relations and preferred measurement before legacy aliases", async () => {
    const resolved = await t.run(async (ctx) => {
      const now = Date.now();
      const brandId = await ctx.db.insert("paintBrands", {
        name: "GSI Creos",
        slug: "gsi-creos",
        aliases: [],
        isActive: true,
        searchText: "GSI Creos",
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
        searchText: "GSI Creos Mr. Color",
        createdAt: now,
        updatedAt: now,
      });
      const paintMappingId = await ctx.db.insert("paintMappings", {
        brandId,
        paintLineId,
        externalKey: "gsi-creos:mr-color:c5",
        normalizedCode: "C5",
        name: "Blue",
        sheen: "gloss",
        effects: [],
        mappingKey: "legacy-blue",
        brand: "Legacy Brand",
        line: "Legacy Line",
        code: "C5",
        colorName: "Legacy Blue",
        finishType: "legacy-finish",
        hexPreview: "#000000",
        isActive: true,
        searchText: "Blue",
      });
      const measurementId = await ctx.db.insert("paintColorMeasurements", {
        measurementKey: "gsi-creos:mr-color:c5:test",
        paintMappingId,
        hex: "#0054A7",
        rgb: { r: 0, g: 84, b: 167 },
        rgbColorSpace: "srgb",
        lab: { l: 36.232, a: 12.0225, b: -50.483 },
        labIlluminant: "D65",
        labObserver: "2deg",
        labMethod: "derived_from_srgb",
        conversionVersion: "srgb-d65-cielab-v1",
        accuracy: "approximate",
        sourceAuthority: "internal",
        sourceType: "manual_estimate",
        sourceName: "Test",
        substrate: "digital",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(paintMappingId, {
        preferredMeasurementId: measurementId,
      });
      return (await listResolvedPaintMappings(ctx))[0];
    });

    expect(resolved).toMatchObject({
      name: "Blue",
      brandName: "GSI Creos",
      paintLineName: "Mr. Color",
      brand: "GSI Creos",
      line: "Mr. Color",
      colorName: "Blue",
      sheen: "gloss",
      finishType: "gloss",
      hexPreview: "#0054A7",
      preferredMeasurement: {
        measurementKey: "gsi-creos:mr-color:c5:test",
      },
    });
  });

  it("keeps legacy-only records readable", async () => {
    const legacy = {
      _id: "legacy" as never,
      _creationTime: 1,
      mappingKey: "legacy-metal",
      brand: "Legacy",
      line: "Metal",
      code: "M1",
      colorName: "Old Metal",
      finishType: "metallic",
      paintType: "lacquer",
      hexPreview: "#777777",
      isActive: true,
      searchText: "Legacy Metal M1",
    };

    expect(resolvePaintMapping(legacy)).toMatchObject({
      name: "Old Metal",
      colorName: "Old Metal",
      brandName: "Legacy",
      paintLineName: "Metal",
      effects: ["metallic"],
      finishType: "metallic",
      hexPreview: "#777777",
      preferredMeasurement: null,
    });
  });
});
