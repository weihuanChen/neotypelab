import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  handleCreemSubscriptionEvent,
  extractCreemSubscriptionId,
  normalizeCreemCreditPackCheckout,
  normalizeCreemSubscriptionEvent,
} from "./creemEvents";
import { seedUser } from "@/tests/convexTestHelpers";

const productId = "prod_pro_monthly";
const catalog = { proProductId: productId, studioProductId: "prod_studio_monthly" };
const modules = import.meta.glob("./**/*.ts");
const subscription = {
  id: "sub_123",
  productId,
  currentPeriodStart: "2026-09-23T00:00:00.000Z",
  currentPeriodEnd: "2026-10-23T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  metadata: { convexUserId: "user_123" },
};

describe("Creem subscription event mapping", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the embedded checkout subscription and grants Pro Credits once per period", () => {
    const event = {
      id: "evt_checkout",
      eventType: "checkout.completed",
      created_at: "2026-09-23T00:01:00.000Z",
      object: { subscription: { id: "sub_123" } },
    };
    expect(extractCreemSubscriptionId(event.eventType, event.object)).toBe("sub_123");
    expect(normalizeCreemSubscriptionEvent(event, subscription, catalog)).toMatchObject({
      eventId: "evt_checkout",
      eventType: "subscription.started",
      externalSubscriptionId: "sub_123",
      userId: "user_123",
      planType: "pro",
      periodStart: Date.parse(subscription.currentPeriodStart),
      periodEnd: Date.parse(subscription.currentPeriodEnd),
      monthlyCredits: 160,
    });

    const renewal = { id: "evt_paid", eventType: "subscription.paid", object: { id: "sub_123" } };
    expect(extractCreemSubscriptionId(renewal.eventType, renewal.object)).toBe("sub_123");
    expect(normalizeCreemSubscriptionEvent(renewal, subscription, catalog)).toMatchObject({
      eventType: "subscription.renewed",
      periodStart: Date.parse(subscription.currentPeriodStart),
      monthlyCredits: 160,
    });
    expect(normalizeCreemSubscriptionEvent(renewal, {
      ...subscription,
      productId: catalog.studioProductId,
    }, catalog)).toMatchObject({ planType: "studio", monthlyCredits: 320 });
  });

  it("extracts a paid one-time order and the buyer ID from checkout metadata", () => {
    expect(normalizeCreemCreditPackCheckout({
      id: "evt_pack",
      eventType: "checkout.completed",
      object: {
        metadata: { convexUserId: "user_123" },
        order: {
          id: "ord_pack",
          status: "paid",
          amount_paid: 900,
          currency: "USD",
          transaction: { id: "tran_pack" },
        },
      },
    }, "prod_pack_64", 64)).toMatchObject({
      userId: "user_123",
      externalOrderId: "ord_pack",
      externalTransactionId: "tran_pack",
      credits: 64,
      priceMinor: 900,
      totalMinor: 900,
    });
  });

  it("does not grant Credits for status updates or other products", () => {
    expect(normalizeCreemSubscriptionEvent(
      { id: "evt_cancel", eventType: "subscription.scheduled_cancel" },
      subscription,
      catalog
    )).toMatchObject({ eventType: "subscription.canceled", cancelAtPeriodEnd: true, monthlyCredits: 0 });
    expect(normalizeCreemSubscriptionEvent(
      { id: "evt_other", eventType: "subscription.paid" },
      { ...subscription, productId: "prod_other" },
      catalog
    )).toBeNull();

    const refund = {
      id: "evt_refund",
      eventType: "refund.created",
      object: { status: "succeeded", subscription: { id: "sub_123", status: "canceled" } },
    };
    expect(extractCreemSubscriptionId(refund.eventType, refund.object)).toBe("sub_123");
    expect(normalizeCreemSubscriptionEvent(refund, subscription, catalog)).toMatchObject({
      eventType: "subscription.refunded",
      monthlyCredits: 0,
    });
    expect(normalizeCreemSubscriptionEvent({
      ...refund,
      object: { status: "succeeded", subscription: { id: "sub_123", status: "active" } },
    }, subscription, catalog)).toBeNull();
  });

  it("rejects missing event IDs and invalid billing periods", () => {
    expect(() => normalizeCreemSubscriptionEvent(
      { eventType: "subscription.paid" }, subscription, catalog
    )).toThrow("event ID");
    expect(() => normalizeCreemSubscriptionEvent(
      { id: "evt_bad", eventType: "subscription.paid" },
      { ...subscription, currentPeriodEnd: "invalid" },
      catalog
    )).toThrow("period");
  });

  it("grants the authenticated buyer's monthly Credits once across checkout and payment events", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "creem-buyer",
      email: "creem-buyer@example.test",
      balance: 20,
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", productId);
    const synced = { ...subscription, metadata: { convexUserId: user.userId } };
    type NormalizedEvent = NonNullable<ReturnType<typeof normalizeCreemSubscriptionEvent>>;
    const ctx = {
      runQuery: async () => synced,
      runMutation: async (_ref: unknown, args: NormalizedEvent) =>
        await t.mutation(internal.subscriptions.processWebhookEvent, args),
    } as unknown as Parameters<typeof handleCreemSubscriptionEvent>[0];

    await handleCreemSubscriptionEvent(ctx, {
      id: "evt_initial_checkout",
      eventType: "checkout.completed",
      object: { subscription: { id: subscription.id } },
    });
    await handleCreemSubscriptionEvent(ctx, {
      id: "evt_initial_payment",
      eventType: "subscription.paid",
      object: { id: subscription.id },
    });

    const state = await t.run(async (dbCtx) => ({
      account: await dbCtx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      grants: await dbCtx.db.query("subscriptionCreditGrants").collect(),
      subscriptions: await dbCtx.db.query("subscriptions").collect(),
    }));
    expect(state.account?.balance).toBe(180);
    expect(state.account?.subscriptionBalance).toBe(160);
    expect(state.grants).toHaveLength(1);
    expect(state.subscriptions).toMatchObject([{ userId: user.userId, provider: "creem", status: "active" }]);
  });
});
