import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const canonicalForOrder = internalQuery({
  args: { orderId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId) return null;
    const alias = await ctx.db.query("waffoSubscriptionOrderAliases")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId)).unique();
    if (alias && alias.userId !== userId) throw new Error("Waffo order belongs to another account");
    return alias?.canonicalOrderId ?? args.orderId;
  },
});

export const isSuperseded = internalQuery({
  args: { canonicalOrderId: v.string() },
  handler: async (ctx, args) => {
    const aliases = await ctx.db.query("waffoSubscriptionOrderAliases")
      .withIndex("by_canonicalOrderId", (q) => q.eq("canonicalOrderId", args.canonicalOrderId)).take(1);
    return aliases.length > 0;
  },
});

export const linkPlanChange = internalMutation({
  args: {
    newOrderId: v.string(),
    userId: v.string(),
    targetPlan: v.union(v.literal("pro"), v.literal("studio")),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId || !await ctx.db.get(userId)) throw new Error("Waffo plan change buyer not found");
    const previousAlias = await ctx.db.query("waffoSubscriptionOrderAliases")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.newOrderId)).unique();
    if (previousAlias) {
      if (previousAlias.userId !== userId) throw new Error("Waffo plan change order belongs to another user");
      return previousAlias.canonicalOrderId;
    }
    const subscriptions = await ctx.db.query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    const candidates = subscriptions.filter((subscription) =>
      subscription.provider === "waffo" && subscription.planType !== args.targetPlan &&
      ["active", "canceling", "canceled"].includes(subscription.status) &&
      subscription.currentPeriodEnd > args.periodStart &&
      subscription.currentPeriodStart < args.periodEnd
    );
    if (candidates.length !== 1 || candidates[0]?.externalSubscriptionId === args.newOrderId) {
      throw new Error("Existing Waffo subscription for plan change is ambiguous");
    }
    const canonicalOrderId = candidates[0].externalSubscriptionId;
    await ctx.db.insert("waffoSubscriptionOrderAliases", {
      orderId: args.newOrderId,
      canonicalOrderId,
      userId,
      createdAt: Date.now(),
    });
    return canonicalOrderId;
  },
});
