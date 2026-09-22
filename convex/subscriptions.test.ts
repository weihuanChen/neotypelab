import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { resolveEffectiveEntitlements } from "./entitlements";
import { verifyBillingWebhookSignature } from "./billingWebhook";
import { seedUser } from "@/tests/convexTestHelpers";
import { debitCredits, refundCreditTransaction } from "./creditLedger";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("subscription billing", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  function event(input: Partial<{
    eventId: string;
    eventType: "subscription.started" | "subscription.renewed" | "subscription.updated" | "subscription.payment_failed" | "subscription.canceled" | "subscription.refunded";
    externalSubscriptionId: string;
    userId: string;
    planType: "pro" | "studio";
    periodStart: number;
    periodEnd: number;
    monthlyCredits: number;
    cancelAtPeriodEnd: boolean;
    occurredAt: number;
  }> = {}) {
    const now = Date.now();
    const value = {
      eventId: input.eventId ?? "evt-start",
      provider: "test-provider",
      eventType: input.eventType ?? "subscription.started",
      externalSubscriptionId: input.externalSubscriptionId ?? "sub-001",
      userId: input.userId,
      planType: input.planType ?? "pro",
      periodStart: input.periodStart ?? now,
      periodEnd: input.periodEnd ?? now + 30 * DAY_MS,
      monthlyCredits: input.monthlyCredits ?? 100,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      occurredAt: input.occurredAt ?? now,
    };
    return { ...value, payloadJson: JSON.stringify(value) };
  }

  it("activates profile entitlements and grants monthly Credits once", async () => {
    const user = await seedUser(t, { tokenIdentifier: "subscriber", email: "subscriber@example.test", balance: 10 });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const input = event({ userId: user.userId });

    const first = await t.mutation(internal.subscriptions.processWebhookEvent, input);
    const duplicate = await t.mutation(internal.subscriptions.processWebhookEvent, input);
    const effective = await user.client.query(api.entitlements.viewerEffective, {});
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      subscriptions: await ctx.db.query("subscriptions").collect(),
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
      events: await ctx.db.query("billingWebhookEvents").collect(),
    }));

    expect(first.status).toBe("processed");
    expect(duplicate.status).toBe("duplicate");
    expect(state.account).toMatchObject({
      balance: 110,
      permanentBalance: 10,
      subscriptionBalance: 100,
      subscriptionMonthlyAllowance: 100,
      subscriptionBalanceCap: 200,
      lifetimeGranted: 110,
    });
    expect(state.subscriptions).toHaveLength(1);
    expect(state.grants).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(effective).toMatchObject({ accountPlanType: "free", planType: "pro", libraryQuotaBytes: 10 * 1024 ** 3 });
  });

  it("deduplicates Credits by billing period and applies a deferred downgrade on renewal", async () => {
    const user = await seedUser(t, { tokenIdentifier: "studio-subscriber", email: "studio@example.test", balance: 0 });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ userId: user.userId, planType: "studio", periodStart: now, periodEnd: now + 30 * DAY_MS, monthlyCredits: 500 }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-repeat-period", eventType: "subscription.renewed", planType: "studio", periodStart: now, periodEnd: now + 30 * DAY_MS, monthlyCredits: 500, occurredAt: now + 1 }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-downgrade", eventType: "subscription.updated", planType: "pro", periodStart: now, periodEnd: now + 30 * DAY_MS, monthlyCredits: 0, occurredAt: now + 2 }));

    let subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    let effective = await user.client.query(api.entitlements.viewerEffective, {});
    expect(subscription).toMatchObject({ planType: "studio", pendingPlanType: "pro", pendingPlanEffectiveAt: now + 30 * DAY_MS });
    expect(effective?.planType).toBe("studio");

    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-next-period", eventType: "subscription.renewed", planType: "pro", periodStart: now + 30 * DAY_MS, periodEnd: now + 60 * DAY_MS, monthlyCredits: 200, occurredAt: now + 30 * DAY_MS }));
    subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    effective = await user.client.query(api.entitlements.viewerEffective, {});
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      grants: await ctx.db.query("subscriptionCreditGrants").collect(),
    }));
    expect(subscription).toMatchObject({ planType: "pro", status: "active" });
    expect(subscription?.pendingPlanType).toBeUndefined();
    expect(effective?.planType).toBe("pro");
    expect(state.account).toMatchObject({
      balance: 400,
      permanentBalance: 0,
      subscriptionBalance: 400,
      subscriptionMonthlyAllowance: 200,
      subscriptionBalanceCap: 400,
    });
    expect(state.grants).toHaveLength(2);
    expect(state.grants.find((grant) => grant.periodStart === now + 30 * DAY_MS)).toMatchObject({
      creditAmount: 200,
      rolloverExpiredAmount: 300,
      subscriptionBalanceAfter: 400,
    });
  });

  it("rolls the full subscription balance up to twice the monthly allowance", async () => {
    const user = await seedUser(t, { tokenIdentifier: "rollover-subscriber", email: "rollover@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, event({
      userId: user.userId,
      planType: "pro",
      monthlyCredits: 160,
      periodStart: now,
      periodEnd: now + 30 * DAY_MS,
    }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({
      eventId: "evt-rollover-2",
      eventType: "subscription.renewed",
      planType: "pro",
      monthlyCredits: 160,
      periodStart: now + 30 * DAY_MS,
      periodEnd: now + 60 * DAY_MS,
      occurredAt: now + 1,
    }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({
      eventId: "evt-rollover-3",
      eventType: "subscription.renewed",
      planType: "pro",
      monthlyCredits: 160,
      periodStart: now + 60 * DAY_MS,
      periodEnd: now + 90 * DAY_MS,
      occurredAt: now + 2,
    }));

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      expirations: await ctx.db.query("creditTransactions").withIndex("by_user_actionType", (q) =>
        q.eq("userId", user.userId).eq("actionType", "subscription-credit-expiration")
      ).collect(),
    }));
    expect(state.account).toMatchObject({
      balance: 320,
      permanentBalance: 0,
      subscriptionBalance: 320,
      subscriptionMonthlyAllowance: 160,
      subscriptionBalanceCap: 320,
    });
    expect(state.expirations).toHaveLength(1);
    expect(state.expirations[0]).toMatchObject({
      delta: -160,
      reasonCode: "rollover-cap",
      subscriptionDelta: -160,
    });
  });

  it("spends subscription Credits first and refunds the original bucket split", async () => {
    const user = await seedUser(t, { tokenIdentifier: "mixed-balance", email: "mixed@example.test", balance: 40 });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, event({
      userId: user.userId,
      monthlyCredits: 160,
      periodStart: now,
      periodEnd: now + 30 * DAY_MS,
    }));
    const debit = await t.run((ctx) => debitCredits(ctx, {
      userId: user.userId,
      actionType: "generate-hd-render",
      amount: 180,
      metadata: { referenceTable: "tests", referenceId: "mixed-debit" },
    }));
    expect(debit).toMatchObject({ subscriptionSpent: 160, permanentSpent: 20, balanceAfter: 20 });

    await t.run((ctx) => refundCreditTransaction(ctx, {
      debitTransactionId: debit.transactionId,
      actionType: "generation-refund",
      metadata: { referenceTable: "tests", referenceId: "mixed-refund" },
    }));
    const account = await t.run((ctx) => ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(account).toMatchObject({ balance: 200, permanentBalance: 40, subscriptionBalance: 160 });
  });

  it("keeps cancellation access through grace and revokes immediately on refund", async () => {
    const user = await seedUser(t, { tokenIdentifier: "cancel-subscriber", email: "cancel@example.test", balance: 25 });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    const periodEnd = now + DAY_MS;
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ userId: user.userId, periodStart: now, periodEnd, monthlyCredits: 100 }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-cancel", eventType: "subscription.canceled", periodStart: now, periodEnd, monthlyCredits: 0, occurredAt: now + 1 }));
    const duringGrace = await t.run((ctx) => resolveEffectiveEntitlements(ctx, user.userId, periodEnd + 13 * DAY_MS));
    const afterGrace = await t.run((ctx) => resolveEffectiveEntitlements(ctx, user.userId, periodEnd + 15 * DAY_MS));
    expect(duringGrace.planType).toBe("pro");
    expect(afterGrace.planType).toBe("free");

    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-refund", eventType: "subscription.refunded", periodStart: now, periodEnd, monthlyCredits: 0, occurredAt: now + 2 }));
    expect((await user.client.query(api.entitlements.viewerEffective, {}))?.planType).toBe("free");
    expect((await user.client.query(api.subscriptions.viewerCurrent, {}))?.status).toBe("refunded");
    const account = await t.run((ctx) => ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(account).toMatchObject({ balance: 25, permanentBalance: 25, subscriptionBalance: 0 });
  });

  it("expires only subscription Credits when cancellation grace ends", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "expired-subscription-balance",
      email: "expired-balance@example.test",
      balance: 25,
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    const periodEnd = now + DAY_MS;
    const started = event({ userId: user.userId, periodStart: now, periodEnd, monthlyCredits: 100 });
    const result = await t.mutation(internal.subscriptions.processWebhookEvent, started);
    await t.mutation(internal.subscriptions.processWebhookEvent, event({
      eventId: "evt-expiring-cancel",
      eventType: "subscription.canceled",
      periodStart: now,
      periodEnd,
      monthlyCredits: 0,
      occurredAt: now + 1,
    }));
    await t.run(async (ctx) => {
      const account = await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique();
      if (!account) throw new Error("Credit account missing");
      await ctx.db.patch(account._id, { subscriptionBalanceExpiresAt: Date.now() - 1 });
    });
    if (!result.subscriptionId) throw new Error("Subscription was not created");
    await t.mutation(internal.subscriptions.expireSubscriptionCreditBalance, {
      subscriptionId: result.subscriptionId,
      expectedPeriodEnd: periodEnd,
    });

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      expirations: await ctx.db.query("creditTransactions").withIndex("by_user_actionType", (q) =>
        q.eq("userId", user.userId).eq("actionType", "subscription-credit-expiration")
      ).collect(),
    }));
    expect(state.account).toMatchObject({ balance: 25, permanentBalance: 25, subscriptionBalance: 0 });
    expect(state.expirations.some((transaction) => transaction.reasonCode === "subscription-ended")).toBe(true);
  });

  it("records stale events without rolling subscription state backward", async () => {
    const user = await seedUser(t, { tokenIdentifier: "ordered-subscriber", email: "ordered@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ userId: user.userId, occurredAt: now + 100 }));
    const stale = await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-stale", eventType: "subscription.refunded", occurredAt: now, monthlyCredits: 0 }));
    expect(stale.status).toBe("ignored-stale");
    expect((await user.client.query(api.subscriptions.viewerCurrent, {}))?.status).toBe("active");
  });

  it("prevents a second active subscription for the same account", async () => {
    const user = await seedUser(t, { tokenIdentifier: "single-subscription", email: "single@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ userId: user.userId }));

    await expect(t.mutation(internal.subscriptions.processWebhookEvent, event({
      eventId: "evt-second-provider",
      externalSubscriptionId: "sub-second",
      userId: user.userId,
      occurredAt: Date.now() + 1,
    }))).rejects.toThrow(/already has an active subscription/);
  });

  it("preserves the current plan through cancellation grace after a scheduled downgrade", async () => {
    const user = await seedUser(t, { tokenIdentifier: "grace-downgrade", email: "grace-downgrade@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    const periodEnd = now + 30 * DAY_MS;
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ userId: user.userId, planType: "studio", periodStart: now, periodEnd, monthlyCredits: 0 }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-grace-downgrade", eventType: "subscription.updated", planType: "pro", periodStart: now, periodEnd, monthlyCredits: 0, occurredAt: now + 1 }));
    await t.mutation(internal.subscriptions.processWebhookEvent, event({ eventId: "evt-grace-cancel", eventType: "subscription.canceled", planType: "pro", periodStart: now, periodEnd, monthlyCredits: 0, occurredAt: now + 2 }));

    const subscription = await user.client.query(api.subscriptions.viewerCurrent, {});
    const effective = await t.run((ctx) => resolveEffectiveEntitlements(ctx, user.userId, periodEnd + 13 * DAY_MS));
    expect(subscription).toMatchObject({ planType: "studio", pendingPlanType: "pro", status: "canceled" });
    expect(effective.planType).toBe("studio");
  });
});

describe("billing webhook signature", () => {
  it("accepts the signed body and rejects stale timestamps", async () => {
    const secret = "test-webhook-secret";
    const body = JSON.stringify({ eventId: "evt-signature" });
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
    const signature = `v1=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

    expect(await verifyBillingWebhookSignature({ body, signature, timestamp, secret, now })).toBe(true);
    expect(await verifyBillingWebhookSignature({ body, signature, timestamp, secret, now: now + 6 * 60 * 1000 })).toBe(false);
  });
});
