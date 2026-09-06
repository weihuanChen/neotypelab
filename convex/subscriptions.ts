import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./functions";
import { vBillingEventType, vUserPlan, type BillingEventType, type UserPlan } from "./domain";
import type { MutationCtx } from "./types";

const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export const viewerCurrent = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) return null;
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();
    const subscription = subscriptions.at(0);
    if (!subscription) return null;
    return {
      _id: subscription._id,
      provider: subscription.provider,
      planType: subscription.planType,
      pendingPlanType: subscription.pendingPlanType,
      pendingPlanEffectiveAt: subscription.pendingPlanEffectiveAt,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    };
  },
});

export const processWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    provider: v.string(),
    eventType: vBillingEventType,
    externalSubscriptionId: v.string(),
    userId: v.optional(v.string()),
    planType: vUserPlan,
    periodStart: v.number(),
    periodEnd: v.number(),
    monthlyCredits: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    occurredAt: v.number(),
    payloadJson: v.string(),
  },
  async handler(ctx, args) {
    const eventId = requiredText(args.eventId, "Event ID", 160);
    const provider = requiredText(args.provider, "Billing provider", 80);
    const externalSubscriptionId = requiredText(args.externalSubscriptionId, "External subscription ID", 180);
    validateTimestamp(args.occurredAt, "Event timestamp");
    validatePeriod(args.periodStart, args.periodEnd);
    if (!Number.isInteger(args.monthlyCredits) || args.monthlyCredits < 0 || args.monthlyCredits > 100_000) {
      throw new Error("Monthly Credits must be an integer between 0 and 100,000");
    }
    if (args.planType === "free") throw new Error("A paid subscription must use Pro or Studio");

    const duplicate = await ctx.db.query("billingWebhookEvents").withIndex("by_provider_event", (q) => q.eq("provider", provider).eq("eventId", eventId)).unique();
    if (duplicate) {
      return { status: "duplicate" as const, subscriptionId: duplicate.subscriptionId ?? null };
    }
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_provider_external", (q) => q.eq("provider", provider).eq("externalSubscriptionId", externalSubscriptionId))
      .unique();
    if (existing && existing.provider !== provider) throw new Error("Subscription provider does not match the existing record");
    if (existing && args.occurredAt < existing.latestEventOccurredAt) {
      await recordEvent(ctx, args, "ignored-stale", existing._id);
      return { status: "ignored-stale" as const, subscriptionId: existing._id };
    }

    const userId = await resolveSubscriptionUser(ctx, existing, args.userId);
    if (!existing) {
      const userSubscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const conflicting = userSubscriptions.find((subscription) =>
        subscription.status === "active" ||
        subscription.status === "canceling" ||
        subscription.status === "past-due"
      );
      if (conflicting) {
        throw new Error("User already has an active subscription");
      }
    }
    const profile = await currentPlanProfile(ctx, args.planType);
    const now = Date.now();
    const gracePeriodEndsAt = graceEnd(args.eventType, args.periodEnd, args.occurredAt);
    const downgrade = existing !== null && args.eventType === "subscription.updated" &&
      planRank(args.planType) < planRank(existing.planType);
    const preserveCurrentPlan = existing !== null && (
      args.eventType === "subscription.payment_failed" ||
      args.eventType === "subscription.canceled" ||
      args.eventType === "subscription.refunded"
    );
    const effectivePlanType = downgrade || preserveCurrentPlan ? existing.planType : args.planType;
    const effectiveProfile = downgrade || preserveCurrentPlan
      ? await currentPlanProfile(ctx, existing.planType)
      : profile;
    const retainPendingPlan = preserveCurrentPlan && existing.pendingPlanType !== undefined;
    const status = subscriptionStatus(args.eventType, args.cancelAtPeriodEnd);
    const subscriptionPatch = {
      userId,
      provider,
      externalSubscriptionId,
      planType: effectivePlanType,
      pendingPlanType: downgrade ? args.planType : retainPendingPlan ? existing.pendingPlanType : undefined,
      pendingPlanEffectiveAt: downgrade ? args.periodEnd : retainPendingPlan ? existing.pendingPlanEffectiveAt : undefined,
      status,
      currentPeriodStart: args.periodStart,
      currentPeriodEnd: args.periodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      gracePeriodEndsAt,
      latestEventOccurredAt: args.occurredAt,
      endedAt: status === "canceled" || status === "refunded" ? args.occurredAt : undefined,
      updatedAt: now,
    };
    const subscriptionId = existing?._id ?? await ctx.db.insert("subscriptions", {
      ...subscriptionPatch,
      createdAt: now,
    });
    if (existing) await ctx.db.patch(existing._id, subscriptionPatch);

    const grantId = await upsertSubscriptionGrant(ctx, {
      subscriptionId,
      userId,
      externalSubscriptionId,
      provider,
      entitlementProfileId: effectiveProfile._id,
      eventType: args.eventType,
      periodStart: args.periodStart,
      expiresAt: gracePeriodEndsAt,
      occurredAt: args.occurredAt,
    });
    await ctx.db.patch(subscriptionId, { entitlementGrantId: grantId });

    let creditGrantId: Id<"subscriptionCreditGrants"> | null = null;
    if ((args.eventType === "subscription.started" || args.eventType === "subscription.renewed") && args.monthlyCredits > 0) {
      creditGrantId = await grantPeriodCredits(ctx, {
        subscriptionId,
        userId,
        periodStart: args.periodStart,
        amount: args.monthlyCredits,
        billingEventId: eventId,
      });
    }
    await recordEvent(ctx, args, "processed", subscriptionId);
    return { status: "processed" as const, subscriptionId, grantId, creditGrantId };
  },
});

async function resolveSubscriptionUser(
  ctx: MutationCtx,
  existing: Doc<"subscriptions"> | null,
  rawUserId?: string
) {
  if (existing) {
    if (rawUserId) {
      const supplied = ctx.db.normalizeId("users", rawUserId);
      if (!supplied || supplied !== existing.userId) throw new Error("Subscription user does not match the existing record");
    }
    return existing.userId;
  }
  if (!rawUserId) throw new Error("New subscriptions require a user ID");
  const userId = ctx.db.normalizeId("users", rawUserId);
  if (!userId || !await ctx.db.get(userId)) throw new Error("Subscription user not found");
  return userId;
}

async function currentPlanProfile(ctx: MutationCtx, planType: UserPlan) {
  const profiles = await ctx.db.query("entitlementProfiles").withIndex("by_plan_revision", (q) => q.eq("planType", planType)).order("desc").collect();
  const profile = profiles.find((candidate) => candidate.isActive);
  if (!profile) throw new Error(`${planType} entitlement profile is not configured`);
  return profile;
}

async function upsertSubscriptionGrant(
  ctx: MutationCtx,
  input: {
    subscriptionId: Id<"subscriptions">;
    userId: Id<"users">;
    externalSubscriptionId: string;
    provider: string;
    entitlementProfileId: Id<"entitlementProfiles">;
    eventType: BillingEventType;
    periodStart: number;
    expiresAt: number;
    occurredAt: number;
  }
) {
  const sourceReference = `${input.provider}:${input.externalSubscriptionId}`;
  const existing = await ctx.db.query("accountEntitlementGrants").withIndex("by_source", (q) => q.eq("sourceType", "subscription").eq("sourceReference", sourceReference)).unique();
  const revokedAt = input.eventType === "subscription.refunded" ? input.occurredAt : undefined;
  const value = {
    userId: input.userId,
    sourceType: "subscription" as const,
    sourceReference,
    entitlementProfileId: input.entitlementProfileId,
    subscriptionId: input.subscriptionId,
    startsAt: existing?.startsAt ?? input.periodStart,
    expiresAt: input.eventType === "subscription.refunded" ? input.occurredAt : input.expiresAt,
    revokedAt,
    note: "Managed by billing webhook",
    createdAt: existing?.createdAt ?? Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, value);
    return existing._id;
  }
  return await ctx.db.insert("accountEntitlementGrants", value);
}

async function grantPeriodCredits(
  ctx: MutationCtx,
  input: { subscriptionId: Id<"subscriptions">; userId: Id<"users">; periodStart: number; amount: number; billingEventId: string }
) {
  const existing = await ctx.db.query("subscriptionCreditGrants").withIndex("by_subscription_period", (q) => q.eq("subscriptionId", input.subscriptionId).eq("periodStart", input.periodStart)).unique();
  if (existing) return existing._id;
  let account = await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", input.userId)).unique();
  if (!account) {
    const accountId = await ctx.db.insert("creditAccounts", { userId: input.userId, balance: 0, lifetimeGranted: 0, lifetimeSpent: 0, lastCreditEventAt: Date.now() });
    account = await ctx.db.get(accountId);
  }
  if (!account) throw new Error("Credit account could not be initialized");
  const balanceAfter = account.balance + input.amount;
  await ctx.db.patch(account._id, { balance: balanceAfter, lifetimeGranted: account.lifetimeGranted + input.amount, lastCreditEventAt: Date.now() });
  const creditTransactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: "subscription-credit",
    delta: input.amount,
    creditAmount: input.amount,
    balanceAfter,
    referenceTable: "subscriptions",
    referenceId: input.subscriptionId,
    description: "Subscription monthly Credits",
    sourceType: "subscription",
  });
  return await ctx.db.insert("subscriptionCreditGrants", {
    subscriptionId: input.subscriptionId,
    userId: input.userId,
    periodStart: input.periodStart,
    creditAmount: input.amount,
    creditTransactionId,
    billingEventId: input.billingEventId,
    grantedAt: Date.now(),
  });
}

async function recordEvent(
  ctx: MutationCtx,
  args: {
    eventId: string;
    provider: string;
    eventType: BillingEventType;
    externalSubscriptionId: string;
    occurredAt: number;
    payloadJson: string;
  },
  outcome: "processed" | "ignored-stale",
  subscriptionId: Id<"subscriptions">
) {
  await ctx.db.insert("billingWebhookEvents", {
    eventId: args.eventId,
    provider: args.provider,
    eventType: args.eventType,
    externalSubscriptionId: args.externalSubscriptionId,
    occurredAt: args.occurredAt,
    payloadJson: args.payloadJson.slice(0, 20_000),
    outcome,
    subscriptionId,
    processedAt: Date.now(),
  });
}

function subscriptionStatus(eventType: BillingEventType, cancelAtPeriodEnd: boolean) {
  if (eventType === "subscription.refunded") return "refunded" as const;
  if (eventType === "subscription.canceled") return "canceled" as const;
  if (eventType === "subscription.payment_failed") return "past-due" as const;
  return cancelAtPeriodEnd ? "canceling" as const : "active" as const;
}

function graceEnd(eventType: BillingEventType, periodEnd: number, occurredAt: number) {
  if (eventType === "subscription.refunded") return occurredAt;
  if (eventType === "subscription.payment_failed") return occurredAt + GRACE_PERIOD_MS;
  return periodEnd + GRACE_PERIOD_MS;
}

function planRank(planType: UserPlan) {
  return planType === "studio" ? 2 : planType === "pro" ? 1 : 0;
}

function validatePeriod(start: number, end: number) {
  validateTimestamp(start, "Billing period start");
  validateTimestamp(end, "Billing period end");
  if (end <= start) throw new Error("Billing period end must be after its start");
}

function validateTimestamp(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive millisecond timestamp`);
}

function requiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${label} is required and must be ${maxLength} characters or fewer`);
  return normalized;
}
