import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { derivePaintColorFromHex } from "./paintColor";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("paint match APIs", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns computed cross-brand conversions", async () => {
    const seeded = await seedPaintPair(t);
    const result = await t.query(api.paintMatches.getCrossBrandConversions, {
      paintMappingId: seeded.sourcePaintId,
    });

    expect(result?.curated).toEqual([]);
    expect(result?.computed).toHaveLength(1);
    expect(result?.computed[0]).toMatchObject({
      method: "delta_e_2000",
      candidate: { paintMappingId: seeded.targetPaintId, brand: "Brand B" },
    });
  });

  it("stores curated equivalence and resolves it in both directions", async () => {
    const admin = await seedUser(t, {
      tokenIdentifier: "paint-admin",
      email: "paint-admin@example.test",
      isAdmin: true,
    });
    const seeded = await seedPaintPair(t);
    const equivalenceId = await admin.client.mutation(
      api.paintMatches.upsertEquivalence,
      {
        sourcePaintId: seeded.sourcePaintId,
        targetPaintId: seeded.targetPaintId,
        method: "manual_review",
        confidence: 0.9,
        sourceName: "Builder review",
        isActive: true,
      }
    );

    const forward = await t.query(api.paintMatches.getCrossBrandConversions, {
      paintMappingId: seeded.sourcePaintId,
    });
    const reverse = await t.query(api.paintMatches.getCrossBrandConversions, {
      paintMappingId: seeded.targetPaintId,
    });

    expect(forward?.curated[0]).toMatchObject({
      equivalenceId,
      direction: "forward",
      method: "manual_review",
      confidence: 0.9,
      candidate: { paintMappingId: seeded.targetPaintId },
    });
    expect(forward?.computed).toEqual([]);
    expect(reverse?.curated[0]).toMatchObject({
      equivalenceId,
      direction: "reverse",
      candidate: { paintMappingId: seeded.sourcePaintId },
    });
    expect(reverse?.computed).toEqual([]);
    await expect(
      admin.client.mutation(api.paintMatches.upsertEquivalence, {
        sourcePaintId: seeded.targetPaintId,
        targetPaintId: seeded.sourcePaintId,
        method: "manual_review",
        confidence: 0.8,
        isActive: true,
      })
    ).rejects.toThrow("already exists in reverse order");
  });
});

async function seedPaintPair(t: Backend) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const brandAId = await ctx.db.insert("paintBrands", {
      name: "Brand A",
      slug: "brand-a",
      aliases: [],
      isActive: true,
      searchText: "Brand A",
      createdAt: now,
      updatedAt: now,
    });
    const brandBId = await ctx.db.insert("paintBrands", {
      name: "Brand B",
      slug: "brand-b",
      aliases: [],
      isActive: true,
      searchText: "Brand B",
      createdAt: now,
      updatedAt: now,
    });
    const lineAId = await ctx.db.insert("paintLines", {
      brandId: brandAId,
      name: "Line A",
      slug: "line-a",
      aliases: [],
      isActive: true,
      searchText: "Line A",
      createdAt: now,
      updatedAt: now,
    });
    const lineBId = await ctx.db.insert("paintLines", {
      brandId: brandBId,
      name: "Line B",
      slug: "line-b",
      aliases: [],
      isActive: true,
      searchText: "Line B",
      createdAt: now,
      updatedAt: now,
    });
    const sourcePaintId = await insertPaint(
      ctx,
      brandAId,
      lineAId,
      "brand-a:line-a:a1",
      "A1",
      "#808080"
    );
    const targetPaintId = await insertPaint(
      ctx,
      brandBId,
      lineBId,
      "brand-b:line-b:b1",
      "B1",
      "#818181"
    );
    return { sourcePaintId, targetPaintId };
  });
}

async function insertPaint(
  ctx: MutationCtx,
  brandId: Id<"paintBrands">,
  paintLineId: Id<"paintLines">,
  externalKey: string,
  code: string,
  hex: string
) {
  const now = Date.now();
  const paintMappingId = await ctx.db.insert("paintMappings", {
    externalKey,
    brandId,
    paintLineId,
    normalizedCode: code,
    name: code,
    effects: [],
    mappingKey: externalKey.replace(/:/g, "-"),
    brand: externalKey.startsWith("brand-a") ? "Brand A" : "Brand B",
    code,
    colorName: code,
    hexPreview: hex,
    isActive: true,
    searchText: code,
  });
  const color = derivePaintColorFromHex(hex);
  const measurementId = await ctx.db.insert("paintColorMeasurements", {
    measurementKey: `${externalKey}:test`,
    paintMappingId,
    hex: color.hex,
    rgb: color.rgb,
    rgbColorSpace: color.rgbColorSpace,
    lab: color.lab,
    labIlluminant: color.labIlluminant,
    labObserver: color.labObserver,
    labMethod: color.labMethod,
    conversionVersion: color.conversionVersion,
    accuracy: "measured",
    sourceAuthority: "internal",
    sourceType: "physical_measurement",
    sourceName: "Test",
    substrate: "white_primer",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(paintMappingId, { preferredMeasurementId: measurementId });
  return paintMappingId;
}
