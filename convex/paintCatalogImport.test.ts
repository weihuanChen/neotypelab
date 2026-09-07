import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { derivePaintColorFromHex } from "./paintColor";
import { buildPaintMeasurementKey } from "./paintCatalogDomain";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("paint catalog batch import", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("claims a matching legacy mapping and remains idempotent", async () => {
    const legacyId = await t.run((ctx) =>
      ctx.db.insert("paintMappings", {
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
      })
    );
    const record = importRecord();

    const first = await t.mutation(internal.paintCatalogImport.importBatch, {
      records: [record],
      dryRun: false,
    });
    const second = await t.mutation(internal.paintCatalogImport.importBatch, {
      records: [record],
      dryRun: false,
    });
    const state = await t.run(async (ctx) => ({
      mappings: await ctx.db.query("paintMappings").collect(),
      measurements: await ctx.db.query("paintColorMeasurements").collect(),
      brands: await ctx.db.query("paintBrands").collect(),
      lines: await ctx.db.query("paintLines").collect(),
    }));

    expect(first).toMatchObject({
      legacyMappingsClaimed: 1,
      paintMappingsCreated: 0,
      paintMappingsUpdated: 1,
      measurementsCreated: 1,
    });
    expect(second).toMatchObject({
      legacyMappingsClaimed: 0,
      paintMappingsCreated: 0,
      paintMappingsUpdated: 1,
      measurementsUpdated: 1,
    });
    expect(state.brands).toHaveLength(1);
    expect(state.lines).toHaveLength(1);
    expect(state.mappings).toHaveLength(1);
    expect(state.measurements).toHaveLength(1);
    expect(state.mappings[0]).toMatchObject({
      _id: legacyId,
      mappingKey: "mr-color-dark-yellow",
      externalKey: "gsi-creos:mr-color:c39",
      brand: "GSI Creos",
      line: "Mr. Color",
      normalizedCode: "C39",
      name: "Dark Yellow",
      sheen: "matte",
      effects: [],
      preferredMeasurementId: state.measurements[0]._id,
    });
  });

  it("previews without writing records", async () => {
    const preview = await t.mutation(internal.paintCatalogImport.importBatch, {
      records: [importRecord()],
      dryRun: true,
    });
    const counts = await t.run(async (ctx) => ({
      mappings: (await ctx.db.query("paintMappings").collect()).length,
      measurements: (await ctx.db.query("paintColorMeasurements").collect()).length,
    }));

    expect(preview).toMatchObject({
      dryRun: true,
      processed: 1,
      paintMappingsCreated: 1,
      measurementsCreated: 1,
    });
    expect(counts).toEqual({ mappings: 0, measurements: 0 });
  });

  it("imports product metadata without creating a measurement", async () => {
    const { measurementKey, hex, rgb, lab, accuracy, sourceAuthority, sourceType, sourceName, sourceUrl, substrate, ...productOnly } = importRecord();
    const record = { ...productOnly, isPreferred: false };

    const result = await t.mutation(internal.paintCatalogImport.importBatch, {
      records: [record],
      dryRun: false,
    });
    const state = await t.run(async (ctx) => ({
      mapping: await ctx.db.query("paintMappings").first(),
      measurements: await ctx.db.query("paintColorMeasurements").collect(),
    }));

    expect(result).toMatchObject({
      paintMappingsCreated: 1,
      measurementsCreated: 0,
    });
    expect(state.mapping).toMatchObject({
      externalKey: "gsi-creos:mr-color:c39",
      name: "Dark Yellow",
    });
    expect(state.mapping?.preferredMeasurementId).toBeUndefined();
    expect(state.measurements).toEqual([]);
  });

  it("backfills all known legacy seed paints without changing their IDs", async () => {
    const legacyIds = await t.run(async (ctx) => {
      const records = [
        {
          mappingKey: "gaia-notes-nazca-frost-matte-white",
          brand: "Gaia Notes",
          line: "Nazca",
          code: "N-001",
          colorName: "Frost Matte White",
          finishType: "matte",
          paintType: "lacquer",
          hexPreview: "#d9dde0",
        },
        {
          mappingKey: "gaia-notes-nazca-warning-orange",
          brand: "Gaia Notes",
          line: "Nazca",
          code: "N-014",
          colorName: "Warning Orange",
          finishType: "semi-gloss",
          paintType: "lacquer",
          hexPreview: "#d97523",
        },
        {
          mappingKey: "mr-color-super-iron",
          brand: "Mr. Color",
          line: "Super Metallic",
          code: "SM201",
          colorName: "Super Iron",
          finishType: "metallic",
          paintType: "lacquer",
          hexPreview: "#646b73",
        },
        {
          mappingKey: "tamiya-gun-metal-x10",
          brand: "Tamiya",
          line: "Acrylic",
          code: "X-10",
          colorName: "Gun Metal",
          finishType: "semi-gloss",
          paintType: "acrylic",
          hexPreview: "#5a6068",
        },
      ];
      return await Promise.all(
        records.map((record) =>
          ctx.db.insert("paintMappings", {
            ...record,
            isActive: true,
            searchText: Object.values(record).join(" "),
          })
        )
      );
    });

    const preview = await t.mutation(
      internal.paintCatalogImport.backfillLegacySeedPaints,
      { dryRun: true }
    );
    const result = await t.mutation(
      internal.paintCatalogImport.backfillLegacySeedPaints,
      { dryRun: false }
    );
    const state = await t.run(async (ctx) => ({
      mappings: await ctx.db.query("paintMappings").collect(),
      measurements: await ctx.db.query("paintColorMeasurements").collect(),
    }));

    expect(preview).toMatchObject({
      processed: 4,
      legacyMappingsClaimed: 4,
      paintMappingsUpdated: 4,
      measurementsCreated: 4,
    });
    expect(result).toMatchObject({
      processed: 4,
      legacyMappingsClaimed: 4,
      paintMappingsCreated: 0,
      paintMappingsUpdated: 4,
      measurementsCreated: 4,
    });
    expect(state.mappings.map((mapping) => mapping._id).sort()).toEqual(
      [...legacyIds].sort()
    );
    expect(state.mappings.every((mapping) => mapping.externalKey)).toBe(true);
    expect(state.mappings.every((mapping) => mapping.preferredMeasurementId)).toBe(true);
    expect(state.measurements).toHaveLength(4);
    const superIron = state.mappings.find(
      (mapping) => mapping.mappingKey === "mr-color-super-iron"
    );
    expect(superIron).toMatchObject({
      brand: "GSI Creos",
      line: "Mr. Color",
      series: "SM",
      normalizedCode: "SM201",
      effects: ["metallic"],
    });
    expect(superIron?.finishType).toBeUndefined();
  });
});

function importRecord() {
  const externalKey = "gsi-creos:mr-color:c39";
  const sourceAuthority = "third_party" as const;
  const sourceType = "digital_color_chart" as const;
  const substrate = "digital" as const;
  const sourceName = "Photoshoplus digital color chart";
  const color = derivePaintColorFromHex("#A38A45");
  return {
    externalKey,
    measurementKey: buildPaintMeasurementKey({
      paintExternalKey: externalKey,
      sourceAuthority,
      sourceType,
      substrate,
      sourceName,
    }),
    brandName: "GSI Creos",
    brandSlug: "gsi-creos",
    paintLineName: "Mr. Color",
    paintLineSlug: "mr-color",
    series: "C",
    code: "C39",
    normalizedCode: "C39",
    name: "Dark Yellow",
    paintType: "lacquer" as const,
    sheen: "matte" as const,
    opacity: "opaque" as const,
    effects: [],
    hex: color.hex,
    rgb: color.rgb,
    lab: color.lab,
    accuracy: "approximate" as const,
    sourceAuthority,
    sourceType,
    sourceName,
    sourceUrl: "https://example.test/colors",
    substrate,
    isPreferred: true,
    isActive: true,
    notes: "Approximate digital chart value",
  };
}
