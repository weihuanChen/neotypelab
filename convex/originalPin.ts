import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./functions";
import { resolveEffectiveEntitlements } from "./entitlements";
import { reconcileAccountStorageUsage } from "./storageAccounting";
import { buildPinnedOriginalKey, originalPinCreditCost } from "./originalPinPolicy";

const STALE_PIN_OPERATION_MS = 30 * 60 * 1000;

export const quote = query({
  args: { storageObjectId: v.id("storageObjects") },
  async handler(ctx, { storageObjectId }) {
    if (ctx.viewer === null) return null;
    const viewer = ctx.viewerX();
    const object = await ctx.db.get(storageObjectId);
    if (!object || object.userId !== viewer._id || object.bucketRole !== "private" || object.rendition !== "original") {
      return null;
    }
    const [entitlements, account, usage, heldGeneration, pendingPins, currentOperation] = await Promise.all([
      resolveEffectiveEntitlements(ctx, viewer._id),
      ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", viewer._id)).unique(),
      ctx.db.query("accountStorageUsage").withIndex("by_userId", (q) => q.eq("userId", viewer._id)).unique(),
      ctx.db.query("storageReservations").withIndex("by_user_status", (q) => q.eq("userId", viewer._id).eq("status", "held")).collect(),
      ctx.db.query("originalPinOperations").withIndex("by_user_status", (q) => q.eq("userId", viewer._id).eq("status", "pending")).collect(),
      ctx.db.query("originalPinOperations").withIndex("by_storageObjectId", (q) => q.eq("storageObjectId", storageObjectId)).order("desc").first(),
    ]);
    const alreadyPinned = object.accountingCategory === "pinned-original" || object.retentionPolicy === "permanent-original";
    let creditCost: number | null = null;
    let sizeError: string | null = null;
    try {
      creditCost = originalPinCreditCost(object.byteSize ?? 0);
    } catch (error) {
      sizeError = error instanceof Error ? error.message : "Original cannot be pinned";
    }
    const now = Date.now();
    const reservedBytes = heldGeneration
      .filter((reservation) => reservation.heldUntil >= now)
      .reduce((sum, reservation) => sum + reservation.pinnedOriginalBytes, 0) +
      pendingPins.reduce((sum, operation) => sum + operation.byteSize, 0);
    const usedBytes = usage?.pinnedOriginalUsedBytes ?? 0;
    const quotaBytes = entitlements.pinnedOriginalQuotaBytes;
    const availableBytes = Math.max(0, quotaBytes - usedBytes - reservedBytes);
    const reason = alreadyPinned
      ? "Original is already kept"
      : currentOperation?.status === "pending"
        ? "Keep Original is already in progress"
      : !entitlements.originalPinAllowed
        ? "Keeping Originals is not included in the current entitlement"
        : object.status !== "ready"
          ? "Original is not ready"
          : sizeError
            ? sizeError
            : (object.byteSize ?? 0) > availableBytes
              ? "Pinned Original storage quota is full"
              : (account?.balance ?? 0) < (creditCost ?? Number.POSITIVE_INFINITY)
                ? "Not enough credits"
                : null;
    return {
      eligible: reason === null,
      alreadyPinned,
      reason,
      creditCost,
      byteSize: object.byteSize ?? 0,
      balance: account?.balance ?? 0,
      usedBytes,
      reservedBytes,
      quotaBytes,
      availableBytes,
    };
  },
});

export const authorizePinSource = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    storageObjectId: v.id("storageObjects"),
  },
  async handler(ctx, { storageObjectId, tokenIdentifier }) {
    const viewer = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier)).unique();
    if (!viewer) throw new Error("Authentication is required");
    const object = await ctx.db.get(storageObjectId);
    if (!object || object.userId !== viewer._id || object.bucketRole !== "private" || object.rendition !== "original") {
      throw new Error("Original asset not found or access denied");
    }
    if (object.accountingCategory === "pinned-original" || object.retentionPolicy === "permanent-original") {
      return { status: "already-pinned" as const };
    }
    if (object.status !== "ready") throw new Error("Original asset is not ready");
    return { status: "ready" as const, key: object.key };
  },
});

export const begin = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    storageObjectId: v.id("storageObjects"),
    verifiedByteSize: v.number(),
    expectedCreditCost: v.number(),
  },
  async handler(ctx, { expectedCreditCost, storageObjectId, tokenIdentifier, verifiedByteSize }) {
    const viewer = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier)).unique();
    if (!viewer) throw new Error("Authentication is required");
    const object = await ctx.db.get(storageObjectId);
    if (!object || object.userId !== viewer._id || object.bucketRole !== "private" || object.rendition !== "original") {
      throw new Error("Original asset not found or access denied");
    }
    if (object.accountingCategory === "pinned-original" || object.retentionPolicy === "permanent-original") {
      return { status: "already-pinned" as const };
    }
    if (object.status !== "ready") throw new Error("Original asset is not ready");
    const entitlements = await resolveEffectiveEntitlements(ctx, viewer._id);
    if (!entitlements.originalPinAllowed) {
      throw new Error("Keeping Originals is not included in the current entitlement");
    }
    const creditCost = originalPinCreditCost(verifiedByteSize);
    if (!Number.isInteger(expectedCreditCost) || expectedCreditCost !== creditCost) {
      throw new Error("Original size or Keep Original price changed. Review the updated quote before continuing.");
    }
    const currentOperation = await ctx.db
      .query("originalPinOperations")
      .withIndex("by_storageObjectId", (q) => q.eq("storageObjectId", storageObjectId))
      .order("desc")
      .first();
    if (currentOperation?.status === "completed") return { status: "already-pinned" as const };
    if (currentOperation?.status === "pending") throw new Error("Keep Original is already in progress");

    await reconcileAccountStorageUsage(ctx, viewer._id);
    const [usage, account] = await Promise.all([
      ctx.db.query("accountStorageUsage").withIndex("by_userId", (q) => q.eq("userId", viewer._id)).unique(),
      ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", viewer._id)).unique(),
    ]);
    if (!usage) throw new Error("Storage usage account could not be initialized");
    if (!account || account.balance < creditCost) throw new Error("Not enough credits");
    if (usage.pinnedOriginalUsedBytes + usage.pinnedOriginalReservedBytes + verifiedByteSize > entitlements.pinnedOriginalQuotaBytes) {
      throw new Error("Pinned Original storage quota is full");
    }

    const now = Date.now();
    const destinationKey = buildPinnedOriginalKey({
      userId: viewer._id,
      mediaAssetId: object.mediaAssetId,
      assetVersionId: object.assetVersionId,
      sourceKey: object.key,
    });
    const operationId = await ctx.db.insert("originalPinOperations", {
      userId: viewer._id,
      storageObjectId,
      status: "pending",
      sourceKey: object.key,
      destinationKey,
      byteSize: verifiedByteSize,
      creditCost,
      createdAt: now,
      updatedAt: now,
    });
    const balanceAfter = account.balance - creditCost;
    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeSpent: account.lifetimeSpent + creditCost,
      lastCreditEventAt: now,
    });
    const debitTransactionId = await ctx.db.insert("creditTransactions", {
      userId: viewer._id,
      actionType: "keep-original",
      delta: -creditCost,
      creditAmount: creditCost,
      balanceAfter,
      referenceTable: "originalPinOperations",
      referenceId: operationId,
      description: `Keep Original (${formatBytes(verifiedByteSize)})`,
      sourceType: "storage-spend",
    });
    await ctx.db.patch(operationId, { debitTransactionId });
    await reconcileAccountStorageUsage(ctx, viewer._id, now);
    return {
      status: "pending" as const,
      operationId,
      sourceKey: object.key,
      destinationKey,
      contentType: object.contentType ?? "application/octet-stream",
      creditCost,
    };
  },
});

export const complete = internalMutation({
  args: {
    operationId: v.id("originalPinOperations"),
    etag: v.optional(v.string()),
  },
  async handler(ctx, { etag, operationId }) {
    const operation = await ctx.db.get(operationId);
    if (!operation) throw new Error("Keep Original operation not found");
    if (operation.status === "completed") return { status: "completed" as const };
    if (operation.status !== "pending" || !operation.debitTransactionId) {
      throw new Error("Keep Original operation is no longer pending");
    }
    const object = await ctx.db.get(operation.storageObjectId);
    if (!object || object.userId !== operation.userId || object.status !== "ready") {
      throw new Error("Original asset changed while it was being pinned");
    }
    const now = Date.now();
    await ctx.db.patch(object._id, {
      key: operation.destinationKey,
      byteSize: operation.byteSize,
      etag,
      accountingCategory: "pinned-original",
      retentionPolicy: "permanent-original",
      retentionDaysSnapshot: undefined,
      retainUntil: undefined,
      nextDeleteAttemptAt: undefined,
      pinCreditTransactionId: operation.debitTransactionId,
      pinnedAt: now,
      updatedAt: now,
    });
    if (object.legacyAssetId) {
      await ctx.db.patch(object.legacyAssetId, {
        key: operation.destinationKey,
        byteSize: operation.byteSize,
        etag,
      });
    }
    await ctx.db.patch(operationId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      errorMessage: undefined,
    });
    await reconcileAccountStorageUsage(ctx, operation.userId, now);
    await writePinActivity(ctx, operation.userId, object.mediaAssetId, operationId, operation.creditCost, "completed");
    return { status: "completed" as const };
  },
});

export const fail = internalMutation({
  args: {
    operationId: v.id("originalPinOperations"),
    errorMessage: v.string(),
  },
  async handler(ctx, { errorMessage, operationId }) {
    const operation = await ctx.db.get(operationId);
    if (!operation) throw new Error("Keep Original operation not found");
    if (operation.status === "failed") return { status: "failed" as const, refunded: operation.refundTransactionId !== undefined };
    if (operation.status === "completed") return { status: "completed" as const, refunded: false };
    return await refundPendingOperation(ctx, operation, errorMessage);
  },
});

export const refundStale = internalMutation({
  args: {},
  async handler(ctx) {
    const cutoff = Date.now() - STALE_PIN_OPERATION_MS;
    const stale = await ctx.db
      .query("originalPinOperations")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending").lt("updatedAt", cutoff))
      .take(100);
    let refunded = 0;
    for (const operation of stale) {
      await refundPendingOperation(ctx, operation, "Keep Original timed out before storage migration completed");
      refunded += 1;
    }
    return { refunded };
  },
});

async function refundPendingOperation(
  ctx: Parameters<typeof reconcileAccountStorageUsage>[0],
  operation: Doc<"originalPinOperations">,
  errorMessage: string
) {
  if (!operation.debitTransactionId) throw new Error("Keep Original debit transaction is missing");
  const account = await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", operation.userId)).unique();
  if (!account) throw new Error("Credit account not found while refunding Keep Original");
  const now = Date.now();
  const balanceAfter = account.balance + operation.creditCost;
  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    lifetimeSpent: Math.max(0, account.lifetimeSpent - operation.creditCost),
    lastCreditEventAt: now,
  });
  const refundTransactionId = await ctx.db.insert("creditTransactions", {
    userId: operation.userId,
    actionType: "keep-original-refund",
    delta: operation.creditCost,
    creditAmount: operation.creditCost,
    balanceAfter,
    referenceTable: "originalPinOperations",
    referenceId: operation._id,
    description: "Refunded failed Keep Original operation",
    sourceType: "refund",
  });
  await ctx.db.patch(operation._id, {
    status: "failed",
    refundTransactionId,
    errorMessage: errorMessage.slice(0, 500),
    failedAt: now,
    updatedAt: now,
  });
  await reconcileAccountStorageUsage(ctx, operation.userId, now);
  const object = await ctx.db.get(operation.storageObjectId);
  if (object) await writePinActivity(ctx, operation.userId, object.mediaAssetId, operation._id, operation.creditCost, "failed");
  return { status: "failed" as const, refunded: true };
}

async function writePinActivity(
  ctx: Parameters<typeof reconcileAccountStorageUsage>[0],
  userId: Id<"users">,
  mediaAssetId: Id<"mediaAssets">,
  operationId: Id<"originalPinOperations">,
  creditCost: number,
  status: "completed" | "failed"
) {
  await ctx.db.insert("userActivityEvents", {
    userId,
    eventType: status === "completed" ? "original-pinned" : "original-pin-refunded",
    entityType: "mediaAsset",
    entityId: mediaAssetId,
    summary: status === "completed" ? "Kept an Original with credits" : "Refunded a failed Keep Original operation",
    metadataJson: JSON.stringify({ operationId, creditCost }),
    occurredAt: Date.now(),
    idempotencyKey: `original-pin:${operationId}:${status}`,
  });
}

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 ** 2 * 10) / 10} MB`;
}
