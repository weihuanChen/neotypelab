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
    externalTransactionId: v.optional(v.string()),
    credits: vPackCredits,
    priceMinor: v.number(),
    totalMinor: v.number(),
    currency: v.string(),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const expectedProductId = {
      64: process.env.CREEM_CREDIT_PACK_64_PRODUCT_ID,
      160: process.env.CREEM_CREDIT_PACK_160_PRODUCT_ID,
      400: process.env.CREEM_CREDIT_PACK_400_PRODUCT_ID,
    }[args.credits]?.trim();
    if (
      !expectedProductId || expectedProductId !== args.productId ||
      args.priceMinor !== CREDIT_PACK_SPECS[args.credits].priceMinor ||
      !Number.isInteger(args.totalMinor) || args.totalMinor <= 0 || args.currency !== "USD"
    ) {
      throw new Error("Creem Credit Pack does not match the catalog");
    }
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId || !await ctx.db.get(userId)) throw new Error("Credit Pack buyer not found");
    const existing = await ctx.db.query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.externalOrderId))
      .unique();
    if (existing) {
      if (existing.userId !== userId || existing.paymentProvider !== "creem") {
        throw new Error("Creem order is already assigned to another account");
      }
      return { status: "duplicate" as const, orderId: existing._id };
    }

    const orderId = await ctx.db.insert("orders", {
      userId,
      orderNumber: args.externalOrderId,
      status: "paid",
      currency: args.currency,
      subtotalMinor: args.priceMinor,
      totalMinor: args.totalMinor,
      paymentProvider: "creem",
      externalPaymentId: args.externalTransactionId,
      completedAt: args.occurredAt,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("orderItems", {
      orderId,
      productType: "credit-pack",
      referenceId: args.productId,
      title: `${args.credits} Credit Pack`,
      quantity: 1,
      unitAmountMinor: args.totalMinor,
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
    externalTransactionId: v.string(),
    refundAmountMinor: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.eventId.trim() || !Number.isInteger(args.refundAmountMinor) || args.refundAmountMinor <= 0) {
      throw new Error("Invalid Creem refund event");
    }
    const duplicate = await ctx.db.query("creditPackRefunds")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (duplicate) return { status: "duplicate" as const };
    const order = await ctx.db.query("orders")
      .withIndex("by_provider_payment", (q) => q.eq("paymentProvider", "creem").eq("externalPaymentId", args.externalTransactionId))
      .unique();
    if (!order) return { status: "not-credit-pack" as const };
    if (order.status === "refunded") return { status: "duplicate" as const };
    const items = await ctx.db.query("orderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    const item = items.find((candidate) => candidate.productType === "credit-pack");
    if (!item?.metadataJson) throw new Error("Credit Pack order item is missing");
    const metadata = JSON.parse(item.metadataJson) as { credits?: unknown };
    if (metadata.credits !== 64 && metadata.credits !== 160 && metadata.credits !== 400) {
      throw new Error("Credit Pack amount is invalid");
    }
    const previous = await ctx.db.query("creditPackRefunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    const previouslyRefundedMinor = previous.reduce((sum, item) => sum + item.refundAmountMinor, 0);
    const cumulativeRefundMinor = Math.min(order.totalMinor, previouslyRefundedMinor + args.refundAmountMinor);
    const previousTarget = Math.floor(metadata.credits * Math.min(order.totalMinor, previouslyRefundedMinor) / order.totalMinor);
    const nextTarget = Math.floor(metadata.credits * cumulativeRefundMinor / order.totalMinor);
    const creditsToRevoke = Math.max(0, nextTarget - previousTarget);
    const reversal = creditsToRevoke > 0 ? await revokeRefundedPackCredits(ctx, {
      userId: order.userId,
      orderId: order._id,
      amount: creditsToRevoke,
    }) : null;
    await ctx.db.insert("creditPackRefunds", {
      eventId: args.eventId,
      orderId: order._id,
      refundAmountMinor: args.refundAmountMinor,
      creditAmountRevoked: reversal?.revokedAmount ?? 0,
      createdAt: Date.now(),
    });
    const fullyRefunded = cumulativeRefundMinor >= order.totalMinor;
    await ctx.db.patch(order._id, {
      status: fullyRefunded ? "refunded" : "partially-refunded",
      updatedAt: Date.now(),
    });
    return { status: fullyRefunded ? "refunded" as const : "partially-refunded" as const };
  },
});
