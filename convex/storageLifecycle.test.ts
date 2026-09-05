import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const DAY_MS = 24 * 60 * 60 * 1000;

function renditions(bucket: string, prefix: string) {
  return ([
    ["master", 2048, 800_000],
    ["preview", 1280, 250_000],
    ["thumbnail", 512, 60_000],
  ] as const).map(([rendition, size, byteSize]) => ({
    rendition,
    key: `${prefix}/${rendition}.webp`,
    bucket,
    contentType: "image/webp" as const,
    byteSize,
    width: size,
    height: size,
    checksum: `${prefix}-${rendition}`,
  }));
}

describe("storage lifecycle", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedGeneration(
    userId: Id<"users">,
    conceptId: Id<"concepts">,
    suffix: string
  ) {
    const ids = await t.run(async (ctx) => {
      const promptCompositionId = await ctx.db.insert("promptCompositions", {
        userId,
        conceptId,
        status: "ready",
        composedPrompt: `Generate ${suffix}`,
        inputSnapshotJson: "{}",
      });
      const generationJobId = await ctx.db.insert("generationJobs", {
        userId,
        conceptId,
        promptCompositionId,
        kind: "palette-plan",
        status: "running",
        requestedCredits: 1,
      });
      return { promptCompositionId, generationJobId };
    });
    await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId: ids.generationJobId,
    });
    const input = {
      generationJobId: ids.generationJobId,
      conceptId,
      asset: {
        userId,
        key: `temporary-originals/users/${userId}/${suffix}/original.png`,
        bucket: "private-library",
        kind: "preview" as const,
        contentType: "image/png",
        byteSize: 4_000_000,
        width: 2048,
        height: 2048,
        checksum: `${suffix}-original`,
        status: "active" as const,
      },
      renditions: renditions("private-library", `library/users/${userId}/${suffix}`),
      originalAccountingCategory: "temporary-original" as const,
      originalPermanentStorage: false,
      originalRetentionDays: 7,
      versionRetentionDays: 7,
    };
    const graph = await t.mutation(internal.generation.prepareJobAssetUpload, input);
    return { ...ids, input, graph };
  }

  async function completeGeneration(
    generation: Awaited<ReturnType<typeof seedGeneration>>,
    conceptId: Id<"concepts">
  ) {
    await t.mutation(internal.generation.markJobSucceeded, {
      generationJobId: generation.generationJobId,
      conceptId,
      promptCompositionId: generation.promptCompositionId,
      provider: "internal",
      asset: { ...generation.input.asset, etag: "original-etag" },
      renditions: generation.input.renditions.map((rendition) => ({
        ...rendition,
        etag: `${rendition.rendition}-etag`,
      })),
      outputSummaryJson: JSON.stringify({ phase: "succeeded" }),
    });
  }

  it("switches current only after success and expires the superseded version", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "version-retention-user",
      email: "version-retention@example.test",
    });
    const conceptId = await t.run((ctx) =>
      ctx.db.insert("concepts", {
        userId: user.userId,
        title: "Lifecycle concept",
        weatheringLevel: "clean",
        status: "draft",
        visibility: "private",
        searchText: "lifecycle concept",
      })
    );
    const first = await seedGeneration(user.userId, conceptId, "v1");
    await completeGeneration(first, conceptId);
    const second = await seedGeneration(user.userId, conceptId, "v2");

    const beforeSuccess = await t.run((ctx) => ctx.db.get(first.graph.mediaAssetId));
    expect(beforeSuccess?.currentVersionId).toBe(first.graph.assetVersionId);

    await completeGeneration(second, conceptId);
    const state = await t.run(async (ctx) => ({
      mediaAsset: await ctx.db.get(first.graph.mediaAssetId),
      firstVersion: await ctx.db.get(first.graph.assetVersionId),
      firstObjects: await ctx.db
        .query("storageObjects")
        .withIndex("by_assetVersionId", (q) => q.eq("assetVersionId", first.graph.assetVersionId))
        .collect(),
      secondObjects: await ctx.db
        .query("storageObjects")
        .withIndex("by_assetVersionId", (q) => q.eq("assetVersionId", second.graph.assetVersionId))
        .collect(),
    }));

    expect(state.mediaAsset?.currentVersionId).toBe(second.graph.assetVersionId);
    expect(state.firstVersion?.supersededAt).toBeDefined();
    expect(state.firstObjects.every((object) => object.retentionPolicy === "version-history"))
      .toBe(true);
    expect(state.firstObjects.every((object) => object.retainUntil !== undefined)).toBe(true);
    expect(
      state.secondObjects
        .filter((object) => object.rendition !== "original")
        .every(
          (object) =>
            object.retentionPolicy === "current-version" && object.retainUntil === undefined
        )
    ).toBe(true);
    expect(state.secondObjects.find((object) => object.rendition === "original"))
      .toMatchObject({ retentionPolicy: "temporary-original", retentionDaysSnapshot: 7 });
  });

  it("never claims the current Master for automatic deletion", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "protected-user",
      email: "protected@example.test",
    });
    const now = Date.now();
    const graph = await t.run(async (ctx) => {
      const created = await createAssetGraph(ctx, {
        legacyAsset: {
          userId: user.userId,
          key: "temporary-originals/protected/original.png",
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
        retentionPolicy: "temporary-original",
        retainUntil: now - DAY_MS,
      });
      const [masterId] = await upsertVersionStorageObjects(ctx, {
        mediaAssetId: created.mediaAssetId,
        assetVersionId: created.assetVersionId,
        userId: user.userId,
        objects: [{
          ...renditions("private-library", "library/protected")[0],
          bucketRole: "private",
          retentionPolicy: "version-history",
          retainUntil: now - DAY_MS,
          status: "ready",
        }],
      });
      return { ...created, masterId };
    });

    const claimed = await t.mutation(internal.storageLifecycle.claimExpiredObjects, {});
    const master = await t.run((ctx) => ctx.db.get(graph.masterId));

    expect(claimed.map((object) => object.storageObjectId)).toEqual([graph.storageObjectId]);
    expect(master).toMatchObject({ status: "ready", retentionPolicy: "current-version" });
    expect(master?.retainUntil).toBeUndefined();
  });

  it("retries failed R2 deletion and reconciles usage after success", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "delete-user",
      email: "delete@example.test",
    });
    const now = Date.now();
    const graph = await t.run((ctx) =>
      createAssetGraph(ctx, {
        legacyAsset: {
          userId: user.userId,
          key: "temporary-originals/delete/original.png",
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
        retentionPolicy: "temporary-original",
        retainUntil: now - DAY_MS,
      })
    );
    await t.mutation(internal.storageAccounting.reconcileAccount, { userId: user.userId });

    const [firstClaim] = await t.mutation(internal.storageLifecycle.claimExpiredObjects, {});
    await t.mutation(internal.storageLifecycle.completeDeletionBatch, {
      results: [{
        storageObjectId: firstClaim.storageObjectId,
        ok: false,
        errorMessage: "temporary R2 failure",
      }],
    });
    const failed = await t.run((ctx) => ctx.db.get(graph.storageObjectId));
    expect(failed).toMatchObject({ status: "ready", deleteError: "temporary R2 failure" });
    expect(failed?.nextDeleteAttemptAt).toBeGreaterThan(now);

    await t.run((ctx) =>
      ctx.db.patch(graph.storageObjectId, { nextDeleteAttemptAt: Date.now() - 1 })
    );
    const [retryClaim] = await t.mutation(internal.storageLifecycle.claimExpiredObjects, {});
    await t.mutation(internal.storageLifecycle.completeDeletionBatch, {
      results: [{ storageObjectId: retryClaim.storageObjectId, ok: true }],
    });
    const state = await t.run(async (ctx) => ({
      object: await ctx.db.get(graph.storageObjectId),
      usage: await ctx.db
        .query("accountStorageUsage")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .unique(),
    }));
    expect(state.object).toMatchObject({ status: "deleted" });
    expect(state.object?.deletedAt).toBeDefined();
    expect(state.usage?.temporaryOriginalUsedBytes).toBe(0);
  });

  it("records and resolves R2 objects missing from the database", async () => {
    await t.mutation(internal.storageLifecycle.recordOrphanScan, {
      bucketRole: "private",
      bucket: "private-library",
      scannedKeys: ["library/orphan.webp"],
      missingKeys: ["library/orphan.webp"],
    });
    let reports = await t.run((ctx) => ctx.db.query("storageOrphanReports").collect());
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe("detected");

    await t.mutation(internal.storageLifecycle.recordOrphanScan, {
      bucketRole: "private",
      bucket: "private-library",
      scannedKeys: ["library/orphan.webp"],
      missingKeys: [],
    });
    reports = await t.run((ctx) => ctx.db.query("storageOrphanReports").collect());
    expect(reports[0].status).toBe("resolved");
    expect(reports[0].resolvedAt).toBeDefined();

    await t.mutation(internal.storageLifecycle.saveOrphanAuditCursor, {
      bucketRole: "private",
      bucket: "private-library",
      prefix: "library/",
      continuationToken: "next-page",
    });
    let cursor = await t.query(internal.storageLifecycle.getOrphanAuditCursor, {
      bucket: "private-library",
      prefix: "library/",
    });
    expect(cursor?.continuationToken).toBe("next-page");
    await t.mutation(internal.storageLifecycle.saveOrphanAuditCursor, {
      bucketRole: "private",
      bucket: "private-library",
      prefix: "library/",
    });
    cursor = await t.query(internal.storageLifecycle.getOrphanAuditCursor, {
      bucket: "private-library",
      prefix: "library/",
    });
    expect(cursor?.continuationToken).toBeUndefined();
    expect(cursor?.completedAt).toBeDefined();
  });

  it("backfills retention and version snapshots for legacy storage records", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "backfill-user",
      email: "backfill@example.test",
    });
    const graph = await t.run((ctx) =>
      createAssetGraph(ctx, {
        legacyAsset: {
          userId: user.userId,
          key: "legacy/generated/original.png",
          bucket: "private-library",
          kind: "preview",
          byteSize: 4_000_000,
          status: "active",
        },
        mediaKind: "generated-image",
        rendition: "original",
        origin: "migrated",
        bucketRole: "private",
      })
    );
    await t.run((ctx) =>
      ctx.db.patch(graph.storageObjectId, {
        retentionPolicy: undefined,
        retentionDaysSnapshot: undefined,
        retainUntil: undefined,
        nextDeleteAttemptAt: undefined,
      })
    );

    await t.mutation(internal.storageLifecycle.backfillRetentionBatch, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    const state = await t.run(async (ctx) => ({
      object: await ctx.db.get(graph.storageObjectId),
      version: await ctx.db.get(graph.assetVersionId),
    }));

    expect(state.object).toMatchObject({
      accountingCategory: "temporary-original",
      retentionPolicy: "temporary-original",
      retentionDaysSnapshot: 7,
    });
    expect(state.object?.retainUntil).toBeDefined();
    expect(state.version?.retentionDaysSnapshot).toBe(7);
  });
});
