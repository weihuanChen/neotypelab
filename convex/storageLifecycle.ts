import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./functions";
import { resolveEffectiveEntitlements } from "./entitlements";
import { reconcileAccountStorageUsage } from "./storageAccounting";
import type { StorageRetentionPolicy } from "./domain";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DELETE_CLAIM_MS = 30 * 60 * 1000;
const MAX_DELETE_BATCH = 100;

export const claimExpiredObjects = internalMutation({
  args: {},
  async handler(ctx) {
    const now = Date.now();
    const staleDeleting = await ctx.db
      .query("storageObjects")
      .withIndex("by_status", (q) => q.eq("status", "deleting"))
      .take(MAX_DELETE_BATCH);
    await Promise.all(
      staleDeleting
        .filter(
          (object) =>
            object.deletionClaimedAt !== undefined &&
            object.deletionClaimedAt < now - STALE_DELETE_CLAIM_MS
        )
        .map((object) =>
          ctx.db.patch(object._id, {
            status: "ready",
            nextDeleteAttemptAt: now,
            deletionClaimedAt: undefined,
            deleteError: "Recovered a stale deletion claim",
            updatedAt: now,
          })
        )
    );

    const candidates = await ctx.db
      .query("storageObjects")
      .withIndex("by_status_nextDeleteAttemptAt", (q) =>
        q.eq("status", "ready").lte("nextDeleteAttemptAt", now)
      )
      .take(MAX_DELETE_BATCH);
    const claimed = [];
    for (const object of candidates) {
      if (
        object.bucketRole !== "private" ||
        (object.retentionPolicy !== "temporary-original" &&
          object.retentionPolicy !== "version-history") ||
        object.retainUntil === undefined ||
        object.retainUntil > now
      ) {
        continue;
      }
      const mediaAsset = await ctx.db.get(object.mediaAssetId);
      if (
        mediaAsset?.currentVersionId === object.assetVersionId &&
        object.rendition !== "original"
      ) {
        await ctx.db.patch(object._id, {
          retentionPolicy: "current-version",
          retentionDaysSnapshot: undefined,
          retainUntil: undefined,
          nextDeleteAttemptAt: undefined,
          deleteError: undefined,
          updatedAt: now,
        });
        continue;
      }
      await ctx.db.patch(object._id, {
        status: "deleting",
        deletionClaimedAt: now,
        lastDeleteAttemptAt: now,
        deleteAttemptCount: (object.deleteAttemptCount ?? 0) + 1,
        deleteError: undefined,
        updatedAt: now,
      });
      claimed.push({
        storageObjectId: object._id,
        userId: object.userId,
        assetVersionId: object.assetVersionId,
        key: object.key,
        bucketRole: object.bucketRole,
        attempt: (object.deleteAttemptCount ?? 0) + 1,
      });
    }
    return claimed;
  },
});

export const completeDeletionBatch = internalMutation({
  args: {
    results: v.array(v.object({
      storageObjectId: v.id("storageObjects"),
      ok: v.boolean(),
      errorMessage: v.optional(v.string()),
    })),
  },
  async handler(ctx, { results }) {
    const now = Date.now();
    const users = new Set<Id<"users">>();
    const versions = new Set<Id<"assetVersions">>();
    let deleted = 0;
    let failed = 0;
    for (const result of results) {
      const object = await ctx.db.get(result.storageObjectId);
      if (!object || object.status !== "deleting") continue;
      users.add(object.userId);
      versions.add(object.assetVersionId);
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
      } else {
        failed += 1;
        const attempt = object.deleteAttemptCount ?? 1;
        const retryDelayMs = Math.min(24 * 60 * 60 * 1000, 60_000 * 2 ** Math.min(10, attempt - 1));
        await ctx.db.patch(object._id, {
          status: "ready",
          deletionClaimedAt: undefined,
          nextDeleteAttemptAt: now + retryDelayMs,
          deleteError: (result.errorMessage ?? "R2 deletion failed").slice(0, 500),
          updatedAt: now,
        });
      }
    }

    for (const versionId of Array.from(versions)) {
      const objects = await ctx.db
        .query("storageObjects")
        .withIndex("by_assetVersionId", (q) => q.eq("assetVersionId", versionId))
        .collect();
      const privateObjects = objects.filter((object) => object.bucketRole === "private");
      if (
        privateObjects.length > 0 &&
        privateObjects.every((object) => object.status === "deleted")
      ) {
        await ctx.db.patch(versionId, { status: "deleted", updatedAt: now });
      }
    }
    for (const userId of Array.from(users)) {
      await reconcileAccountStorageUsage(ctx, userId, now);
    }
    return { deleted, failed, accountsReconciled: users.size };
  },
});

export const findMissingStorageKeys = internalQuery({
  args: {
    bucket: v.string(),
    keys: v.array(v.string()),
  },
  async handler(ctx, { bucket, keys }) {
    const missing: string[] = [];
    for (const key of keys) {
      const record = await ctx.db
        .query("storageObjects")
        .withIndex("by_bucket_key", (q) => q.eq("bucket", bucket).eq("key", key))
        .first();
      if (!record || record.status === "deleted") missing.push(key);
    }
    return missing;
  },
});

export const recordOrphanScan = internalMutation({
  args: {
    bucketRole: v.union(v.literal("public"), v.literal("private")),
    bucket: v.string(),
    scannedKeys: v.array(v.string()),
    missingKeys: v.array(v.string()),
  },
  async handler(ctx, { bucketRole, bucket, scannedKeys, missingKeys }) {
    const now = Date.now();
    const missing = new Set(missingKeys);
    let detected = 0;
    let resolved = 0;
    for (const key of scannedKeys) {
      const reports = await ctx.db
        .query("storageOrphanReports")
        .withIndex("by_bucket_key", (q) => q.eq("bucket", bucket).eq("key", key))
        .collect();
      const current = reports.find((report) => report.status === "detected");
      if (missing.has(key)) {
        detected += 1;
        if (current) {
          await ctx.db.patch(current._id, { lastSeenAt: now });
        } else {
          await ctx.db.insert("storageOrphanReports", {
            bucketRole,
            bucket,
            key,
            status: "detected",
            firstDetectedAt: now,
            lastSeenAt: now,
          });
        }
      } else if (current) {
        resolved += 1;
        await ctx.db.patch(current._id, {
          status: "resolved",
          lastSeenAt: now,
          resolvedAt: now,
        });
      }
    }
    return { detected, resolved };
  },
});

export const getOrphanAuditCursor = internalQuery({
  args: {
    bucket: v.string(),
    prefix: v.string(),
  },
  async handler(ctx, { bucket, prefix }) {
    return await ctx.db
      .query("storageAuditCursors")
      .withIndex("by_bucket_prefix", (q) => q.eq("bucket", bucket).eq("prefix", prefix))
      .unique();
  },
});

export const saveOrphanAuditCursor = internalMutation({
  args: {
    bucketRole: v.union(v.literal("public"), v.literal("private")),
    bucket: v.string(),
    prefix: v.string(),
    continuationToken: v.optional(v.string()),
  },
  async handler(ctx, { bucketRole, bucket, prefix, continuationToken }) {
    const existing = await ctx.db
      .query("storageAuditCursors")
      .withIndex("by_bucket_prefix", (q) => q.eq("bucket", bucket).eq("prefix", prefix))
      .unique();
    const now = Date.now();
    const value = {
      bucketRole,
      bucket,
      prefix,
      continuationToken,
      updatedAt: now,
      completedAt: continuationToken === undefined ? now : undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
      return existing._id;
    }
    return await ctx.db.insert("storageAuditCursors", value);
  },
});

export const backfillRetentionBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, { paginationOpts }) {
    const page = await ctx.db.query("storageObjects").paginate(paginationOpts);
    const now = Date.now();
    const entitlementCache = new Map<Id<"users">, Awaited<ReturnType<typeof resolveEffectiveEntitlements>>>();
    let updated = 0;
    for (const object of page.page) {
      if (object.retentionPolicy !== undefined) continue;
      let retentionPolicy: StorageRetentionPolicy = "unmanaged";
      let retentionDaysSnapshot: number | undefined;
      let retainUntil: number | undefined;
      let accountingCategory = object.accountingCategory;
      if (object.bucketRole === "public") {
        retentionPolicy = "publication";
        accountingCategory = "unmetered";
      } else if (object.bucketRole === "private") {
        let entitlements = entitlementCache.get(object.userId);
        if (!entitlements) {
          entitlements = await resolveEffectiveEntitlements(ctx, object.userId, now);
          entitlementCache.set(object.userId, entitlements);
        }
        const mediaAsset = await ctx.db.get(object.mediaAssetId);
        const isCurrent = mediaAsset?.currentVersionId === object.assetVersionId;
        if (object.rendition === "original") {
          const permanent = object.accountingCategory === "pinned-original" ||
            entitlements.originalPermanentStorage;
          retentionPolicy = permanent ? "permanent-original" : "temporary-original";
          accountingCategory = permanent ? "pinned-original" : "temporary-original";
          retentionDaysSnapshot = entitlements.originalRetentionDays;
          retainUntil = permanent
            ? undefined
            : object.createdAt + entitlements.originalRetentionDays * DAY_MS;
        } else if (isCurrent) {
          retentionPolicy = "current-version";
          accountingCategory = "optimized";
        } else {
          retentionPolicy = "version-history";
          accountingCategory = "optimized";
          retentionDaysSnapshot = entitlements.versionRetentionDays;
          retainUntil = object.createdAt + entitlements.versionRetentionDays * DAY_MS;
        }
        const version = await ctx.db.get(object.assetVersionId);
        if (version && version.retentionDaysSnapshot === undefined) {
          await ctx.db.patch(version._id, {
            retentionDaysSnapshot: entitlements.versionRetentionDays,
            updatedAt: now,
          });
        }
      } else {
        accountingCategory = "unmetered";
      }
      await ctx.db.patch(object._id, {
        accountingCategory,
        retentionPolicy,
        retentionDaysSnapshot,
        retainUntil,
        nextDeleteAttemptAt: retainUntil,
        updatedAt: now,
      });
      updated += 1;
    }
    return {
      processed: page.page.length,
      updated,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
