import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const resolveBuyer = internalQuery({
  args: { buyerIdentity: v.optional(v.string()), metadataUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const buyerIdentity = args.buyerIdentity?.trim();
    if (!buyerIdentity || buyerIdentity !== args.metadataUserId?.trim()) return null;
    const userId = ctx.db.normalizeId("users", buyerIdentity);
    return userId && await ctx.db.get(userId) ? userId : null;
  },
});

export const trustedBuyerForOrder = internalQuery({
  args: { orderId: v.string(), storeId: v.string() },
  handler: async (ctx, args) => {
    const events = await ctx.db.query("waffoWebhookEvents")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId)).collect();
    const trusted = events.filter((event) =>
      event.mode === "test" && event.storeId === args.storeId &&
      event.eventType === "subscription.payment_succeeded" && event.buyerUserId !== undefined
    );
    const users = new Set(trusted.map((event) => event.buyerUserId));
    if (users.size !== 1) return null;
    const receipt = trusted[0];
    if (!receipt.buyerUserId) return null;
    return { userId: receipt.buyerUserId, occurredAt: receipt.occurredAt };
  },
});

export const record = internalMutation({
  args: {
    eventId: v.string(),
    businessEventId: v.string(),
    eventType: v.string(),
    storeId: v.string(),
    mode: v.union(v.literal("test"), v.literal("prod")),
    orderId: v.optional(v.string()),
    orderMerchantExternalId: v.optional(v.string()),
    buyerIdentity: v.optional(v.string()),
    metadataUserId: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("verified-unmapped"), v.literal("processed"), v.literal("ignored"))),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.eventId.trim() || !args.eventType.trim() || !args.storeId.trim()) {
      throw new Error("Waffo event identifiers are missing");
    }
    const existing = await ctx.db.query("waffoWebhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) return { status: "duplicate" as const };
    const buyerIdentity = args.buyerIdentity?.trim();
    const metadataUserId = args.metadataUserId?.trim();
    const candidate = buyerIdentity && (!metadataUserId || metadataUserId === buyerIdentity)
      ? ctx.db.normalizeId("users", buyerIdentity) : null;
    const buyerUserId = candidate && await ctx.db.get(candidate) ? candidate : undefined;
    await ctx.db.insert("waffoWebhookEvents", {
      eventId: args.eventId,
      businessEventId: args.businessEventId,
      eventType: args.eventType,
      storeId: args.storeId,
      mode: args.mode,
      orderId: args.orderId,
      orderMerchantExternalId: args.orderMerchantExternalId,
      buyerUserId,
      occurredAt: args.occurredAt,
      receivedAt: Date.now(),
      outcome: args.outcome ?? "verified-unmapped",
    });
    return { status: "recorded" as const };
  },
});
