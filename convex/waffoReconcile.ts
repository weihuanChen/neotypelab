"use node";

import { WaffoPancake } from "@waffo/pancake-ts";
import { v } from "convex/values";
import {
  PRO_MONTHLY_CREDITS,
  PRO_MONTHLY_PRICE_MINOR,
  STUDIO_MONTHLY_CREDITS,
  STUDIO_MONTHLY_PRICE_MINOR,
} from "../lib/productPricing";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { dollarsToMinor, mappedWaffoProduct } from "./waffoCatalog";

export const subscription = internalAction({
  args: { orderId: v.string() },
  returns: v.object({
    status: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("ignored-stale")),
    plan: v.union(v.literal("pro"), v.literal("studio")),
    periodStart: v.number(),
    periodEnd: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    status: "processed" | "duplicate" | "ignored-stale";
    plan: "pro" | "studio";
    periodStart: number;
    periodEnd: number;
  }> => {
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if (!["test", "prod"].includes(process.env.WAFFO_ENVIRONMENT ?? "") || !merchantId || !privateKey || !storeId) {
      throw new Error("Waffo is not configured");
    }
    const receipt = await ctx.runQuery(internal.waffoWebhookEvents.trustedBuyerForOrder, {
      orderId: args.orderId,
      storeId,
    });
    if (!receipt?.userId) throw new Error("No signed Waffo payment receipt is linked to this order");
    const client = new WaffoPancake({ merchantId, privateKey });
    const result = await client.graphql.query<{
      subscriptionOrder: {
        id: string;
        status: string;
        billingPeriod: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        priceSnapshot: { currency: string; regularPhase: { subtotal: string } };
        subscriptionProduct: { id: string };
      } | null;
    }>({
      query: `query ($id: String!) {
        subscriptionOrder(id: $id) {
          id status billingPeriod currentPeriodStart currentPeriodEnd
          priceSnapshot { currency regularPhase { subtotal } }
          subscriptionProduct { id }
        }
      }`,
      variables: { id: args.orderId },
    });
    const order = result.data?.subscriptionOrder;
    const plan = order ? mappedWaffoProduct(order.subscriptionProduct.id) : null;
    const periodStart = Date.parse(order?.currentPeriodStart ?? "");
    const periodEnd = Date.parse(order?.currentPeriodEnd ?? "");
    if (
      result.errors?.length || !order || order.id !== args.orderId ||
      (plan !== "pro" && plan !== "studio") ||
      !["active", "canceling"].includes(order.status) ||
      order.billingPeriod !== "monthly" || order.priceSnapshot.currency !== "USD" ||
      dollarsToMinor(order.priceSnapshot.regularPhase.subtotal) !==
        (plan === "pro" ? PRO_MONTHLY_PRICE_MINOR : STUDIO_MONTHLY_PRICE_MINOR) ||
      !Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart
    ) throw new Error("Waffo subscription order is not eligible for reconciliation");
    const processed = await ctx.runMutation(internal.subscriptions.processWebhookEvent, {
      eventId: `waffo-reconcile:${args.orderId}:${periodStart}`,
      provider: "waffo",
      eventType: "subscription.started",
      externalSubscriptionId: order.id,
      userId: receipt.userId,
      planType: plan,
      periodStart,
      periodEnd,
      monthlyCredits: plan === "pro" ? PRO_MONTHLY_CREDITS : STUDIO_MONTHLY_CREDITS,
      cancelAtPeriodEnd: order.status === "canceling",
      occurredAt: receipt.occurredAt,
      payloadJson: JSON.stringify({ source: "signed-payment-reconciliation", orderId: order.id, productId: order.subscriptionProduct.id }),
    });
    return { status: processed.status, plan, periodStart, periodEnd };
  },
});

export const planChange = internalAction({
  args: { orderId: v.string() },
  returns: v.object({
    status: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("ignored-stale")),
    plan: v.literal("studio"),
    canonicalOrderId: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    status: "processed" | "duplicate" | "ignored-stale";
    plan: "studio";
    canonicalOrderId: string;
  }> => {
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if (!["test", "prod"].includes(process.env.WAFFO_ENVIRONMENT ?? "") || !merchantId || !privateKey || !storeId) {
      throw new Error("Waffo is not configured");
    }
    const receipt = await ctx.runQuery(internal.waffoWebhookEvents.trustedBuyerForOrder, {
      orderId: args.orderId,
      storeId,
    });
    if (!receipt?.userId) throw new Error("No signed Waffo payment receipt is linked to this plan change");
    const client = new WaffoPancake({ merchantId, privateKey });
    const result = await client.graphql.query<{
      subscriptionOrder: {
        id: string;
        status: string;
        billingPeriod: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        priceSnapshot: { currency: string; regularPhase: { subtotal: string } };
        subscriptionProduct: { id: string };
      } | null;
    }>({
      query: `query ($id: String!) {
        subscriptionOrder(id: $id) {
          id status billingPeriod currentPeriodStart currentPeriodEnd
          priceSnapshot { currency regularPhase { subtotal } }
          subscriptionProduct { id }
        }
      }`,
      variables: { id: args.orderId },
    });
    const order = result.data?.subscriptionOrder;
    const plan = order ? mappedWaffoProduct(order.subscriptionProduct.id) : null;
    const periodStart = Date.parse(order?.currentPeriodStart ?? "");
    const periodEnd = Date.parse(order?.currentPeriodEnd ?? "");
    if (
      result.errors?.length || !order || order.id !== args.orderId || plan !== "studio" ||
      order.status !== "active" || order.billingPeriod !== "monthly" ||
      order.priceSnapshot.currency !== "USD" ||
      dollarsToMinor(order.priceSnapshot.regularPhase.subtotal) !== STUDIO_MONTHLY_PRICE_MINOR ||
      !Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart
    ) throw new Error("Waffo Studio order is not eligible for plan change reconciliation");
    const canonicalOrderId = await ctx.runMutation(internal.waffoSubscriptionOrders.linkPlanChange, {
      newOrderId: order.id,
      userId: receipt.userId,
      targetPlan: "studio",
      periodStart,
      periodEnd,
    });
    const processed = await ctx.runMutation(internal.subscriptions.processWebhookEvent, {
      eventId: `waffo-reconcile-plan-change:${args.orderId}`,
      provider: "waffo",
      eventType: "subscription.updated",
      externalSubscriptionId: canonicalOrderId,
      userId: receipt.userId,
      planType: "studio",
      periodStart,
      periodEnd,
      monthlyCredits: 0,
      cancelAtPeriodEnd: false,
      occurredAt: receipt.occurredAt,
      payloadJson: JSON.stringify({ source: "signed-plan-change-reconciliation", orderId: order.id, productId: order.subscriptionProduct.id }),
    });
    return { status: processed.status, plan: "studio", canonicalOrderId };
  },
});
