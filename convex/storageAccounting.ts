import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx as BaseMutationCtx } from "./_generated/server";
import { internalMutation, query } from "./functions";
import { resolveEffectiveEntitlements } from "./entitlements";
import type { StorageAccountingCategory } from "./domain";

const MIB = 1024 ** 2;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

export const GENERATION_STORAGE_ESTIMATE = {
  optimizedBytes: 8 * MIB,
  temporaryOriginalBytes: 16 * MIB,
  pinnedOriginalBytes: 0,
} as const;

type StorageAmounts = {
  optimizedBytes: number;
  temporaryOriginalBytes: number;
  pinnedOriginalBytes: number;
};

export const viewerUsage = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) return null;
    const userId = ctx.viewerX()._id;
    const now = Date.now();
    const [usage, entitlements, heldReservations, pendingPins] = await Promise.all([
      ctx.db
        .query("accountStorageUsage")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
      resolveEffectiveEntitlements(ctx, userId),
      ctx.db
        .query("storageReservations")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "held"))
        .collect(),
      ctx.db
        .query("originalPinOperations")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
        .collect(),
    ]);
    const activeReserved = heldReservations
      .filter((reservation) => reservation.heldUntil >= now)
      .reduce(
        (total, reservation) => addAmounts(total, reservationAmounts(reservation)),
        zeroAmounts()
      );
    activeReserved.pinnedOriginalBytes += pendingPins.reduce(
      (sum, operation) => sum + checkedBytes(operation.byteSize),
      0
    );
    return buildUsageResponse(
      {
        ...(usage ?? emptyUsage(userId)),
        optimizedReservedBytes: activeReserved.optimizedBytes,
        temporaryOriginalReservedBytes: activeReserved.temporaryOriginalBytes,
        pinnedOriginalReservedBytes: activeReserved.pinnedOriginalBytes,
      },
      entitlements
    );
  },
});

export const reserveGenerationStorage = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  async handler(ctx, { generationJobId }) {
    const job = await ctx.db.get(generationJobId);
    if (!job) throw new Error("Generation job not found while reserving storage");
    return await reserveGenerationStorageForJob(ctx, job.userId, generationJobId);
  },
});

export const adjustGenerationStorageReservation = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
    optimizedBytes: v.number(),
    originalBytes: v.number(),
  },
  async handler(ctx, { generationJobId, optimizedBytes, originalBytes }) {
    const job = await ctx.db.get(generationJobId);
    if (!job) throw new Error("Generation job not found while adjusting storage");
    const reservation = await ctx.db
      .query("storageReservations")
      .withIndex("by_generationJobId", (q) => q.eq("generationJobId", generationJobId))
      .unique();
    if (!reservation || reservation.status !== "held") {
      throw new Error("Generation storage reservation is not held");
    }
    const pinned = reservation.pinnedOriginalBytes > 0;
    const result = await holdGenerationReservation(ctx, job.userId, generationJobId, {
      optimizedBytes: checkedBytes(optimizedBytes),
      temporaryOriginalBytes: pinned ? 0 : checkedBytes(originalBytes),
      pinnedOriginalBytes: pinned ? checkedBytes(originalBytes) : 0,
    });
    return {
      ...result,
      originalAccountingCategory: pinned
        ? ("pinned-original" as const)
        : ("temporary-original" as const),
    };
  },
});

export const releaseGenerationStorageReservation = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  async handler(ctx, { generationJobId }) {
    const reservation = await ctx.db
      .query("storageReservations")
      .withIndex("by_generationJobId", (q) => q.eq("generationJobId", generationJobId))
      .unique();
    if (!reservation || reservation.status !== "held") return false;
    const now = Date.now();
    await ctx.db.patch(reservation._id, {
      status: "released",
      releasedAt: now,
      updatedAt: now,
    });
    await reconcileAccountStorageUsage(ctx, reservation.userId, now);
    return true;
  },
});

export const reconcileAccount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  async handler(ctx, { userId }) {
    return await reconcileAccountStorageUsage(ctx, userId, Date.now());
  },
});

export const reconcileAccountsBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, { paginationOpts }) {
    const page = await ctx.db.query("users").paginate(paginationOpts);
    for (const user of page.page) {
      await reconcileAccountStorageUsage(ctx, user._id, Date.now());
    }
    return {
      processed: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

export const releaseExpiredReservations = internalMutation({
  args: {},
  async handler(ctx) {
    const now = Date.now();
    const expired = await ctx.db
      .query("storageReservations")
      .withIndex("by_status_heldUntil", (q) =>
        q.eq("status", "held").lt("heldUntil", now)
      )
      .take(100);
    const users = new Set<Id<"users">>();
    for (const reservation of expired) {
      users.add(reservation.userId);
      await ctx.db.patch(reservation._id, {
        status: "released",
        releasedAt: now,
        updatedAt: now,
      });
    }
    for (const userId of Array.from(users)) {
      await reconcileAccountStorageUsage(ctx, userId, now);
    }
    return { released: expired.length, accounts: users.size };
  },
});

export async function settleGenerationStorageReservation(
  ctx: BaseMutationCtx,
  generationJobId: Id<"generationJobs">,
  actual: { optimizedBytes: number; originalBytes: number }
) {
  const reservation = await ctx.db
    .query("storageReservations")
    .withIndex("by_generationJobId", (q) => q.eq("generationJobId", generationJobId))
    .unique();
  if (!reservation) {
    throw new Error("Generation storage reservation is missing");
  }
  if (reservation.status === "settled") return reservation._id;
  if (reservation.status !== "held") {
    throw new Error("Generation storage reservation is no longer held");
  }
  const now = Date.now();
  await ctx.db.patch(reservation._id, {
    status: "settled",
    actualOptimizedBytes: checkedBytes(actual.optimizedBytes),
    actualTemporaryOriginalBytes:
      reservation.pinnedOriginalBytes > 0 ? 0 : checkedBytes(actual.originalBytes),
    actualPinnedOriginalBytes:
      reservation.pinnedOriginalBytes > 0 ? checkedBytes(actual.originalBytes) : 0,
    settledAt: now,
    updatedAt: now,
  });
  await reconcileAccountStorageUsage(ctx, reservation.userId, now);
  return reservation._id;
}

export async function reserveGenerationStorageForJob(
  ctx: BaseMutationCtx,
  userId: Id<"users">,
  generationJobId: Id<"generationJobs">
) {
  const entitlements = await resolveEffectiveEntitlements(ctx, userId);
  const requested: StorageAmounts = entitlements.originalPermanentStorage
    ? {
        optimizedBytes: GENERATION_STORAGE_ESTIMATE.optimizedBytes,
        temporaryOriginalBytes: 0,
        pinnedOriginalBytes: GENERATION_STORAGE_ESTIMATE.temporaryOriginalBytes,
      }
    : GENERATION_STORAGE_ESTIMATE;
  return await holdGenerationReservation(
    ctx,
    userId,
    generationJobId,
    requested
  );
}

export async function assertPrivateStorageAdditionAllowed(
  ctx: BaseMutationCtx,
  userId: Id<"users">,
  requested: Partial<StorageAmounts>
) {
  const now = Date.now();
  await reconcileAccountStorageUsage(ctx, userId, now);
  const [usage, entitlements, held, pendingPins] = await Promise.all([
    ctx.db
      .query("accountStorageUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
    resolveEffectiveEntitlements(ctx, userId, now),
    ctx.db
      .query("storageReservations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "held"))
      .collect(),
    ctx.db
      .query("originalPinOperations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
      .collect(),
  ]);
  if (!usage) throw new Error("Storage usage account could not be initialized");
  const reserved = held
    .filter((reservation) => reservation.heldUntil >= now)
    .reduce((total, reservation) => addAmounts(total, reservationAmounts(reservation)), zeroAmounts());
  reserved.pinnedOriginalBytes += pendingPins.reduce(
    (sum, operation) => sum + checkedBytes(operation.byteSize),
    0
  );
  assertWithinQuota({
    used: usageAmounts(usage),
    reserved,
    requested: {
      optimizedBytes: checkedBytes(requested.optimizedBytes ?? 0),
      temporaryOriginalBytes: checkedBytes(requested.temporaryOriginalBytes ?? 0),
      pinnedOriginalBytes: checkedBytes(requested.pinnedOriginalBytes ?? 0),
    },
    quotas: {
      optimizedBytes: entitlements.libraryQuotaBytes,
      temporaryOriginalBytes: entitlements.temporaryOriginalQuotaBytes,
      pinnedOriginalBytes: entitlements.pinnedOriginalQuotaBytes,
    },
  });
}

export async function reconcileAccountStorageUsage(
  ctx: BaseMutationCtx,
  userId: Id<"users">,
  now = Date.now()
) {
  await releaseExpiredUserReservations(ctx, userId, now);
  const [objects, heldReservations, pendingPins, existing] = await Promise.all([
    ctx.db
      .query("storageObjects")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("storageReservations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "held"))
      .collect(),
    ctx.db
      .query("originalPinOperations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
      .collect(),
    ctx.db
      .query("accountStorageUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
  ]);
  const used = sumStorageObjects(objects);
  const reserved = heldReservations
    .filter((reservation) => reservation.heldUntil >= now)
    .reduce(
      (total, reservation) => addAmounts(total, reservationAmounts(reservation)),
      zeroAmounts()
    );
  reserved.pinnedOriginalBytes += pendingPins.reduce(
    (sum, operation) => sum + checkedBytes(operation.byteSize),
    0
  );
  const record = {
    optimizedUsedBytes: used.optimizedBytes,
    temporaryOriginalUsedBytes: used.temporaryOriginalBytes,
    pinnedOriginalUsedBytes: used.pinnedOriginalBytes,
    optimizedReservedBytes: reserved.optimizedBytes,
    temporaryOriginalReservedBytes: reserved.temporaryOriginalBytes,
    pinnedOriginalReservedBytes: reserved.pinnedOriginalBytes,
    updatedAt: now,
    reconciledAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, record);
    return { _id: existing._id, userId, ...record };
  }
  const id = await ctx.db.insert("accountStorageUsage", { userId, ...record });
  return { _id: id, userId, ...record };
}

async function holdGenerationReservation(
  ctx: BaseMutationCtx,
  userId: Id<"users">,
  generationJobId: Id<"generationJobs">,
  requested: StorageAmounts
) {
  const now = Date.now();
  await reconcileAccountStorageUsage(ctx, userId, now);
  const [usage, entitlements, existing, held, pendingPins] = await Promise.all([
    ctx.db
      .query("accountStorageUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
    resolveEffectiveEntitlements(ctx, userId, now),
    ctx.db
      .query("storageReservations")
      .withIndex("by_generationJobId", (q) => q.eq("generationJobId", generationJobId))
      .unique(),
    ctx.db
      .query("storageReservations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "held"))
      .collect(),
    ctx.db
      .query("originalPinOperations")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
      .collect(),
  ]);
  if (!usage) throw new Error("Storage usage account could not be initialized");
  if (existing?.status === "settled") {
    return { reservationId: existing._id, status: "settled" as const };
  }
  const otherReserved = held
    .filter((reservation) => reservation._id !== existing?._id && reservation.heldUntil >= now)
    .reduce(
      (total, reservation) => addAmounts(total, reservationAmounts(reservation)),
      zeroAmounts()
    );
  otherReserved.pinnedOriginalBytes += pendingPins.reduce(
    (sum, operation) => sum + checkedBytes(operation.byteSize),
    0
  );
  assertWithinQuota({
    used: usageAmounts(usage),
    reserved: otherReserved,
    requested,
    quotas: {
      optimizedBytes: entitlements.libraryQuotaBytes,
      temporaryOriginalBytes: entitlements.temporaryOriginalQuotaBytes,
      pinnedOriginalBytes: entitlements.pinnedOriginalQuotaBytes,
    },
  });
  const heldUntil = now + RESERVATION_TTL_MS;
  const reservationId = existing
    ? existing._id
    : await ctx.db.insert("storageReservations", {
        userId,
        generationJobId,
        status: "held",
        ...requested,
        heldUntil,
        createdAt: now,
        updatedAt: now,
      });
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "held",
      ...requested,
      actualOptimizedBytes: undefined,
      actualTemporaryOriginalBytes: undefined,
      actualPinnedOriginalBytes: undefined,
      heldUntil,
      settledAt: undefined,
      releasedAt: undefined,
      updatedAt: now,
    });
  }
  await reconcileAccountStorageUsage(ctx, userId, now);
  return { reservationId, status: "held" as const, heldUntil };
}

async function releaseExpiredUserReservations(
  ctx: BaseMutationCtx,
  userId: Id<"users">,
  now: number
) {
  const held = await ctx.db
    .query("storageReservations")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "held"))
    .collect();
  await Promise.all(
    held
      .filter((reservation) => reservation.heldUntil < now)
      .map((reservation) =>
        ctx.db.patch(reservation._id, {
          status: "released",
          releasedAt: now,
          updatedAt: now,
        })
      )
  );
}

function sumStorageObjects(objects: Doc<"storageObjects">[]) {
  return objects.reduce((total, object) => {
    if (
      object.bucketRole !== "private" ||
      (object.status !== "ready" && object.status !== "deleting")
    ) {
      return total;
    }
    const category = object.accountingCategory ?? inferAccountingCategory(object);
    const byteSize = checkedBytes(object.byteSize ?? 0);
    if (category === "optimized") total.optimizedBytes += byteSize;
    if (category === "temporary-original") total.temporaryOriginalBytes += byteSize;
    if (category === "pinned-original") total.pinnedOriginalBytes += byteSize;
    return total;
  }, zeroAmounts());
}

function inferAccountingCategory(
  object: Pick<Doc<"storageObjects">, "bucketRole" | "rendition">
): StorageAccountingCategory {
  if (object.bucketRole !== "private") return "unmetered";
  return object.rendition === "original" ? "temporary-original" : "optimized";
}

function assertWithinQuota({
  used,
  reserved,
  requested,
  quotas,
}: {
  used: StorageAmounts;
  reserved: StorageAmounts;
  requested: StorageAmounts;
  quotas: StorageAmounts;
}) {
  const checks = [
    ["Optimized Library", used.optimizedBytes, reserved.optimizedBytes, requested.optimizedBytes, quotas.optimizedBytes],
    ["Temporary Original", used.temporaryOriginalBytes, reserved.temporaryOriginalBytes, requested.temporaryOriginalBytes, quotas.temporaryOriginalBytes],
    ["Pinned Original", used.pinnedOriginalBytes, reserved.pinnedOriginalBytes, requested.pinnedOriginalBytes, quotas.pinnedOriginalBytes],
  ] as const;
  for (const [label, current, held, next, quota] of checks) {
    if (current + held + next > quota) {
      throw new Error(
        `${label} storage quota exceeded: ${formatBytes(current + held)} used or reserved, ${formatBytes(next)} required, ${formatBytes(quota)} available`
      );
    }
  }
}

function buildUsageResponse(
  usage: Doc<"accountStorageUsage"> | ReturnType<typeof emptyUsage>,
  entitlements: Awaited<ReturnType<typeof resolveEffectiveEntitlements>>
) {
  return {
    optimized: usageCategory(
      usage.optimizedUsedBytes,
      usage.optimizedReservedBytes,
      entitlements.libraryQuotaBytes
    ),
    temporaryOriginal: usageCategory(
      usage.temporaryOriginalUsedBytes,
      usage.temporaryOriginalReservedBytes,
      entitlements.temporaryOriginalQuotaBytes
    ),
    pinnedOriginal: usageCategory(
      usage.pinnedOriginalUsedBytes,
      usage.pinnedOriginalReservedBytes,
      entitlements.pinnedOriginalQuotaBytes
    ),
    updatedAt: usage.updatedAt,
    reconciledAt: usage.reconciledAt ?? null,
  };
}

function usageCategory(usedBytes: number, reservedBytes: number, quotaBytes: number) {
  return {
    usedBytes,
    reservedBytes,
    quotaBytes,
    availableBytes: Math.max(0, quotaBytes - usedBytes - reservedBytes),
    overQuota: usedBytes + reservedBytes > quotaBytes,
  };
}

function emptyUsage(userId: Id<"users">) {
  return {
    userId,
    optimizedUsedBytes: 0,
    temporaryOriginalUsedBytes: 0,
    pinnedOriginalUsedBytes: 0,
    optimizedReservedBytes: 0,
    temporaryOriginalReservedBytes: 0,
    pinnedOriginalReservedBytes: 0,
    updatedAt: 0,
    reconciledAt: undefined,
  };
}

function reservationAmounts(reservation: Doc<"storageReservations">): StorageAmounts {
  return {
    optimizedBytes: reservation.optimizedBytes,
    temporaryOriginalBytes: reservation.temporaryOriginalBytes,
    pinnedOriginalBytes: reservation.pinnedOriginalBytes,
  };
}

function usageAmounts(usage: Doc<"accountStorageUsage">): StorageAmounts {
  return {
    optimizedBytes: usage.optimizedUsedBytes,
    temporaryOriginalBytes: usage.temporaryOriginalUsedBytes,
    pinnedOriginalBytes: usage.pinnedOriginalUsedBytes,
  };
}

function zeroAmounts(): StorageAmounts {
  return { optimizedBytes: 0, temporaryOriginalBytes: 0, pinnedOriginalBytes: 0 };
}

function addAmounts(left: StorageAmounts, right: StorageAmounts): StorageAmounts {
  return {
    optimizedBytes: left.optimizedBytes + right.optimizedBytes,
    temporaryOriginalBytes: left.temporaryOriginalBytes + right.temporaryOriginalBytes,
    pinnedOriginalBytes: left.pinnedOriginalBytes + right.pinnedOriginalBytes,
  };
}

function checkedBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Storage bytes must be non-negative");
  return Math.round(value);
}

function formatBytes(bytes: number) {
  return `${(bytes / MIB).toFixed(1)} MiB`;
}
