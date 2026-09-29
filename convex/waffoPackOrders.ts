import { v } from "convex/values";
import { CREDIT_PACK_SPECS } from "../lib/productPricing";
import { grantPermanentCredits, revokeRefundedPackCredits } from "./creditLedger";
import { internalMutation } from "./functions";

const vPackCredits = v.union(v.literal(64), v.literal(160), v.literal(400));

export const fulfill = internalMutation({
  args: {
    userId: v.string(),
    productId: v.string(),
    externalOrderId: v.string(),
    paymentId: v.string(),
    credits: vPackCredits,
    listPriceMinor: v.number(),
    chargedMinor: v.number(),
    currency: v.string(),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const configuredId = {
      64: process.env.WAFFO_CREDIT_PACK_64_PRODUCT_ID,
      160: process.env.WAFFO_CREDIT_PACK_160_PRODUCT_ID,
      400: process.env.WAFFO_CREDIT_PACK_400_PRODUCT_ID,
    }[args.credits]?.trim();
    if (
      !configuredId || configuredId !== args.productId ||
      args.listPriceMinor !== CREDIT_PACK_SPECS[args.credits].priceMinor ||
      !Number.isSafeInteger(args.chargedMinor) || args.chargedMinor <= 0 ||
      args.currency !== "USD" || !args.paymentId.trim() || !args.externalOrderId.trim()
    ) {
      throw new Error("Waffo Credit Pack does not match the paid catalog");
    }
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId || !await ctx.db.get(userId)) throw new Error("Waffo Credit Pack buyer not found");
    const existing = await ctx.db.query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.externalOrderId))
      .unique();
    if (existing) {
      if (existing.userId !== userId || existing.paymentProvider !== "waffo" ||
          existing.externalPaymentId !== args.paymentId) {
        throw new Error("Waffo order is already assigned to a different purchase");
      }
      return { status: "duplicate" as const, orderId: existing._id };
    }
    const orderId = await ctx.db.insert("orders", {
      userId,
      orderNumber: args.externalOrderId,
      status: "paid",
      currency: "USD",
      subtotalMinor: args.listPriceMinor,
      totalMinor: args.chargedMinor,
      paymentProvider: "waffo",
      externalPaymentId: args.paymentId,
      completedAt: args.occurredAt,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("orderItems", {
      orderId,
      productType: "credit-pack",
      referenceId: args.productId,
      title: `${args.credits} Credit Pack`,
      quantity: 1,
      unitAmountMinor: args.listPriceMinor,
      metadataJson: JSON.stringify({ credits: args.credits }),
    });
    await grantPermanentCredits(ctx, {
      userId,
      actionType: "credit-pack-purchase",
      amount: args.credits,
      metadata: {
        orderId,
        referenceTable: "orders",
        referenceId: args.externalOrderId,
        sourceType: "purchased",
        description: `${args.credits} permanent Credits purchased`,
      },
    });
    return { status: "fulfilled" as const, orderId };
  },
});

export const refund = internalMutation({
  args: {
    eventId: v.string(),
    externalOrderId: v.string(),
    refundAmountMinor: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.eventId.trim() || !args.externalOrderId.trim() ||
        !Number.isSafeInteger(args.refundAmountMinor) || args.refundAmountMinor <= 0) {
      throw new Error("Invalid Waffo refund event");
    }
    const previousEvent = await ctx.db.query("creditPackRefunds")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId)).unique();
    if (previousEvent) return { status: "duplicate" as const };
    const order = await ctx.db.query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.externalOrderId)).unique();
    if (!order || order.paymentProvider !== "waffo") return { status: "not-credit-pack" as const };
    if (order.status === "refunded") return { status: "duplicate" as const };
    const items = await ctx.db.query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id)).collect();
    const item = items.find((candidate) => candidate.productType === "credit-pack");
    const credits = item?.metadataJson ? (JSON.parse(item.metadataJson) as { credits?: unknown }).credits : undefined;
    if (credits !== 64 && credits !== 160 && credits !== 400) {
      throw new Error("Waffo Credit Pack order item is missing");
    }
    const previous = await ctx.db.query("creditPackRefunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id)).collect();
    const refundedBefore = previous.reduce((sum, entry) => sum + entry.refundAmountMinor, 0);
    const refundedAfter = Math.min(order.totalMinor, refundedBefore + args.refundAmountMinor);
    const previousTarget = Math.floor(credits * Math.min(order.totalMinor, refundedBefore) / order.totalMinor);
    const nextTarget = Math.floor(credits * refundedAfter / order.totalMinor);
    const revoked = nextTarget > previousTarget ? await revokeRefundedPackCredits(ctx, {
      userId: order.userId,
      orderId: order._id,
      amount: nextTarget - previousTarget,
    }) : null;
    await ctx.db.insert("creditPackRefunds", {
      eventId: args.eventId,
      orderId: order._id,
      refundAmountMinor: args.refundAmountMinor,
      creditAmountRevoked: revoked?.revokedAmount ?? 0,
      createdAt: Date.now(),
    });
    const fullyRefunded = refundedAfter >= order.totalMinor;
    await ctx.db.patch(order._id, {
      status: fullyRefunded ? "refunded" : "partially-refunded",
      updatedAt: Date.now(),
    });
    return { status: fullyRefunded ? "refunded" as const : "partially-refunded" as const };
  },
});
