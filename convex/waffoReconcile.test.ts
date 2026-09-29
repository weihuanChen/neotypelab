import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@waffo/pancake-ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@waffo/pancake-ts")>(),
  WaffoPancake: class { graphql = { query: mocks.query }; },
}));

const modules = import.meta.glob("./**/*.ts");

describe("Waffo signed payment reconciliation", () => {
  beforeEach(() => {
    vi.stubEnv("WAFFO_ENVIRONMENT", "test");
    vi.stubEnv("WAFFO_MERCHANT_ID", "MER_test");
    vi.stubEnv("WAFFO_PRIVATE_KEY", "key");
    vi.stubEnv("WAFFO_STORE_ID", "STO_test");
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires a signed buyer-linked receipt and reconciles the paid period once", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "reconcile-buyer", email: "reconcile@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const orderId = "ORD_reconcile";
    await expect(t.action(internal.waffoReconcile.subscription, { orderId }))
      .rejects.toThrow("signed Waffo payment receipt");
    await t.mutation(internal.waffoWebhookEvents.record, {
      eventId: "PAY_reconcile",
      businessEventId: "PAY_reconcile",
      eventType: "subscription.payment_succeeded",
      storeId: "STO_test",
      mode: "test",
      orderId,
      buyerIdentity: user.userId,
      metadataUserId: user.userId,
      occurredAt: Date.now(),
      outcome: "ignored",
    });
    const start = new Date("2026-09-28T02:10:50.000Z").getTime();
    const end = new Date("2026-10-28T02:10:50.000Z").getTime();
    mocks.query.mockResolvedValue({ data: { subscriptionOrder: {
      id: orderId,
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date(start).toISOString(),
      currentPeriodEnd: new Date(end).toISOString(),
      priceSnapshot: { currency: "USD", regularPhase: { subtotal: "19.90" } },
      subscriptionProduct: { id: "PROD_pro" },
    } } });
    expect((await t.action(internal.waffoReconcile.subscription, { orderId })).status).toBe("processed");
    expect((await t.action(internal.waffoReconcile.subscription, { orderId })).status).toBe("duplicate");
    const state = await t.run(async (ctx) => ({
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
      subscriptions: await ctx.db.query("subscriptions").collect(),
    }));
    expect(state.grants).toMatchObject([{ creditAmount: 160, periodStart: start }]);
    expect(state.subscriptions).toMatchObject([{ provider: "waffo", planType: "pro", status: "active" }]);
  });

  it("reconciles a new Studio order into the existing Pro subscription once", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "plan-change-buyer", email: "plan-change@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    vi.stubEnv("WAFFO_STUDIO_MONTHLY_PRODUCT_ID", "PROD_studio");
    const firstStart = new Date("2026-09-28T02:10:50.000Z").getTime();
    const firstEnd = new Date("2026-10-28T02:10:50.000Z").getTime();
    await t.mutation(internal.subscriptions.processWebhookEvent, {
      eventId: "original-pro-event",
      provider: "waffo",
      eventType: "subscription.started",
      externalSubscriptionId: "ORD_original_pro",
      userId: user.userId,
      planType: "pro",
      periodStart: firstStart,
      periodEnd: firstEnd,
      monthlyCredits: 160,
      cancelAtPeriodEnd: false,
      occurredAt: firstStart,
      payloadJson: "{}",
    });
    const orderId = "ORD_new_studio";
    await t.mutation(internal.waffoWebhookEvents.record, {
      eventId: "PAY_studio_upgrade",
      businessEventId: "PAY_studio_upgrade",
      eventType: "subscription.payment_succeeded",
      storeId: "STO_test",
      mode: "test",
      orderId,
      buyerIdentity: user.userId,
      metadataUserId: user.userId,
      occurredAt: firstStart + 4 * 60 * 60 * 1000,
      outcome: "ignored",
    });
    const studioStart = firstStart + 4 * 60 * 60 * 1000;
    const studioEnd = firstEnd + 4 * 60 * 60 * 1000;
    mocks.query.mockResolvedValue({ data: { subscriptionOrder: {
      id: orderId,
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date(studioStart).toISOString(),
      currentPeriodEnd: new Date(studioEnd).toISOString(),
      priceSnapshot: { currency: "USD", regularPhase: { subtotal: "29.90" } },
      subscriptionProduct: { id: "PROD_studio" },
    } } });
    expect((await t.action(internal.waffoReconcile.planChange, { orderId })).status).toBe("processed");
    expect((await t.action(internal.waffoReconcile.planChange, { orderId })).status).toBe("duplicate");
    const state = await t.run(async (ctx) => ({
      subscriptions: await ctx.db.query("subscriptions").collect(),
      aliases: await ctx.db.query("waffoSubscriptionOrderAliases").collect(),
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
    }));
    expect(state.subscriptions).toMatchObject([{ planType: "studio", externalSubscriptionId: "ORD_original_pro" }]);
    expect(state.aliases).toMatchObject([{ orderId, canonicalOrderId: "ORD_original_pro" }]);
    expect(state.account).toMatchObject({ subscriptionBalance: 320, subscriptionMonthlyAllowance: 320 });
  });
});
