import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph } from "./assetModel";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("asset model compatibility", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("dual-writes uploaded references while preserving the legacy API", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "asset-user",
      email: "asset@example.test",
    });

    const legacyAssetId = await user.client.mutation(api.assets.createReference, {
      key: "users/asset-user/reference.png",
      kind: "reference",
      contentType: "image/png",
      byteSize: 1024,
    });

    const state = await t.run(async (ctx) => {
      const legacyAsset = await ctx.db.get(legacyAssetId);
      const mediaAsset = legacyAsset?.mediaAssetId
        ? await ctx.db.get(legacyAsset.mediaAssetId)
        : null;
      const version = legacyAsset?.assetVersionId
        ? await ctx.db.get(legacyAsset.assetVersionId)
        : null;
      const object = legacyAsset?.storageObjectId
        ? await ctx.db.get(legacyAsset.storageObjectId)
        : null;
      return { legacyAsset, mediaAsset, version, object };
    });

    expect(state.legacyAsset).toMatchObject({ kind: "reference", status: "active" });
    expect(state.mediaAsset).toMatchObject({ kind: "reference-image", status: "active" });
    expect(state.version).toMatchObject({ version: 1, origin: "uploaded", status: "ready" });
    expect(state.object).toMatchObject({
      bucketRole: "private",
      rendition: "source",
      status: "ready",
      legacyAssetId,
    });
  });

  it("groups generated concept outputs into ordered versions", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "version-user",
      email: "version@example.test",
    });
    const result = await t.run(async (ctx) => {
      const conceptId = await ctx.db.insert("concepts", {
        userId: user.userId,
        title: "Versioned concept",
        weatheringLevel: "clean",
        status: "draft",
        visibility: "private",
        searchText: "versioned concept",
      });
      const input = (key: string) => ({
        legacyAsset: {
          userId: user.userId,
          key,
          bucket: "showcase",
          kind: "preview" as const,
          contentType: "image/png",
          byteSize: 4096,
          status: "active" as const,
        },
        mediaKind: "generated-image" as const,
        rendition: "original" as const,
        origin: "generated" as const,
        bucketRole: "public" as const,
        conceptId,
      });
      const first = await createAssetGraph(ctx, input("generated/first.png"));
      const second = await createAssetGraph(ctx, input("generated/second.png"));
      const versions = await ctx.db
        .query("assetVersions")
        .withIndex("by_media_version", (q) => q.eq("mediaAssetId", first.mediaAssetId))
        .collect();
      const mediaAsset = await ctx.db.get(first.mediaAssetId);
      return { first, second, versions, mediaAsset };
    });

    expect(result.second.mediaAssetId).toBe(result.first.mediaAssetId);
    expect(result.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(result.versions[1].parentVersionId).toBe(result.versions[0]._id);
    expect(result.mediaAsset?.currentVersionId).toBe(result.second.assetVersionId);
  });

  it("links successful generation records to both asset models", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "generation-user",
      email: "generation@example.test",
    });
    const seeded = await t.run(async (ctx) => {
      const conceptId = await ctx.db.insert("concepts", {
        userId: user.userId,
        title: "Generated concept",
        weatheringLevel: "clean",
        status: "draft",
        visibility: "private",
        searchText: "generated concept",
      });
      const promptCompositionId = await ctx.db.insert("promptCompositions", {
        userId: user.userId,
        conceptId,
        status: "ready",
        composedPrompt: "Generate a model",
        inputSnapshotJson: "{}",
      });
      const generationJobId = await ctx.db.insert("generationJobs", {
        userId: user.userId,
        conceptId,
        promptCompositionId,
        kind: "palette-plan",
        status: "running",
        requestedCredits: 1,
      });
      return { conceptId, promptCompositionId, generationJobId };
    });

    await t.mutation(internal.generation.markJobSucceeded, {
      ...seeded,
      provider: "internal",
      asset: {
        userId: user.userId,
        key: "generated/output.png",
        bucket: "showcase",
        kind: "preview",
        contentType: "image/png",
        byteSize: 4096,
        status: "active",
      },
      outputSummaryJson: JSON.stringify({ phase: "succeeded" }),
    });

    const state = await t.run(async (ctx) => {
      const job = await ctx.db.get(seeded.generationJobId);
      const concept = await ctx.db.get(seeded.conceptId);
      const legacyAsset = job?.outputAssetId ? await ctx.db.get(job.outputAssetId) : null;
      const storageObject = legacyAsset?.storageObjectId
        ? await ctx.db.get(legacyAsset.storageObjectId)
        : null;
      return { job, concept, legacyAsset, storageObject };
    });

    expect(state.job).toMatchObject({
      status: "succeeded",
      outputMediaAssetId: state.legacyAsset?.mediaAssetId,
      outputAssetVersionId: state.legacyAsset?.assetVersionId,
    });
    expect(state.concept).toMatchObject({
      status: "generated",
      previewAssetId: state.legacyAsset?._id,
      mediaAssetId: state.legacyAsset?.mediaAssetId,
      currentAssetVersionId: state.legacyAsset?.assetVersionId,
    });
    expect(state.storageObject).toMatchObject({
      bucketRole: "public",
      rendition: "original",
      status: "ready",
    });
  });
});
