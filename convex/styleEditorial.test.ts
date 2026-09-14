import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";

const modules = import.meta.glob("./**/*.ts");
const intent = {
  version: "style-intent.v1", source: "official", styleType: "preset", name: "Cyan Digital",
  palette: { primary: "cyan", secondary: "charcoal", accent: "magenta" },
  surfaceLogic: "smooth", graphicLanguage: "digital racing", contrast: "high", markingDensity: "medium",
  materialIntent: ["painted armor"], mood: "energetic", weathering: "clean", finish: "satin", paintability: "high",
};

async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.init.init, {});
  const admin = await seedUser(t, { tokenIdentifier: "curator", email: "curator@example.test", isAdmin: true });
  const owner = await seedUser(t, { tokenIdentifier: "artist", email: "artist@example.test" });
  const seeded = await t.run(async ctx => {
    const style = (await ctx.db.query("stylePresets").first())!;
    const model = (await ctx.db.query("baseModels").first())!;
    const paint = (await ctx.db.query("paintMappings").collect()).find(p => p.isActive)!;
    await ctx.db.patch(style._id, { styleIntentJson: JSON.stringify(intent), styleIntentVersion: intent.version });
    const conceptId = await ctx.db.insert("concepts", {
      userId: owner.userId, title: "Cyan study", weatheringLevel: "clean", status: "generated",
      visibility: "private", searchText: "Cyan study", stylePresetId: style._id, baseModelId: model._id,
      styleIntentJson: JSON.stringify(intent), renderSpecificationJson: '{"summary":"Reviewed study"}',
      palettePlanJson: JSON.stringify({
        entries: [{ roleName: "Armor", roleSlug: "armor", rationale: "Closest catalog sample",
          suggestedPaint: { _id: paint._id, brand: paint.brand, code: paint.code, colorName: paint.colorName, hexPreview: "#00AABB" } }],
        sprayNotes: ["Thin coats"], privateDebug: "must-not-leak",
      }),
    });
    const graph = await createAssetGraph(ctx, {
      legacyAsset: { userId: owner.userId, key: "private/original.png", bucket: "private-library",
        kind: "preview", contentType: "image/png", byteSize: 4000, status: "active" },
      mediaKind: "generated-image", rendition: "original", origin: "generated", bucketRole: "private", conceptId,
    });
    await upsertVersionStorageObjects(ctx, {
      mediaAssetId: graph.mediaAssetId, assetVersionId: graph.assetVersionId, userId: owner.userId,
      objects: (["master", "preview", "thumbnail"] as const).map(rendition => ({
        bucketRole: "private", bucket: "private-library", key: `private/${rendition}.webp`,
        rendition, contentType: "image/webp", byteSize: 1000, width: 1024, height: 1024, checksum: rendition, status: "ready",
      })),
    });
    await ctx.db.patch(conceptId, { mediaAssetId: graph.mediaAssetId, currentAssetVersionId: graph.assetVersionId, previewAssetId: graph.legacyAssetId });
    return { style, model, conceptId };
  });
  const begin = await t.mutation(internal.publications.beginConceptPublication, {
    conceptId: seeded.conceptId, tokenIdentifier: "artist", visibility: "public", publicBucket: "public-showcase",
  });
  if (begin.mode !== "copy") throw new Error("Expected copy");
  await t.mutation(internal.publications.finalizeConceptPublication, {
    publicationId: begin.publicationId, objects: begin.destinationObjects.map(object => ({
      storageObjectId: object.storageObjectId, rendition: object.rendition,
      publicUrl: `https://assets.example.test/${object.rendition}.webp`,
    })),
  });
  return { t, admin, owner, ...seeded, publicationId: begin.publicationId };
}

describe("official style editorial publication", () => {
  it("requires administrator review; public concepts alone do not create SEO pages", async () => {
    const f = await fixture();
    expect(await f.t.query(api.styleEditorial.gallery, {})).toEqual([]);
    expect(await f.t.query(api.styleEditorial.sitemap, {})).toEqual([]);
    await expect(f.owner.client.mutation(api.styleEditorial.reviewConcept, { conceptId: f.conceptId, confirmed: true })).rejects.toThrow(/admin/);
    await expect(f.admin.client.mutation(api.styleEditorial.reviewConcept, { conceptId: f.conceptId, confirmed: false })).rejects.toThrow(/Review/);
    await f.admin.client.mutation(api.styleEditorial.reviewConcept, { conceptId: f.conceptId, confirmed: true });
    const gallery = await f.t.query(api.styleEditorial.gallery, {});
    expect(gallery).toHaveLength(1);
    const pair = await f.t.query(api.styleEditorial.getPair, { styleSlug: f.style.slug, modelSlug: f.model.slug });
    expect(pair?.style.intent).toEqual(intent);
    expect(pair?.palette.entries[0].suggestedPaint.code).toBeTruthy();
    expect(JSON.stringify(pair)).not.toContain("must-not-leak");
    expect(JSON.stringify(pair)).not.toContain("private/");
    expect(await f.t.query(api.styleEditorial.sitemap, {})).toHaveLength(1);
  });

  it.each(["withdraw", "preview", "intent", "palette"])("stops indexing after %s changes", async change => {
    const f = await fixture();
    const id = await f.admin.client.mutation(api.styleEditorial.reviewConcept, { conceptId: f.conceptId, confirmed: true });
    if (change === "withdraw") await f.admin.client.mutation(api.styleEditorial.withdraw, { reviewId: id });
    if (change === "preview") await f.t.run(ctx => ctx.db.patch(f.publicationId, { status: "withdrawn" }));
    if (change === "intent") await f.admin.client.mutation(api.styleEditorial.saveOfficialIntent, {
      stylePresetId: f.style._id, intentJson: JSON.stringify({ ...intent, palette: { primary: "red" } }),
    });
    if (change === "palette") await f.t.run(ctx => ctx.db.patch(f.conceptId, { palettePlanJson: '{"entries":[]}' }));
    expect(await f.t.query(api.styleEditorial.gallery, {})).toEqual([]);
    expect(await f.t.query(api.styleEditorial.getStyle, { slug: f.style.slug })).toBeNull();
    expect(await f.t.query(api.styleEditorial.sitemap, {})).toEqual([]);
  });

  it("rejects custom intent and private previews without creating a review", async () => {
    const f = await fixture();
    await expect(f.admin.client.mutation(api.styleEditorial.saveOfficialIntent, {
      stylePresetId: f.style._id, intentJson: JSON.stringify({ ...intent, source: "private", styleType: "custom" }),
    })).rejects.toThrow(/official/);
    await f.t.run(ctx => ctx.db.patch(f.conceptId, { visibility: "private" }));
    await expect(f.admin.client.mutation(api.styleEditorial.reviewConcept, { conceptId: f.conceptId, confirmed: true })).rejects.toThrow(/public/);
    expect(await f.t.run(ctx => ctx.db.query("styleEditorialReviews").collect())).toEqual([]);
  });

  it.each([true, false])("excludes public custom prototypes (legacy preset link: %s) while preserving sharing", async legacy => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.conceptId, { stylePresetId: legacy ? f.style._id : undefined, styleIntentJson: JSON.stringify({ ...intent, source: "private", styleType: "custom" }) }));
    expect(await f.t.query(api.showcase.listPublicConceptsForSitemap, {})).toEqual([]);
    const shared = await f.t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId });
    expect(shared).not.toBeNull();
    expect(shared?.indexable).toBe(false);
  });
});
