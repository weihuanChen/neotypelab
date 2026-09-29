import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), query: vi.fn() }));
vi.mock("@waffo/pancake-ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@waffo/pancake-ts")>(),
  verifyWebhook: mocks.verify,
  WaffoPancake: class { graphql = { query: mocks.query }; },
}));

const modules = import.meta.glob("./**/*.ts");
const now = Date.now();
const periodEnd = now + 30 * 24 * 60 * 60 * 1000;

function event(userId: string, eventType = "subscription.activated") {
  return {
    id: `delivery-${eventType}`,
    eventId: `business-${eventType}`,
    timestamp: new Date(now).toISOString(),
    eventType,
    mode: "test",
    storeId: "STO_test",
    storeName: "Test Store",
    data: {
      orderId: "ORD_subscription",
      currency: "USD",
      buyerEmail: "buyer@example.test",
      merchantProvidedBuyerIdentity: userId,
      orderMetadata: { convexUserId: userId, catalogKey: "pro" },
      billingPeriod: "monthly",
      currentPeriodStart: new Date(now).toISOString(),
      currentPeriodEnd: new Date(periodEnd).toISOString(),
      productName: "NeoTypeLab Pro",
      amount: "19.90",
      taxAmount: "0.00",
    },
  };
}

function subscriptionOrder(productId = "PROD_pro") {
  return {
    id: "ORD_subscription",
    status: "active",
    billingPeriod: "monthly",
    currentPeriodStart: new Date(now).toISOString(),
    currentPeriodEnd: new Date(periodEnd).toISOString(),
    priceSnapshot: { currency: "USD", regularPhase: { subtotal: "19.90", total: "19.90" } },
    subscriptionProduct: { id: productId },
  };
}

describe("Waffo signed event fulfillment", () => {
  beforeEach(() => {
    vi.stubEnv("WAFFO_ENVIRONMENT", "test");
    vi.stubEnv("WAFFO_STORE_ID", "STO_test");
    vi.stubEnv("WAFFO_MERCHANT_ID", "MER_test");
    vi.stubEnv("WAFFO_PRIVATE_KEY", "test-key");
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_pack64");
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("grants subscription access and monthly Credits once", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-sub", email: "waffo-sub@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    mocks.verify.mockReturnValue({
      ...event(user.userId),
      data: {
        ...event(user.userId).data,
        currentPeriodStart: new Date(now).toISOString().slice(0, 10),
        currentPeriodEnd: new Date(periodEnd).toISOString().slice(0, 10),
      },
    });
    mocks.query.mockResolvedValue({ data: { subscriptionOrder: subscriptionOrder() } });
    const args = { body: "signed", signature: "signature" };
    expect((await t.action(internal.waffoWebhookNode.receive, args)).status).toBe("recorded");
    expect((await t.action(internal.waffoWebhookNode.receive, args)).status).toBe("duplicate");
    const subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
      events: await ctx.db.query("waffoWebhookEvents").collect(),
    }));
    expect(subscription).toMatchObject({ provider: "waffo", planType: "pro", status: "active" });
    expect(state.account).toMatchObject({ subscriptionBalance: 160, subscriptionMonthlyAllowance: 160 });
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0]?.periodStart).toBe(now);
    expect(state.events).toMatchObject([{ outcome: "processed", buyerUserId: user.userId }]);
  });

  it("refuses a product that differs from checkout metadata", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-mismatch", email: "waffo-mismatch@example.test" });
    mocks.verify.mockReturnValue(event(user.userId));
    mocks.query.mockResolvedValue({ data: { subscriptionOrder: subscriptionOrder("PROD_unmapped") } });
    expect((await t.action(internal.waffoWebhookNode.receive, {
      body: "signed", signature: "signature",
    })).status).toBe("recorded");
    const state = await t.run(async (ctx) => ({
      subscriptions: await ctx.db.query("subscriptions").collect(),
      events: await ctx.db.query("waffoWebhookEvents").collect(),
    }));
    expect(state.subscriptions).toHaveLength(0);
    expect(state.events).toMatchObject([{ outcome: "verified-unmapped" }]);
  });

  it("grants the next monthly allowance once on renewal", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-renew", email: "waffo-renew@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    mocks.verify.mockReturnValueOnce(event(user.userId)).mockReturnValueOnce({
      ...event(user.userId, "subscription.renewed"),
      timestamp: new Date(periodEnd).toISOString(),
      data: {
        ...event(user.userId).data,
        currentPeriodStart: new Date(periodEnd).toISOString(),
        currentPeriodEnd: new Date(periodEnd + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    mocks.query.mockResolvedValueOnce({ data: { subscriptionOrder: subscriptionOrder() } })
      .mockResolvedValueOnce({ data: { subscriptionOrder: {
        ...subscriptionOrder(),
        currentPeriodStart: new Date(periodEnd).toISOString(),
        currentPeriodEnd: new Date(periodEnd + 30 * 24 * 60 * 60 * 1000).toISOString(),
      } } });
    await t.action(internal.waffoWebhookNode.receive, { body: "first", signature: "signature" });
    await t.action(internal.waffoWebhookNode.receive, { body: "renewed", signature: "signature" });
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
    }));
    expect(state.grants).toHaveLength(2);
    expect(state.account).toMatchObject({ subscriptionBalance: 320, subscriptionMonthlyAllowance: 160 });
  });

  it("applies a Pro to Studio upgrade even when checkout metadata names the original plan", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-upgrade", email: "waffo-upgrade@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    vi.stubEnv("WAFFO_STUDIO_MONTHLY_PRODUCT_ID", "PROD_studio");
    const changeAt = now + 4 * 60 * 60 * 1000;
    const studioEnd = periodEnd + 4 * 60 * 60 * 1000;
    mocks.verify.mockReturnValueOnce(event(user.userId)).mockReturnValueOnce({
      ...event(user.userId, "subscription.plan_changed"),
      id: "ORD_studio",
      timestamp: new Date(changeAt).toISOString(),
      data: {
        ...event(user.userId).data,
        orderId: "ORD_studio",
        orderMetadata: { convexUserId: user.userId, catalogKey: "studio" },
        currentPeriodStart: new Date(changeAt).toISOString(),
        currentPeriodEnd: new Date(studioEnd).toISOString(),
        planChange: { direction: "upgrade" },
      },
    }).mockReturnValueOnce({
      ...event(user.userId, "subscription.canceled"),
      timestamp: new Date(changeAt + 1_000).toISOString(),
    }).mockReturnValueOnce({
      ...event(user.userId, "subscription.renewed"),
      id: "ORD_studio",
      timestamp: new Date(studioEnd).toISOString(),
      data: {
        ...event(user.userId).data,
        orderId: "ORD_studio",
        orderMetadata: { convexUserId: user.userId, catalogKey: "studio" },
        currentPeriodStart: new Date(studioEnd).toISOString(),
        currentPeriodEnd: new Date(studioEnd + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    mocks.query.mockResolvedValueOnce({ data: { subscriptionOrder: subscriptionOrder() } })
      .mockResolvedValueOnce({ data: { subscriptionOrder: {
        ...subscriptionOrder("PROD_studio"),
        id: "ORD_studio",
        currentPeriodStart: new Date(changeAt).toISOString(),
        currentPeriodEnd: new Date(studioEnd).toISOString(),
        priceSnapshot: { currency: "USD", regularPhase: { subtotal: "29.90", total: "29.90" } },
      } } }).mockResolvedValueOnce({ data: { subscriptionOrder: {
        ...subscriptionOrder(), status: "canceled",
      } } }).mockResolvedValueOnce({ data: { subscriptionOrder: {
        ...subscriptionOrder("PROD_studio"),
        id: "ORD_studio",
        currentPeriodStart: new Date(studioEnd).toISOString(),
        currentPeriodEnd: new Date(studioEnd + 30 * 24 * 60 * 60 * 1000).toISOString(),
        priceSnapshot: { currency: "USD", regularPhase: { subtotal: "29.90", total: "29.90" } },
      } } });
    await t.action(internal.waffoWebhookNode.receive, { body: "first", signature: "signature" });
    await t.action(internal.waffoWebhookNode.receive, { body: "upgrade", signature: "signature" });
    const subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    const account = await t.run(async (ctx) => await ctx.db.query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(subscription).toMatchObject({ planType: "studio", provider: "waffo" });
    expect(account).toMatchObject({ subscriptionBalance: 320, subscriptionMonthlyAllowance: 320 });
    const aliases = await t.run(async (ctx) => await ctx.db.query("waffoSubscriptionOrderAliases").collect());
    expect(aliases).toMatchObject([{ orderId: "ORD_studio", canonicalOrderId: "ORD_subscription" }]);
    await t.action(internal.waffoWebhookNode.receive, { body: "old-plan-canceled", signature: "signature" });
    expect(await user.client.query(api.subscriptions.viewerCurrent, {}))
      .toMatchObject({ planType: "studio", status: "active" });
    await t.action(internal.waffoWebhookNode.receive, { body: "studio-renewed", signature: "signature" });
    const renewed = await t.run(async (ctx) => ({
      subscriptions: await ctx.db.query("subscriptions").collect(),
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
    }));
    expect(renewed.subscriptions).toHaveLength(1);
    expect(renewed.grants).toHaveLength(2);
    expect(renewed.account).toMatchObject({ subscriptionBalance: 640, subscriptionMonthlyAllowance: 320 });
  });

  it("treats distinct status events on the same Waffo order as separate deliveries", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-status", email: "waffo-status@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    mocks.verify.mockReturnValueOnce(event(user.userId)).mockReturnValueOnce({
      ...event(user.userId, "subscription.canceled"),
      id: "delivery-subscription.activated",
      timestamp: new Date(now + 1_000).toISOString(),
    });
    mocks.query.mockResolvedValueOnce({ data: { subscriptionOrder: subscriptionOrder() } })
      .mockResolvedValueOnce({ data: { subscriptionOrder: { ...subscriptionOrder(), status: "canceled" } } });
    await t.action(internal.waffoWebhookNode.receive, { body: "activated", signature: "signature" });
    await t.action(internal.waffoWebhookNode.receive, { body: "canceled", signature: "signature" });
    const events = await t.run(async (ctx) => await ctx.db.query("waffoWebhookEvents").collect());
    expect(events).toHaveLength(2);
    expect(events.map((entry) => entry.eventType).sort()).toEqual(["subscription.activated", "subscription.canceled"]);
  });

  it("moves a canceled subscription to refunded and expires its Credits", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-refund-sub", email: "waffo-refund-sub@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    mocks.verify.mockReturnValueOnce(event(user.userId)).mockReturnValueOnce({
      ...event(user.userId, "refund.succeeded"),
      timestamp: new Date(now + 1_000).toISOString(),
      data: { ...event(user.userId).data, refundStatus: "succeeded" },
    });
    mocks.query.mockResolvedValueOnce({ data: { subscriptionOrder: subscriptionOrder() } })
      .mockResolvedValueOnce({ data: { subscriptionOrder: { ...subscriptionOrder(), status: "canceled" } } });
    await t.action(internal.waffoWebhookNode.receive, { body: "first", signature: "signature" });
    await t.action(internal.waffoWebhookNode.receive, { body: "refund", signature: "signature" });
    const subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    const account = await t.run(async (ctx) => await ctx.db.query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(subscription).toMatchObject({ status: "refunded" });
    expect(account).toMatchObject({ subscriptionBalance: 0 });
  });

  it("grants a Credit Pack and reverses it after a signed refund", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-order", email: "waffo-order@example.test" });
    const purchase = {
      ...event(user.userId, "order.completed"),
      data: {
        ...event(user.userId).data,
        orderId: "ORD_pack",
        orderMetadata: { convexUserId: user.userId, catalogKey: "pack64" },
        paymentId: "PAY_pack",
        paymentStatus: "succeeded",
        chargedAmount: "9.00",
      },
    };
    const order = {
      id: "ORD_pack", status: "completed", testMode: true,
      priceSnapshot: { currency: "USD", subtotal: "9.00", total: "9.00" },
      onetimeProduct: { id: "PROD_pack64" },
    };
    mocks.verify.mockReturnValueOnce(purchase).mockReturnValueOnce({
      ...purchase,
      id: "delivery-refund",
      eventType: "refund.succeeded",
      data: { ...purchase.data, refundStatus: "succeeded", refundedAmount: "9.00" },
    });
    mocks.query.mockResolvedValue({ data: { onetimeOrder: order } });
    expect((await t.action(internal.waffoWebhookNode.receive, { body: "paid", signature: "signature" })).status).toBe("recorded");
    expect((await t.action(internal.waffoWebhookNode.receive, { body: "refunded", signature: "signature" })).status).toBe("recorded");
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      orders: await ctx.db.query("orders").collect(),
    }));
    expect(state.account).toMatchObject({ permanentBalance: 0 });
    expect(state.orders).toMatchObject([{ status: "refunded", paymentProvider: "waffo" }]);
  });
});
