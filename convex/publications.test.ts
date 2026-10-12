import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";
import { deleteR2Object, purgePublicR2Urls } from "./r2Storage";
import { SHOWCASE_INDEX_DELAY_MS } from "./showcasePolicy";
import { buildPaintPlan } from "./paintMappingEngine";
import { getPublishedRenditions } from "./publications";
import { seedUser } from "@/tests/convexTestHelpers";

vi.mock("./r2Storage", () => ({
  copyR2Object: vi.fn(),
  deleteR2Object: vi.fn(),
  purgePublicR2Urls: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("Showcase publication workflow", () => {
  let t: Backend;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(deleteR2Object).mockReset().mockResolvedValue(undefined);
    vi.mocked(purgePublicR2Urls).mockReset().mockResolvedValue({ status: "purged" });
    t = convexTest(schema, modules);
  });

  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  async function seedPublishableConcept(quality = false) {
    const user = await seedUser(t, {
      tokenIdentifier: "publisher-token",
      email: "publisher@example.test",
    });
    if (quality) await t.mutation(internal.init.init, {});
    const seeded = await t.run(async (ctx) => {
      const conceptId = await ctx.db.insert("concepts", {
        userId: user.userId,
        title: "Publishable concept",
        weatheringLevel: "clean",
        status: "generated",
        visibility: "private",
        searchText: "publishable concept",
      });
      const jobId = quality ? await ctx.db.insert("generationJobs", {
        userId: user.userId, conceptId, kind: "hd-preview", status: "succeeded", requestedCredits: 5,
      }) : undefined;
      if (quality) {
        const model = (await ctx.db.query("baseModels").first())!;
        const style = (await ctx.db.query("stylePresets").first())!;
        await ctx.db.patch(model._id, { isActive: true, status: "active" });
        await ctx.db.patch(style._id, { isActive: true });
        const plan = buildPaintPlan({ conceptId, conceptTitle: "Publishable concept", weatheringLevel: "clean", moodTags: [],
          colorRoles: await ctx.db.query("colorRoles").collect(), paintMappings: [] });
        await ctx.db.patch(conceptId, { baseModelId: model._id, stylePresetId: style._id, palettePlanJson: JSON.stringify(plan) });
      }
      const graph = await createAssetGraph(ctx, {
        generationJobId: jobId,
        legacyAsset: {
          userId: user.userId,
          key: "users/publisher/original.png",
          bucket: "private-library",
          kind: "preview",
          contentType: "image/png",
          byteSize: 4_000_000,
          status: "active",
        },
        mediaKind: "generated-image",
        rendition: "original",
        origin: "generated",
        bucketRole: "private",
        conceptId,
      });
      await upsertVersionStorageObjects(ctx, {
        mediaAssetId: graph.mediaAssetId,
        assetVersionId: graph.assetVersionId,
        userId: user.userId,
        objects: ([
          ["master", 2048, 800_000],
          ["preview", 1280, 250_000],
          ["thumbnail", 512, 60_000],
        ] as const).map(([rendition, size, byteSize]) => ({
          bucketRole: "private",
          bucket: "private-library",
          key: `users/publisher/${rendition}.webp`,
          rendition,
          contentType: "image/webp",
          byteSize,
          width: size,
          height: size,
          checksum: `${rendition}-checksum`,
          status: "ready",
        })),
      });
      await ctx.db.patch(conceptId, {
        mediaAssetId: graph.mediaAssetId,
        currentAssetVersionId: graph.assetVersionId,
        previewAssetId: graph.legacyAssetId,
      });
      return { conceptId, ...graph };
    });
    return { user, ...seeded };
  }

  it("publishes a complete public rendition set and exposes only that set", async () => {
    const seeded = await seedPublishableConcept();
    const begin = await t.mutation(internal.publications.beginConceptPublication, {
      conceptId: seeded.conceptId,
      tokenIdentifier: "publisher-token",
      visibility: "public",
      publicBucket: "public-showcase",
    });
    expect(begin.mode).toBe("copy");
    if (begin.mode !== "copy") throw new Error("Expected publication copy");

    const beforeFinalize = await t.query(api.showcase.listPublicConcepts, {});
    expect(beforeFinalize).toHaveLength(0);

    await t.mutation(internal.publications.finalizeConceptPublication, {
      publicationId: begin.publicationId,
      objects: begin.destinationObjects.map((object) => ({
        storageObjectId: object.storageObjectId,
        rendition: object.rendition,
        etag: `${object.rendition}-etag`,
        publicUrl: `https://assets.example.test/${object.key}`,
      })),
    });

    const state = await t.run(async (ctx) => {
      const concept = await ctx.db.get(seeded.conceptId);
      if (!concept) throw new Error("Concept not found");
      return {
        concept,
        publication: concept.activePublicationId
          ? await ctx.db.get(concept.activePublicationId)
          : null,
        published: await getPublishedRenditions(ctx as never, concept),
      };
    });
    const publicConcepts = await t.query(api.showcase.listPublicConcepts, {});

    expect(state.concept).toMatchObject({
      visibility: "public",
      activePublicationId: begin.publicationId,
    });
    expect(state.publication?.status).toBe("published");
    expect(state.published?.preview?.bucketRole).toBe("public");
    expect(publicConcepts[0]?.previewAsset).toMatchObject({
      publicUrl: expect.stringContaining("/preview.webp"),
      thumbnailUrl: expect.stringContaining("/thumbnail.webp"),
      masterUrl: expect.stringContaining("/master.webp"),
    });

    const visibilityOnly = await t.mutation(internal.publications.beginConceptPublication, {
      conceptId: seeded.conceptId,
      tokenIdentifier: "publisher-token",
      visibility: "unlisted",
      publicBucket: "public-showcase",
    });
    expect(visibilityOnly.mode).toBe("ready");
    expect((await t.run((ctx) => ctx.db.query("assetPublications").collect()))).toHaveLength(1);
  });

  it("hides a concept before deleting its public objects", async () => {
    const seeded = await seedPublishableConcept();
    const begin = await t.mutation(internal.publications.beginConceptPublication, {
      conceptId: seeded.conceptId,
      tokenIdentifier: "publisher-token",
      visibility: "public",
      publicBucket: "public-showcase",
    });
    if (begin.mode !== "copy") throw new Error("Expected publication copy");
    await t.mutation(internal.publications.finalizeConceptPublication, {
      publicationId: begin.publicationId,
      objects: begin.destinationObjects.map((object) => ({
        storageObjectId: object.storageObjectId,
        rendition: object.rendition,
        publicUrl: `https://assets.example.test/${object.key}`,
      })),
    });

    const withdrawal = await t.mutation(internal.publications.beginConceptWithdrawal, {
      conceptId: seeded.conceptId,
      tokenIdentifier: "publisher-token",
    });
    expect(withdrawal).not.toBeNull();
    expect(await t.query(api.showcase.listPublicConcepts, {})).toHaveLength(0);
    await t.mutation(internal.publications.completePublicationWithdrawal, {
      publicationId: begin.publicationId,
    });

    const state = await t.run(async (ctx) => ({
      concept: await ctx.db.get(seeded.conceptId),
      publication: await ctx.db.get(begin.publicationId),
      objects: await ctx.db
        .query("storageObjects")
        .withIndex("by_publicationId", (q) => q.eq("publicationId", begin.publicationId))
        .collect(),
    }));
    expect(state.concept).toMatchObject({ visibility: "private" });
    expect(state.concept?.activePublicationId).toBeUndefined();
    expect(state.publication?.status).toBe("withdrawn");
    expect(state.objects.every((object) => object.status === "deleted")).toBe(true);
  });

  it("prevents the legacy update mutation from bypassing publication", async () => {
    const seeded = await seedPublishableConcept();
    await expect(
      seeded.user.client.mutation(api.concepts.update, {
        conceptId: seeded.conceptId,
        visibility: "public",
      })
    ).rejects.toThrow("publication workflow");
  });

  async function beginPublication(conceptId: Awaited<ReturnType<typeof seedPublishableConcept>>["conceptId"], visibility: "public" | "unlisted" = "public") {
    return t.mutation(internal.publications.beginConceptPublication, {
      conceptId, tokenIdentifier: "publisher-token", visibility, publicBucket: "public-showcase",
    });
  }

  async function publish(conceptId: Awaited<ReturnType<typeof seedPublishableConcept>>["conceptId"]) {
    const begin = await beginPublication(conceptId);
    await finalize(begin);
    return begin;
  }

  async function finalize(begin: Awaited<ReturnType<typeof beginPublication>>) {
    return t.mutation(internal.publications.finalizeConceptPublication, {
      publicationId: begin.publicationId,
      objects: begin.destinationObjects.map(object => ({
        storageObjectId: object.storageObjectId, rendition: object.rendition,
        publicUrl: `https://assets.example.test/${object.key}`,
      })),
    });
  }

  async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await t.finishInProgressScheduledFunctions();
  }

  async function expectEligibility(conceptId: Awaited<ReturnType<typeof seedPublishableConcept>>["conceptId"], eligible: boolean) {
    expect((await t.query(api.showcase.getSharedConcept, { conceptId }))?.indexable).toBe(eligible);
    const entries = (await t.query(api.showcase.listPublicConceptsForSitemap, {})).page;
    expect(entries.some(entry => entry._id === conceptId)).toBe(eligible);
  }

  it("allows public access immediately but indexes only after 72 continuous hours", async () => {
    const f = await seedPublishableConcept(true);
    await publish(f.conceptId);
    await expectEligibility(f.conceptId, false);
    await advance(SHOWCASE_INDEX_DELAY_MS - 1);
    await expectEligibility(f.conceptId, false);
    await advance(1);
    await expectEligibility(f.conceptId, true);
    const concept = await t.run(ctx => ctx.db.get(f.conceptId));
    expect((await t.query(api.showcase.listPublicConceptsForSitemap, {})).page[0]?.lastModified).toBe(concept?.publicContentUpdatedAt);
  });

  it("revokes sitemap eligibility immediately when mutable quality dependencies fail", async () => {
    const f = await seedPublishableConcept(true);
    await publish(f.conceptId);
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await expectEligibility(f.conceptId, true);
    const concept = (await t.run(ctx => ctx.db.get(f.conceptId)))!;
    await t.run(ctx => ctx.db.patch(concept.stylePresetId!, { isActive: false }));
    await expectEligibility(f.conceptId, false);
    await t.run(ctx => ctx.db.patch(concept.stylePresetId!, { isActive: true }));
    await t.run(ctx => ctx.db.patch(f.conceptId, { palettePlanJson: "{}" }));
    await expectEligibility(f.conceptId, false);
  });

  it("restarts the wait after an unlisted interval and ignores the old scheduled check", async () => {
    const f = await seedPublishableConcept(true);
    const first = await publish(f.conceptId);
    const firstSince = (await t.run(ctx => ctx.db.get(f.conceptId)))!.publicSince!;
    await advance(60 * 60 * 1000);
    await beginPublication(f.conceptId, "unlisted");
    await expectEligibility(f.conceptId, false);
    await beginPublication(f.conceptId, "public");
    await t.mutation(internal.showcaseIndexing.evaluate, { conceptId: f.conceptId, publicationId: first.publicationId, publicSince: firstSince });
    await advance(SHOWCASE_INDEX_DELAY_MS - 60 * 60 * 1000);
    await expectEligibility(f.conceptId, false);
    await advance(60 * 60 * 1000);
    await expectEligibility(f.conceptId, true);
  });

  it("preserves Library files and uses distinct public paths after withdrawal and republication", async () => {
    const f = await seedPublishableConcept(true);
    const first = await publish(f.conceptId);
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "publisher-token" });
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
    expect((await t.query(api.showcase.listPublicConceptsForSitemap, {})).page).toEqual([]);
    expect(await f.user.client.query(api.libraryDetails.get, { conceptId: f.conceptId })).not.toBeNull();
    const second = await publish(f.conceptId);
    expect(second.destinationObjects.every(object => !first.destinationObjects.some(old => old.key === object.key))).toBe(true);
    await t.mutation(internal.publications.completePublicationWithdrawal, { publicationId: first.publicationId });
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).not.toBeNull();
    await expectEligibility(f.conceptId, false);
  });

  it("prevents an in-flight publication from reviving a removed work", async () => {
    const f = await seedPublishableConcept();
    const begin = await beginPublication(f.conceptId);
    await t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "publisher-token" });
    expect((await finalize(begin)).cancelled).toBe(true);
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
    expect((await t.run(ctx => ctx.db.get(f.conceptId)))?.visibility).toBe("private");
    expect(await t.query(internal.publications.getWithdrawal, { publicationId: begin.publicationId, now: Date.now() })).not.toBeNull();
  });

  it("lets the latest concurrent publication win without sharing cleanup paths", async () => {
    const f = await seedPublishableConcept();
    const first = await beginPublication(f.conceptId);
    const second = await beginPublication(f.conceptId, "unlisted");
    expect((await finalize(first)).cancelled).toBe(true);
    expect((await finalize(second)).cancelled).toBe(false);
    expect((await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId }))?.visibility).toBe("unlisted");
  });

  it("allows only admins to triage reports and hides withdrawn works without deleting Library", async () => {
    const f = await seedPublishableConcept(true);
    const admin = await seedUser(t, { tokenIdentifier: "review-admin", email: "review@example.test", isAdmin: true });
    await publish(f.conceptId);
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await expect(f.user.client.mutation(api.showcaseIndexing.setReviewStatus, { conceptId: f.conceptId, status: "hidden" })).rejects.toThrow();
    await admin.client.mutation(api.showcaseIndexing.setReviewStatus, { conceptId: f.conceptId, status: "pending-review" });
    await expectEligibility(f.conceptId, false);
    await admin.client.mutation(api.showcaseIndexing.setReviewStatus, { conceptId: f.conceptId, status: "clear" });
    await advance(0);
    await expectEligibility(f.conceptId, true);
    await admin.client.mutation(api.showcaseIndexing.setReviewStatus, { conceptId: f.conceptId, status: "hidden" });
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
    expect(await f.user.client.query(api.libraryDetails.get, { conceptId: f.conceptId })).not.toBeNull();
  });

  it("initializes legacy public records with a fresh wait instead of assuming asset age", async () => {
    const f = await seedPublishableConcept(true);
    await publish(f.conceptId);
    await t.run(ctx => ctx.db.patch(f.conceptId, { publicSince: undefined, indexEligible: undefined }));
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await t.mutation(internal.showcaseIndexing.reconcile, {});
    await expectEligibility(f.conceptId, false);
    expect((await t.run(ctx => ctx.db.get(f.conceptId)))?.publicSince).toBe(Date.now());
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await expectEligibility(f.conceptId, true);
  });


  it("rejects an unauthorized withdrawal and preserves the owner's public work", async () => {
    const f = await seedPublishableConcept(true);
    const other = await seedUser(t, { tokenIdentifier: "other-publisher", email: "other@example.test" });
    await publish(f.conceptId);
    await expect(t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "other-publisher" })).rejects.toThrow(/denied/);
    await expect(other.client.query(api.libraryDetails.get, { conceptId: f.conceptId })).resolves.toBeNull();
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).not.toBeNull();
  });

  it("keeps failed cleanup queued for automatic retries while the work remains private", async () => {
    const f = await seedPublishableConcept();
    const begin = await publish(f.conceptId);
    await t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "publisher-token" });
    await t.mutation(internal.publications.deferWithdrawal, { publicationId: begin.publicationId });
    expect(await t.query(internal.publications.listPendingWithdrawals, { now: Date.now() })).toEqual([]);
    await advance(15 * 60 * 1000);
    expect(await t.query(internal.publications.listPendingWithdrawals, { now: Date.now() })).toContain(begin.publicationId);
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
  });

  it("expires interrupted publications so abandoned copies are eventually cleaned", async () => {
    const f = await seedPublishableConcept();
    const begin = await beginPublication(f.conceptId);
    await advance(15 * 60 * 1000);
    expect((await t.run(ctx => ctx.db.get(f.conceptId)))?.pendingPublicationId).toBeUndefined();
    expect(await t.query(internal.publications.listPendingWithdrawals, { now: Date.now() })).toContain(begin.publicationId);
    expect((await finalize(begin)).cancelled).toBe(true);
  });


  it("automatically finishes failed storage cleanup without restoring public access", async () => {
    const f = await seedPublishableConcept();
    const begin = await publish(f.conceptId);
    await t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "publisher-token" });
    vi.mocked(deleteR2Object).mockRejectedValueOnce(new Error("R2 temporarily unavailable"));
    await t.action(internal.publicationNode.retryWithdrawals, {});
    expect((await t.run(ctx => ctx.db.get(begin.publicationId)))?.status).toBe("withdrawing");
    await advance(15 * 60 * 1000);
    await t.action(internal.publicationNode.retryWithdrawals, {});
    expect((await t.run(ctx => ctx.db.get(begin.publicationId)))?.status).toBe("withdrawn");
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
    expect(await f.user.client.query(api.libraryDetails.get, { conceptId: f.conceptId })).not.toBeNull();
  });

  it("keeps cleanup pending when CDN purge is not configured", async () => {
    const f = await seedPublishableConcept();
    const begin = await publish(f.conceptId);
    await t.mutation(internal.publications.beginConceptWithdrawal, { conceptId: f.conceptId, tokenIdentifier: "publisher-token" });
    vi.mocked(purgePublicR2Urls).mockResolvedValue({ status: "skipped" });
    await t.action(internal.publicationNode.retryWithdrawals, {});
    expect((await t.run(ctx => ctx.db.get(begin.publicationId)))?.status).toBe("withdrawing");
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).toBeNull();
  });

  it.each(["duplicate", "low-quality"] as const)("excludes %s works without withdrawing public access", async status => {
    const f = await seedPublishableConcept(true);
    const admin = await seedUser(t, { tokenIdentifier: "quality-admin", email: "quality@example.test", isAdmin: true });
    await publish(f.conceptId);
    await advance(SHOWCASE_INDEX_DELAY_MS);
    await admin.client.mutation(api.showcaseIndexing.setReviewStatus, { conceptId: f.conceptId, status });
    await expectEligibility(f.conceptId, false);
    expect(await t.query(api.showcase.getSharedConcept, { conceptId: f.conceptId })).not.toBeNull();
  });

});
