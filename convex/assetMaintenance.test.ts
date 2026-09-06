import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("private asset maintenance", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedVersionedAsset(userId: Id<"users">) {
    return await t.run(async (ctx) => {
      const now = Date.now();
      const mediaAssetId = await ctx.db.insert("mediaAssets", {
        userId,
        kind: "generated-image",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const oldVersionId = await ctx.db.insert("assetVersions", {
        mediaAssetId,
        userId,
        version: 1,
        origin: "generated",
        status: "ready",
        supersededAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const currentVersionId = await ctx.db.insert("assetVersions", {
        mediaAssetId,
        userId,
        version: 2,
        parentVersionId: oldVersionId,
        origin: "edited",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(mediaAssetId, { currentVersionId });
      const insertObject = async (assetVersionId: typeof currentVersionId, rendition: "original" | "master", key: string, byteSize: number) =>
        await ctx.db.insert("storageObjects", {
          mediaAssetId,
          assetVersionId,
          userId,
          accountingCategory: rendition === "original" ? "temporary-original" : "optimized",
          retentionPolicy: assetVersionId === currentVersionId && rendition !== "original" ? "current-version" : rendition === "original" ? "temporary-original" : "version-history",
          bucketRole: "private",
          bucket: "private-library",
          key,
          rendition,
          byteSize,
          status: "ready",
          createdAt: now,
          updatedAt: now,
        });
      const oldOriginalId = await insertObject(oldVersionId, "original", "old/original.png", 4_000_000);
      const oldMasterId = await insertObject(oldVersionId, "master", "old/master.webp", 800_000);
      const currentOriginalId = await insertObject(currentVersionId, "original", "current/original.png", 4_000_000);
      const currentMasterId = await insertObject(currentVersionId, "master", "current/master.webp", 800_000);
      return { mediaAssetId, oldVersionId, currentVersionId, oldOriginalId, oldMasterId, currentOriginalId, currentMasterId };
    });
  }

  it("claims only the current Original and superseded versions for Space Saver", async () => {
    const user = await seedUser(t, { tokenIdentifier: "storage-owner", email: "owner@example.test" });
    const graph = await seedVersionedAsset(user.userId);

    const targets = await t.mutation(internal.assetMaintenance.claimPrivateAssetCleanup, {
      tokenIdentifier: "storage-owner",
      mediaAssetId: graph.mediaAssetId,
      mode: "space-saver",
    });

    expect(new Set(targets.map((target) => target.storageObjectId))).toEqual(new Set([
      graph.oldOriginalId,
      graph.oldMasterId,
      graph.currentOriginalId,
    ]));
    expect(targets.some((target) => target.storageObjectId === graph.currentMasterId)).toBe(false);

    await t.mutation(internal.assetMaintenance.completePrivateAssetCleanup, {
      mediaAssetId: graph.mediaAssetId,
      mode: "space-saver",
      results: targets.map((target) => ({ storageObjectId: target.storageObjectId, ok: true })),
    });
    const state = await t.run(async (ctx) => ({
      oldVersion: await ctx.db.get(graph.oldVersionId),
      currentVersion: await ctx.db.get(graph.currentVersionId),
      currentMaster: await ctx.db.get(graph.currentMasterId),
      usage: await ctx.db.query("accountStorageUsage").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
    }));
    expect(state.oldVersion?.status).toBe("deleted");
    expect(state.currentVersion?.status).toBe("ready");
    expect(state.currentMaster?.status).toBe("ready");
    expect(state.usage).toMatchObject({ optimizedUsedBytes: 800_000, temporaryOriginalUsedBytes: 0 });
  });

  it("rejects cleanup requested with another account identity", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "asset-owner", email: "owner@example.test" });
    await seedUser(t, { tokenIdentifier: "other-user", email: "other@example.test" });
    const graph = await seedVersionedAsset(owner.userId);

    await expect(t.mutation(internal.assetMaintenance.claimPrivateAssetCleanup, {
      tokenIdentifier: "other-user",
      mediaAssetId: graph.mediaAssetId,
      mode: "delete-original",
    })).rejects.toThrow("access denied");
  });
});
