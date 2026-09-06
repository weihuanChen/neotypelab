import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { originalPinCreditCost } from "./originalPinPolicy";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const MIB = 1024 ** 2;

describe("Keep Original", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedOriginal(userId: Id<"users">, byteSize: number, suffix: string) {
    return await t.run(async (ctx) => {
      const now = Date.now();
      const mediaAssetId = await ctx.db.insert("mediaAssets", {
        userId,
        kind: "generated-image",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const assetVersionId = await ctx.db.insert("assetVersions", {
        mediaAssetId,
        userId,
        version: 1,
        origin: "generated",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(mediaAssetId, { currentVersionId: assetVersionId });
      const storageObjectId = await ctx.db.insert("storageObjects", {
        mediaAssetId,
        assetVersionId,
        userId,
        accountingCategory: "temporary-original",
        retentionPolicy: "temporary-original",
        retentionDaysSnapshot: 7,
        retainUntil: now + 7 * 24 * 60 * 60 * 1000,
        bucketRole: "private",
        bucket: "private-library",
        key: `temporary-originals/users/${userId}/${suffix}/original.png`,
        rendition: "original",
        contentType: "image/png",
        byteSize,
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      return { mediaAssetId, assetVersionId, storageObjectId };
    });
  }

  it("charges once and settles reserved bytes into pinned usage", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "pin-user",
      email: "pin@example.test",
      balance: 25,
    });
    const original = await seedOriginal(user.userId, 4 * MIB, "success");

    const pending = await t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "pin-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 4 * MIB,
      expectedCreditCost: 10,
    });
    expect(pending.status).toBe("pending");
    if (pending.status !== "pending") throw new Error("Expected pending pin operation");
    expect(pending.creditCost).toBe(10);
    expect((await user.client.query(api.storageAccounting.viewerUsage, {}))?.pinnedOriginal.reservedBytes).toBe(4 * MIB);

    await t.mutation(internal.originalPin.complete, {
      operationId: pending.operationId,
      etag: "pinned-etag",
    });
    const repeated = await t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "pin-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 4 * MIB,
      expectedCreditCost: 10,
    });
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      object: await ctx.db.get(original.storageObjectId),
      transactions: await ctx.db.query("creditTransactions").withIndex("by_userId", (q) => q.eq("userId", user.userId)).collect(),
    }));
    const usage = await user.client.query(api.storageAccounting.viewerUsage, {});

    expect(repeated.status).toBe("already-pinned");
    expect(state.account).toMatchObject({ balance: 15, lifetimeSpent: 10 });
    expect(state.transactions.filter((transaction) => transaction.actionType === "keep-original")).toHaveLength(1);
    expect(state.object).toMatchObject({
      accountingCategory: "pinned-original",
      retentionPolicy: "permanent-original",
      key: expect.stringMatching(/^pinned-originals\//),
      etag: "pinned-etag",
    });
    expect(state.object?.retainUntil).toBeUndefined();
    expect(usage?.pinnedOriginal).toMatchObject({ usedBytes: 4 * MIB, reservedBytes: 0 });
    expect(usage?.temporaryOriginal.usedBytes).toBe(0);
  });

  it("refunds a failed operation once and releases its reservation", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "refund-pin-user",
      email: "refund-pin@example.test",
      balance: 25,
    });
    const original = await seedOriginal(user.userId, 12 * MIB, "failure");
    const pending = await t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "refund-pin-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 12 * MIB,
      expectedCreditCost: 20,
    });
    if (pending.status !== "pending") throw new Error("Expected pending pin operation");

    await t.mutation(internal.originalPin.fail, { operationId: pending.operationId, errorMessage: "copy failed" });
    await t.mutation(internal.originalPin.fail, { operationId: pending.operationId, errorMessage: "duplicate callback" });
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      operation: await ctx.db.get(pending.operationId),
      transactions: await ctx.db.query("creditTransactions").withIndex("by_userId", (q) => q.eq("userId", user.userId)).collect(),
    }));
    const usage = await user.client.query(api.storageAccounting.viewerUsage, {});

    expect(state.account).toMatchObject({ balance: 25, lifetimeSpent: 0 });
    expect(state.operation).toMatchObject({ status: "failed", errorMessage: "copy failed" });
    expect(state.transactions.filter((transaction) => transaction.actionType === "keep-original-refund")).toHaveLength(1);
    expect(usage?.pinnedOriginal.reservedBytes).toBe(0);
    expect(usage?.temporaryOriginal.usedBytes).toBe(12 * MIB);
  });

  it("uses size tiers and rejects Originals above the fixed-price limit", () => {
    expect(originalPinCreditCost(8 * MIB)).toBe(10);
    expect(originalPinCreditCost(8 * MIB + 1)).toBe(20);
    expect(originalPinCreditCost(20 * MIB + 1)).toBe(40);
    expect(() => originalPinCreditCost(50 * MIB + 1)).toThrow(/larger than 50 MB/);
  });

  it("rejects a changed price before creating a debit", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "changed-price-user",
      email: "changed-price@example.test",
      balance: 25,
    });
    const original = await seedOriginal(user.userId, 8 * MIB, "changed-price");

    await expect(t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "changed-price-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 12 * MIB,
      expectedCreditCost: 10,
    })).rejects.toThrow(/price changed/);
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      operations: await ctx.db.query("originalPinOperations").collect(),
    }));
    expect(state.account).toMatchObject({ balance: 25, lifetimeSpent: 0 });
    expect(state.operations).toHaveLength(0);
  });

  it("checks Pinned Original quota before charging", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "pin-quota-user",
      email: "pin-quota@example.test",
      balance: 100,
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("entitlementProfiles").withIndex("by_slug", (q) => q.eq("slug", "free-default")).unique();
      if (!profile) throw new Error("Free profile not found");
      await ctx.db.patch(profile._id, { pinnedOriginalQuotaBytes: 2 * MIB });
    });
    const original = await seedOriginal(user.userId, 4 * MIB, "quota");

    await expect(t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "pin-quota-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 4 * MIB,
      expectedCreditCost: 10,
    })).rejects.toThrow(/quota is full/);
    const account = await t.run((ctx) => ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(account).toMatchObject({ balance: 100, lifetimeSpent: 0 });
  });

  it("refunds a stale pending operation", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "stale-pin-user",
      email: "stale-pin@example.test",
      balance: 25,
    });
    const original = await seedOriginal(user.userId, 4 * MIB, "stale");
    const pending = await t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "stale-pin-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 4 * MIB,
      expectedCreditCost: 10,
    });
    if (pending.status !== "pending") throw new Error("Expected pending pin operation");
    await t.run((ctx) => ctx.db.patch(pending.operationId, { updatedAt: Date.now() - 31 * 60 * 1000 }));

    expect(await t.mutation(internal.originalPin.refundStale, {})).toEqual({ refunded: 1 });
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      operation: await ctx.db.get(pending.operationId),
    }));
    expect(state.account).toMatchObject({ balance: 25, lifetimeSpent: 0 });
    expect(state.operation).toMatchObject({ status: "failed", errorMessage: expect.stringMatching(/timed out/) });
  });

  it("shares Pinned quota reservations with concurrent generation", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "pin-generation-user",
      email: "pin-generation@example.test",
      balance: 100,
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("entitlementProfiles").withIndex("by_slug", (q) => q.eq("slug", "free-default")).unique();
      if (!profile) throw new Error("Free profile not found");
      await ctx.db.patch(profile._id, {
        originalPermanentStorage: true,
        pinnedOriginalQuotaBytes: 18 * MIB,
      });
    });
    const original = await seedOriginal(user.userId, 4 * MIB, "concurrent");
    const pending = await t.mutation(internal.originalPin.begin, {
      tokenIdentifier: "pin-generation-user",
      storageObjectId: original.storageObjectId,
      verifiedByteSize: 4 * MIB,
      expectedCreditCost: 10,
    });
    if (pending.status !== "pending") throw new Error("Expected pending pin operation");
    const generationJobId = await t.run((ctx) => ctx.db.insert("generationJobs", {
      userId: user.userId,
      kind: "palette-plan",
      status: "queued",
      requestedCredits: 1,
    }));

    await expect(t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId,
    })).rejects.toThrow(/Pinned Original storage quota exceeded/);
  });
});
