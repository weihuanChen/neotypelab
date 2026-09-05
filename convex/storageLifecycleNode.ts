"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getR2ConnectionConfig } from "./r2Config";
import {
  deleteR2Object,
  ensureTemporaryOriginalLifecycleFallback,
  listR2Objects,
} from "./r2Storage";

const ORPHAN_SCAN_PREFIXES = [
  "temporary-originals/",
  "pinned-originals/",
  "library/",
] as const;
const ORPHAN_PAGE_SIZE = 100;
const MAX_ORPHAN_PAGES_PER_PREFIX = 10;

type ClaimedObject = {
  storageObjectId: Id<"storageObjects">;
  userId: Id<"users">;
  assetVersionId: Id<"assetVersions">;
  key: string;
  bucketRole: "private";
  attempt: number;
};

export const runExpirationSweep = internalAction({
  args: {},
  async handler(ctx): Promise<{ claimed: number; deleted: number; failed: number }> {
    await ctx.runMutation(internal.storageAccounting.releaseExpiredReservations, {});
    const objects: ClaimedObject[] = await ctx.runMutation(
      internal.storageLifecycle.claimExpiredObjects,
      {}
    );
    if (objects.length === 0) {
      return { claimed: 0, deleted: 0, failed: 0 };
    }
    const deletions = await Promise.allSettled(
      objects.map((object) => deleteR2Object("private", object.key))
    );
    const result: { deleted: number; failed: number; accountsReconciled: number } =
      await ctx.runMutation(internal.storageLifecycle.completeDeletionBatch, {
        results: objects.map((object, index) => {
          const deletion = deletions[index];
          return deletion.status === "fulfilled"
            ? { storageObjectId: object.storageObjectId, ok: true }
            : {
                storageObjectId: object.storageObjectId,
                ok: false,
                errorMessage:
                  deletion.reason instanceof Error
                    ? deletion.reason.message
                    : "R2 deletion did not complete",
              };
        }),
      });
    return { claimed: objects.length, deleted: result.deleted, failed: result.failed };
  },
});

export const auditPrivateStorageOrphans = internalAction({
  args: {},
  async handler(ctx): Promise<{
    scanned: number;
    detected: number;
    resolved: number;
    truncated: boolean;
  }> {
    let scanned = 0;
    let detected = 0;
    let resolved = 0;
    let truncated = false;
    const privateBucket = getR2ConnectionConfig().buckets.private;
    for (const prefix of ORPHAN_SCAN_PREFIXES) {
      const cursor = await ctx.runQuery(internal.storageLifecycle.getOrphanAuditCursor, {
        bucket: privateBucket,
        prefix,
      });
      let continuationToken = cursor?.continuationToken;
      let pages = 0;
      do {
        const page = await listR2Objects({
          role: "private",
          prefix,
          continuationToken,
          maxKeys: ORPHAN_PAGE_SIZE,
        });
        scanned += page.keys.length;
        if (page.keys.length > 0) {
          const missingKeys = await ctx.runQuery(
            internal.storageLifecycle.findMissingStorageKeys,
            { bucket: page.bucket, keys: page.keys }
          );
          const recorded = await ctx.runMutation(
            internal.storageLifecycle.recordOrphanScan,
            {
              bucketRole: "private",
              bucket: page.bucket,
              scannedKeys: page.keys,
              missingKeys,
            }
          );
          detected += recorded.detected;
          resolved += recorded.resolved;
        }
        continuationToken = page.nextContinuationToken;
        pages += 1;
      } while (continuationToken && pages < MAX_ORPHAN_PAGES_PER_PREFIX);
      if (continuationToken) truncated = true;
      await ctx.runMutation(internal.storageLifecycle.saveOrphanAuditCursor, {
        bucketRole: "private",
        bucket: privateBucket,
        prefix,
        continuationToken,
      });
    }
    return { scanned, detected, resolved, truncated };
  },
});

export const configureTemporaryOriginalFallback = internalAction({
  args: {
    days: v.optional(v.number()),
  },
  async handler(_ctx, { days }): Promise<{ bucket: string; id: string; days: number }> {
    return await ensureTemporaryOriginalLifecycleFallback(days ?? 365);
  },
});
