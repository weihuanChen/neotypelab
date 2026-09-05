import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";
import { getPublishedRenditions } from "./publications";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("Showcase publication workflow", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedPublishableConcept() {
    const user = await seedUser(t, {
      tokenIdentifier: "publisher-token",
      email: "publisher@example.test",
    });
    const seeded = await t.run(async (ctx) => {
      const conceptId = await ctx.db.insert("concepts", {
        userId: user.userId,
        title: "Publishable concept",
        weatheringLevel: "clean",
        status: "generated",
        visibility: "private",
        searchText: "publishable concept",
      });
      const graph = await createAssetGraph(ctx, {
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
});
