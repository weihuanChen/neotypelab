import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph } from "./assetModel";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, { tokenIdentifier: "detail-owner", email: "owner@example.test" });
  const other = await seedUser(t, { tokenIdentifier: "detail-other", email: "other@example.test", isAdmin: true });
  const conceptId = await t.run(ctx => ctx.db.insert("concepts", {
    userId: owner.userId, title: "Workshop repaint", status: "generated", visibility: "private", weatheringLevel: "clean", searchText: "Workshop repaint",
    palettePlanJson: JSON.stringify({ entries: [{ roleSlug: "primary-armor", roleName: "Primary armor", rationale: "Neutral base", suggestedPaint: { brand: "Tamiya", code: "XF-2", colorName: "White", hexPreview: "#EEEEEE" } }], sprayNotes: ["Use thin coats"] }),
    renderSpecificationJson: JSON.stringify({
      summary: "A restrained repaint", panels: [{ roleSlug: "primary-armor", areas: ["Torso"], maskingNotes: "Follow panel edges" }],
      material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte" }, weathering: { level: "clean", applicationNotes: "No wear" },
      decals: { density: "low", placementNotes: "Shoulder markings" }, baseModel: { name: "Saved kit" }, colorPlan: {},
    }),
  }));
  const image = await t.run(async ctx => {
    const graph = await createAssetGraph(ctx, {
      legacyAsset: { userId: owner.userId, key: "secret-storage-key/original.png", bucket: "private-library", kind: "preview", status: "active", contentType: "image/png", byteSize: 3000 },
      mediaKind: "generated-image", rendition: "original", origin: "generated", bucketRole: "private", conceptId,
    });
    const source = (await ctx.db.get(graph.storageObjectId))!;
    const { _id, _creationTime, ...fields } = source;
    const masterId = await ctx.db.insert("storageObjects", { ...fields, rendition: "master", contentType: "image/webp", byteSize: 1000, width: 1024, height: 1024, key: "secret-storage-key/master.webp" });
    await ctx.db.insert("storageObjects", { ...fields, rendition: "thumbnail", bucketRole: "public", key: "public-copy.webp" });
    await ctx.db.insert("storageObjects", { ...fields, rendition: "preview", userId: other.userId, key: "foreign-file.webp" });
    await ctx.db.insert("storageObjects", { ...fields, rendition: "preview", status: "deleted", key: "removed-file.webp" });
    await ctx.db.patch(conceptId, { mediaAssetId: graph.mediaAssetId, currentAssetVersionId: graph.assetVersionId, previewAssetId: graph.legacyAssetId });
    return { ...graph, masterId };
  });
  return { t, owner, other, conceptId, image };
}

describe("library work details", () => {
  it("only returns an owner's work, even when the other viewer is an administrator", async () => {
    const f = await fixture();
    expect(await f.t.query(api.libraryDetails.get, { conceptId: f.conceptId })).toBeNull();
    expect(await f.other.client.query(api.libraryDetails.get, { conceptId: f.conceptId })).toBeNull();
    expect(await f.owner.client.query(api.libraryDetails.get, { conceptId: "not-a-convex-id" })).toBeNull();
    const detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.title).toBe("Workshop repaint");
    expect(detail?.specification?.panels[0].areas).toEqual(["Torso"]);
    expect(detail?.palette?.entries[0].suggestedPaint?.code).toBe("XF-2");
  });

  it("lists only owned private resource files and never returns storage keys or bucket names", async () => {
    const f = await fixture();
    const detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.collections[0].versions[0].files).toHaveLength(2);
    expect(detail?.hero.storageObjectId).toBe(f.image.masterId);
    expect(detail?.hero.publicUrl).toBeNull();
    expect(JSON.stringify(detail)).not.toContain("secret-storage-key");
    expect(JSON.stringify(detail)).not.toContain("private-library");
    expect(JSON.stringify(detail)).not.toContain("foreign-file");
  });

  it("reflects expired files and original-download entitlements without blocking the preview", async () => {
    const f = await fixture();
    await f.t.mutation(internal.init.seedEntitlementProfiles, {});
    await f.t.run(async ctx => {
      const profile = (await ctx.db.query("entitlementProfiles").withIndex("by_slug", q => q.eq("slug", "free-default")).unique())!;
      await ctx.db.patch(profile._id, { originalDownloadAllowed: false });
    });
    let detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.collections[0].versions[0].files.find(file => file.rendition === "original")?.canDownload).toBe(false);
    expect(detail?.hero.storageObjectId).toBe(f.image.masterId);
    await f.t.run(ctx => ctx.db.patch(f.image.masterId, { retainUntil: Date.now() - 1000 }));
    detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.collections[0].versions[0].files.find(file => file.rendition === "master")?.unavailableReason).toBe("Retention period ended");
    expect(detail?.hero.storageObjectId).toBeNull();
  });

  it("automatically includes reference-image resources without replacing the main render", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const id = await ctx.db.insert("mediaAssets", { userId: f.owner.userId, conceptId: f.conceptId, kind: "reference-image", title: "Panel reference", status: "active", createdAt: Date.now(), updatedAt: Date.now() });
      const version = await ctx.db.insert("assetVersions", { mediaAssetId: id, userId: f.owner.userId, version: 1, origin: "uploaded", status: "ready", createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(id, { currentVersionId: version });
      await ctx.db.insert("storageObjects", { mediaAssetId: id, assetVersionId: version, userId: f.owner.userId, bucketRole: "private", bucket: "private-library", key: "ref.png", rendition: "preview", contentType: "image/png", status: "ready", createdAt: Date.now(), updatedAt: Date.now() });
    });
    const detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.collections).toHaveLength(2);
    expect(detail?.collections.find(collection => collection.kind === "reference-image")?.title).toBe("Panel reference");
    expect(detail?.hero.storageObjectId).toBe(f.image.masterId);
  });

  it("keeps older or damaged snapshots readable and exposes a concise job history", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.conceptId, { palettePlanJson: "invalid", renderSpecificationJson: "{}" });
      const composition = await ctx.db.insert("promptCompositions", { userId: f.owner.userId, conceptId: f.conceptId, status: "consumed", composedPrompt: "private-provider-prompt", inputSnapshotJson: "{}", outputSummaryJson: '{"templateVersion":"creation.v1"}' });
      await ctx.db.insert("generationJobs", { userId: f.owner.userId, conceptId: f.conceptId, promptCompositionId: composition, kind: "hd-preview", status: "succeeded", requestedCredits: 5, inputSnapshotJson: '{"renderMode":"hd-render"}', outputSummaryJson: '{"llmRoute":{"modelId":"gpt-image-2"},"extra":"private-provider-response"}' });
    });
    const detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: f.conceptId });
    expect(detail?.palette).toBeNull();
    expect(detail?.specification).toBeNull();
    expect(detail?.history[0]).toMatchObject({ model: "gpt-image-2", templateVersion: "creation.v1", status: "succeeded", credits: 5 });
    expect(JSON.stringify(detail)).not.toContain("private-provider-prompt");
    expect(JSON.stringify(detail)).not.toContain("private-provider-response");
  });
});
