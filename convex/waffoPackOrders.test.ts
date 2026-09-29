import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");

describe("Waffo Credit Pack ledger", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("grants a mapped pack once and reverses proportional Credits on refund", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-pack-owner", email: "pack-owner@example.test" });
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_pack64");
    const purchase = {
      userId: user.userId,
      productId: "PROD_pack64",
      externalOrderId: "ORD_pack64",
      paymentId: "PAY_pack64",
      credits: 64 as const,
      listPriceMinor: 900,
      chargedMinor: 900,
      currency: "USD",
      occurredAt: Date.now(),
    };
    expect((await t.mutation(internal.waffoPackOrders.fulfill, purchase)).status).toBe("fulfilled");
    expect((await t.mutation(internal.waffoPackOrders.fulfill, purchase)).status).toBe("duplicate");
    expect((await t.mutation(internal.waffoPackOrders.refund, {
      eventId: "REF_half", externalOrderId: "ORD_pack64", refundAmountMinor: 450,
    })).status).toBe("partially-refunded");
    expect((await t.mutation(internal.waffoPackOrders.refund, {
      eventId: "REF_half", externalOrderId: "ORD_pack64", refundAmountMinor: 450,
    })).status).toBe("duplicate");
    expect((await t.mutation(internal.waffoPackOrders.refund, {
      eventId: "REF_rest", externalOrderId: "ORD_pack64", refundAmountMinor: 450,
    })).status).toBe("refunded");
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      orders: await ctx.db.query("orders").collect(),
      refunds: await ctx.db.query("creditPackRefunds").collect(),
    }));
    expect(state.account).toMatchObject({ balance: 0, permanentBalance: 0 });
    expect(state.orders).toMatchObject([{ paymentProvider: "waffo", status: "refunded", totalMinor: 900 }]);
    expect(state.refunds.map((entry) => entry.creditAmountRevoked)).toEqual([32, 32]);
  });

  it("rejects an incorrect price or a reassigned order", async () => {
    const t = convexTest(schema, modules);
    const buyer = await seedUser(t, { tokenIdentifier: "waffo-actual", email: "actual@example.test" });
    const other = await seedUser(t, { tokenIdentifier: "waffo-other", email: "other@example.test" });
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_pack64");
    const input = {
      userId: buyer.userId, productId: "PROD_pack64", externalOrderId: "ORD_shared",
      paymentId: "PAY_shared", credits: 64 as const, listPriceMinor: 900,
      chargedMinor: 900, currency: "USD", occurredAt: Date.now(),
    };
    await expect(t.mutation(internal.waffoPackOrders.fulfill, { ...input, listPriceMinor: 100 }))
      .rejects.toThrow("catalog");
    await t.mutation(internal.waffoPackOrders.fulfill, input);
    await expect(t.mutation(internal.waffoPackOrders.fulfill, { ...input, userId: other.userId }))
      .rejects.toThrow("different purchase");
  });
});
