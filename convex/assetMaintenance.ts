import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./functions";
import { reconcileAccountStorageUsage } from "./storageAccounting";

const vCleanupMode = v.union(
  v.literal("delete-original"),
  v.literal("clean-old-versions"),
  v.literal("space-saver")
);

export const claimPrivateAssetCleanup = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    mediaAssetId: v.id("mediaAssets"),
    mode: vCleanupMode,
  },
  async handler(ctx, { mediaAssetId, mode, tokenIdentifier }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (!viewer) throw new Error("Authentication is required");
    const mediaAsset = await ctx.db.get(mediaAssetId);
    if (!mediaAsset || mediaAsset.userId !== viewer._id || mediaAsset.status !== "active") {
      throw new Error("Library asset not found or access denied");
    }
    if (!mediaAsset.currentVersionId) {
      throw new Error("This asset does not have a current version");
    }

    const [versions, objects] = await Promise.all([
      ctx.db
        .query("assetVersions")
        .withIndex("by_mediaAssetId", (q) => q.eq("mediaAssetId", mediaAssetId))
        .collect(),
      ctx.db
        .query("storageObjects")
        .withIndex("by_mediaAssetId", (q) => q.eq("mediaAssetId", mediaAssetId))
        .collect(),
    ]);
    if (versions.some((version) => version.status === "processing")) {
      throw new Error("Wait for asset processing to finish before cleaning storage");
    }

    const oldVersionIds = new Set(
      versions
        .filter((version) => version._id !== mediaAsset.currentVersionId)
        .map((version) => version._id)
    );
    const matchesMode = (object: (typeof objects)[number]) => {
      const isCurrentOriginal = object.assetVersionId === mediaAsset.currentVersionId &&
        object.rendition === "original";
      const isOldVersion = oldVersionIds.has(object.assetVersionId);
      if (mode === "delete-original") return isCurrentOriginal;
      if (mode === "clean-old-versions") return isOldVersion;
      return isCurrentOriginal || isOldVersion;
    };
    if (objects.some((object) => object.bucketRole === "private" && object.status === "deleting" && matchesMode(object))) {
      throw new Error("A storage cleanup is already in progress for this asset");
    }
    const targets = objects.filter(
      (object) => object.bucketRole === "private" &&
        (object.status === "ready" || object.status === "failed") &&
        matchesMode(object)
    );
    const now = Date.now();
    await Promise.all(targets.map((object) => ctx.db.patch(object._id, {
      status: "deleting",
      deletionClaimedAt: now,
      lastDeleteAttemptAt: now,
      deleteAttemptCount: (object.deleteAttemptCount ?? 0) + 1,
      deleteError: undefined,
      updatedAt: now,
    })));
    return targets.map((object) => ({
      storageObjectId: object._id,
      key: object.key,
    }));
  },
});

export const completePrivateAssetCleanup = internalMutation({
  args: {
    mediaAssetId: v.id("mediaAssets"),
    mode: vCleanupMode,
    results: v.array(v.object({
      storageObjectId: v.id("storageObjects"),
      ok: v.boolean(),
      errorMessage: v.optional(v.string()),
    })),
  },
  async handler(ctx, { mediaAssetId, mode, results }) {
    const mediaAsset = await ctx.db.get(mediaAssetId);
    if (!mediaAsset) throw new Error("Library asset no longer exists");
    const now = Date.now();
    const versionIds = new Set<Id<"assetVersions">>();
    let deleted = 0;
    let failed = 0;
    for (const result of results) {
      const object = await ctx.db.get(result.storageObjectId);
      if (!object || object.mediaAssetId !== mediaAssetId || object.status !== "deleting") continue;
      versionIds.add(object.assetVersionId);
      if (result.ok) {
        deleted += 1;
        await ctx.db.patch(object._id, {
          status: "deleted",
          publicUrl: undefined,
          deletionClaimedAt: undefined,
          nextDeleteAttemptAt: undefined,
          deleteError: undefined,
          deletedAt: now,
          updatedAt: now,
        });
        if (object.legacyAssetId) {
          await ctx.db.patch(object.legacyAssetId, { status: "deleted", publicUrl: undefined });
        }
      } else {
        failed += 1;
        await ctx.db.patch(object._id, {
          status: "ready",
          deletionClaimedAt: undefined,
          deleteError: (result.errorMessage ?? "R2 deletion failed").slice(0, 500),
          updatedAt: now,
        });
      }
    }

    for (const versionId of Array.from(versionIds)) {
      if (versionId === mediaAsset.currentVersionId) continue;
      const versionObjects = await ctx.db
        .query("storageObjects")
        .withIndex("by_assetVersionId", (q) => q.eq("assetVersionId", versionId))
        .collect();
      const privateObjects = versionObjects.filter((object) => object.bucketRole === "private");
      const hasLivePublicObject = versionObjects.some(
        (object) => object.bucketRole === "public" && object.status !== "deleted"
      );
      if (
        privateObjects.length > 0 &&
        privateObjects.every((object) => object.status === "deleted") &&
        !hasLivePublicObject
      ) {
        await ctx.db.patch(versionId, { status: "deleted", updatedAt: now });
      }
    }
    await reconcileAccountStorageUsage(ctx, mediaAsset.userId, now);
    await ctx.db.insert("userActivityEvents", {
      userId: mediaAsset.userId,
      eventType: "storage-cleanup",
      entityType: "mediaAsset",
      entityId: mediaAssetId,
      summary: mode === "delete-original"
        ? "Deleted an Original asset"
        : mode === "clean-old-versions"
          ? "Cleaned old asset versions"
          : "Applied Space Saver",
      metadataJson: JSON.stringify({ mode, deleted, failed }),
      occurredAt: now,
    });
    return { deleted, failed };
  },
});
