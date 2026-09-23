import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { debitCredits } from "./creditLedger";

const modules = import.meta.glob("./**/*.ts");

describe("Creem Credit Pack fulfillment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("grants permanent Credits once and reverses an available balance on a full refund", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "pack-buyer",
      email: "pack-buyer@example.test",
      balance: 20,
    });
    vi.stubEnv("CREEM_CREDIT_PACK_64_PRODUCT_ID", "prod_pack_64");
    const input = {
      userId: user.userId,
      productId: "prod_pack_64",
      externalOrderId: "ord_pack_64",
      externalTransactionId: "tran_pack_64",
      credits: 64 as const,
      priceMinor: 900,
      totalMinor: 900,
      currency: "USD",
      occurredAt: Date.now(),
    };
    expect((await t.mutation(internal.creemPackOrders.fulfill, input)).status).toBe("fulfilled");
    expect((await t.mutation(internal.creemPackOrders.fulfill, input)).status).toBe("duplicate");
    const beforeRefund = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      orders: await ctx.db.query("orders").collect(),
      items: await ctx.db.query("orderItems").collect(),
    }));
    expect(beforeRefund.account).toMatchObject({ balance: 84, permanentBalance: 84 });
    expect(beforeRefund.orders).toHaveLength(1);
    expect(beforeRefund.items).toMatchObject([{ productType: "credit-pack", title: "64 Credit Pack" }]);

    expect((await t.mutation(internal.creemPackOrders.refund, {
      eventId: "evt_refund_64",
      externalTransactionId: "tran_pack_64",
      refundAmountMinor: 900,
    })).status).toBe("refunded");
    expect((await t.mutation(internal.creemPackOrders.refund, {
      eventId: "evt_refund_64",
      externalTransactionId: "tran_pack_64",
      refundAmountMinor: 900,
    })).status).toBe("duplicate");
    const afterRefund = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      orders: await ctx.db.query("orders").collect(),
      grants: await ctx.db.query("creditTransactions").withIndex("by_user_actionType", (q) => q.eq("userId", user.userId).eq("actionType", "credit-pack-purchase")).collect(),
    }));
    expect(afterRefund.account).toMatchObject({ balance: 20, permanentBalance: 20 });
    expect(afterRefund.orders[0]?.status).toBe("refunded");
    expect(afterRefund.grants).toHaveLength(1);
  });

  it("never makes permanent Credits negative when a refunded pack was already spent", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "spent-pack",
      email: "spent-pack@example.test",
    });
    vi.stubEnv("CREEM_CREDIT_PACK_64_PRODUCT_ID", "prod_pack_64");
    await t.mutation(internal.creemPackOrders.fulfill, {
      userId: user.userId,
      productId: "prod_pack_64",
      externalOrderId: "ord_spent_pack",
      externalTransactionId: "tran_spent_pack",
      credits: 64,
      priceMinor: 900,
      totalMinor: 900,
      currency: "USD",
      occurredAt: Date.now(),
    });
    await t.run(async (ctx) => {
      await debitCredits(ctx, { userId: user.userId, actionType: "generate-palette", amount: 20 });
    });
    await t.mutation(internal.creemPackOrders.refund, {
      eventId: "evt_spent_refund",
      externalTransactionId: "tran_spent_pack",
      refundAmountMinor: 900,
    });
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      reversal: await ctx.db.query("creditTransactions").withIndex("by_user_actionType", (q) => q.eq("userId", user.userId).eq("actionType", "credit-pack-refund")).unique(),
    }));
    expect(state.account).toMatchObject({ balance: 0, permanentBalance: 0 });
    expect(state.reversal?.delta).toBe(-44);
    expect(state.reversal?.internalNote).toContain("20 purchased Credits were already spent");
  });

  it("reverses proportional Credits across distinct partial refund events", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "partial-pack",
      email: "partial-pack@example.test",
    });
    vi.stubEnv("CREEM_CREDIT_PACK_64_PRODUCT_ID", "prod_pack_64");
    await t.mutation(internal.creemPackOrders.fulfill, {
      userId: user.userId,
      productId: "prod_pack_64",
      externalOrderId: "ord_partial_pack",
      externalTransactionId: "tran_partial_pack",
      credits: 64,
      priceMinor: 900,
      totalMinor: 900,
      currency: "USD",
      occurredAt: Date.now(),
    });
    const first = { eventId: "evt_partial_1", externalTransactionId: "tran_partial_pack", refundAmountMinor: 450 };
    expect((await t.mutation(internal.creemPackOrders.refund, first)).status).toBe("partially-refunded");
    expect((await t.mutation(internal.creemPackOrders.refund, first)).status).toBe("duplicate");
    const midpoint = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      orders: await ctx.db.query("orders").collect(),
    }));
    expect(midpoint.account?.balance).toBe(32);
    expect(midpoint.orders[0]?.status).toBe("partially-refunded");
    expect((await t.mutation(internal.creemPackOrders.refund, {
      eventId: "evt_partial_2",
      externalTransactionId: "tran_partial_pack",
      refundAmountMinor: 450,
    })).status).toBe("refunded");
    const final = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      refunds: await ctx.db.query("creditPackRefunds").collect(),
    }));
    expect(final.account?.balance).toBe(0);
    expect(final.refunds).toHaveLength(2);
    expect(final.refunds.map((refund) => refund.creditAmountRevoked)).toEqual([32, 32]);
  });
});
