"use node";

import { WaffoPancake, verifyWebhook, type WebhookEvent, type WebhookEventData } from "@waffo/pancake-ts";
import { v } from "convex/values";
import {
  CREDIT_PACK_SPECS,
  PRO_MONTHLY_CREDITS,
  PRO_MONTHLY_PRICE_MINOR,
  STUDIO_MONTHLY_CREDITS,
  STUDIO_MONTHLY_PRICE_MINOR,
} from "../lib/productPricing";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { dollarsToMinor, mappedWaffoProduct } from "./waffoCatalog";

type IngestResult =
  | { status: "recorded" | "duplicate" }
  | { status: "invalid-signature" | "wrong-store" | "not-configured" };

type OneTimeOrder = {
  id: string;
  status: string;
  testMode: boolean;
  priceSnapshot: { currency: string; subtotal: string; total: string };
  onetimeProduct: { id: string };
};

type SubscriptionOrder = {
  id: string;
  status: string;
  billingPeriod: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  priceSnapshot: { currency: string; regularPhase: { subtotal: string; total: string } };
  subscriptionProduct: { id: string };
};

const subscriptionEvents = {
  "subscription.activated": "subscription.started",
  "subscription.renewed": "subscription.renewed",
  "subscription.recovered": "subscription.updated",
  "subscription.plan_changed": "subscription.updated",
  "subscription.canceling": "subscription.canceled",
  "subscription.uncanceled": "subscription.updated",
  "subscription.canceled": "subscription.canceled",
  "subscription.past_due": "subscription.payment_failed",
} as const;

export const receive = internalAction({
  args: { body: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<IngestResult> => {
    const environment = process.env.WAFFO_ENVIRONMENT?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if ((environment !== "test" && environment !== "prod") || !storeId) {
      return { status: "not-configured" };
    }

    let event: WebhookEvent<WebhookEventData>;
    try {
      event = verifyWebhook<WebhookEventData>(args.body, args.signature, { environment });
    } catch {
      return { status: "invalid-signature" };
    }
    const occurredAt = Date.parse(event.timestamp);
    const data: unknown = event.data;
    if (event.mode !== environment || event.storeId !== storeId) return { status: "wrong-store" };
    if (!event.id || !event.eventType || !data || typeof data !== "object" || !Number.isFinite(occurredAt)) {
      return { status: "invalid-signature" };
    }
    const eventKey = `${event.eventType}:${event.id}:${event.timestamp}`;
    const orderId = typeof event.data.orderId === "string" ? event.data.orderId.trim() : "";
    const buyerIdentity = event.data.merchantProvidedBuyerIdentity?.trim();
    const metadataUserId = typeof event.data.orderMetadata?.convexUserId === "string"
      ? event.data.orderMetadata.convexUserId.trim() : undefined;
    const record = async (outcome: "verified-unmapped" | "processed" | "ignored") => await ctx.runMutation(
      internal.waffoWebhookEvents.record,
      {
        eventId: eventKey,
        businessEventId: event.eventId || "",
        eventType: event.eventType,
        storeId: event.storeId,
        mode: environment,
        orderId: orderId || undefined,
        orderMerchantExternalId: event.data.orderMerchantExternalId || undefined,
        buyerIdentity,
        metadataUserId,
        occurredAt,
        outcome,
      }
    );
    const mappedType = Object.prototype.hasOwnProperty.call(subscriptionEvents, event.eventType)
      ? subscriptionEvents[event.eventType as keyof typeof subscriptionEvents] : null;
    if (event.eventType !== "order.completed" && event.eventType !== "refund.succeeded" && !mappedType) {
      return await record("ignored");
    }
    if (!orderId || !buyerIdentity || !metadataUserId) return await record("verified-unmapped");
    const userId = await ctx.runQuery(internal.waffoWebhookEvents.resolveBuyer, {
      buyerIdentity,
      metadataUserId,
    });
    if (!userId) return await record("verified-unmapped");

    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    if (!merchantId || !privateKey) return { status: "not-configured" };
    const client = new WaffoPancake({ merchantId, privateKey });

    if (event.eventType === "order.completed") {
      const order = await loadOneTimeOrder(client, orderId);
      const product = mappedWaffoProduct(order.onetimeProduct.id);
      const credits = product === "pack64" ? 64 : product === "pack160" ? 160 : product === "pack400" ? 400 : null;
      if (!credits || event.data.orderMetadata?.catalogKey !== product) return await record("verified-unmapped");
      const listPriceMinor = dollarsToMinor(order.priceSnapshot.subtotal);
      const chargedMinor = dollarsToMinor(event.data.chargedAmount ?? event.data.amount);
      if (
        order.testMode !== (environment === "test") || order.status !== "completed" ||
        event.data.paymentStatus !== "succeeded" || event.data.currency !== "USD" ||
        order.priceSnapshot.currency !== "USD" ||
        listPriceMinor !== CREDIT_PACK_SPECS[credits].priceMinor ||
        !chargedMinor || !event.data.paymentId
      ) throw new Error("Waffo Credit Pack payment does not match the paid order");
      await ctx.runMutation(internal.waffoPackOrders.fulfill, {
        userId,
        productId: order.onetimeProduct.id,
        externalOrderId: orderId,
        paymentId: event.data.paymentId,
        credits,
        listPriceMinor,
        chargedMinor,
        currency: "USD",
        occurredAt,
      });
      return await record("processed");
    }

    if (event.eventType === "refund.succeeded") {
      const checkoutKey = event.data.orderMetadata?.catalogKey;
      if (checkoutKey === "pack64" || checkoutKey === "pack160" || checkoutKey === "pack400") {
        const oneTimeOrder = await loadOneTimeOrder(client, orderId);
        const product = mappedWaffoProduct(oneTimeOrder.onetimeProduct.id);
        if (product !== checkoutKey) {
          return await record("verified-unmapped");
        }
        const refundAmountMinor = dollarsToMinor(event.data.refundedAmount ?? event.data.amount);
        if (event.data.refundStatus !== "succeeded" || !refundAmountMinor) {
          throw new Error("Waffo Credit Pack refund amount is invalid");
        }
        const result = await ctx.runMutation(internal.waffoPackOrders.refund, {
          eventId: eventKey,
          externalOrderId: orderId,
          refundAmountMinor,
        });
        if (result.status === "not-credit-pack") throw new Error("Waffo Credit Pack purchase has not synced");
        return await record("processed");
      }
      if (checkoutKey !== "pro" && checkoutKey !== "studio") return await record("verified-unmapped");
      const subscription = await loadSubscriptionOrder(client, orderId);
      const plan = mappedWaffoProduct(subscription.subscriptionProduct.id);
      if (plan !== "pro" && plan !== "studio") return await record("verified-unmapped");
      if (await ctx.runQuery(internal.waffoSubscriptionOrders.isSuperseded, { canonicalOrderId: orderId })) {
        return await record("ignored");
      }
      if (!["canceled", "expired"].includes(subscription.status)) return await record("ignored");
      if (event.data.refundStatus !== "succeeded") throw new Error("Waffo subscription refund status is invalid");
      const canonicalOrderId = await ctx.runQuery(internal.waffoSubscriptionOrders.canonicalForOrder, { orderId, userId });
      if (!canonicalOrderId) return await record("verified-unmapped");
      const applied = await processSubscription(ctx, event, subscription, plan, userId, occurredAt, "subscription.refunded", false, canonicalOrderId, eventKey);
      return await record(applied ? "processed" : "ignored");
    }

    const subscription = await loadSubscriptionOrder(client, orderId);
    const plan = mappedWaffoProduct(subscription.subscriptionProduct.id);
    if (plan !== "pro" && plan !== "studio") return await record("verified-unmapped");
    const checkoutKey = event.data.orderMetadata?.catalogKey;
    if (checkoutKey !== "pro" && checkoutKey !== "studio") return await record("verified-unmapped");
    if (event.eventType === "subscription.activated" && checkoutKey !== plan) {
      return await record("verified-unmapped");
    }
    if (!mappedType) return await record("ignored");
    if (event.eventType === "subscription.canceled" &&
        await ctx.runQuery(internal.waffoSubscriptionOrders.isSuperseded, { canonicalOrderId: orderId })) {
      return await record("ignored");
    }
    let canonicalOrderId: string | null;
    if (event.eventType === "subscription.plan_changed") {
      const planChange = (event.data as WebhookEventData & { planChange?: { direction?: string } }).planChange;
      if (!planChange || !["upgrade", "downgrade"].includes(planChange.direction ?? "")) {
        return await record("verified-unmapped");
      }
      canonicalOrderId = await ctx.runMutation(internal.waffoSubscriptionOrders.linkPlanChange, {
        newOrderId: orderId,
        userId,
        targetPlan: plan,
        periodStart: Date.parse(subscription.currentPeriodStart),
        periodEnd: Date.parse(subscription.currentPeriodEnd),
      });
    } else {
      canonicalOrderId = await ctx.runQuery(internal.waffoSubscriptionOrders.canonicalForOrder, { orderId, userId });
    }
    if (!canonicalOrderId) return await record("verified-unmapped");
    if (event.eventType === "subscription.activated" && canonicalOrderId !== orderId) {
      return await record("ignored");
    }
    const applied = await processSubscription(
      ctx,
      event,
      subscription,
      plan,
      userId,
      occurredAt,
      mappedType,
      event.eventType === "subscription.canceling",
      canonicalOrderId,
      eventKey
    );
    return await record(applied ? "processed" : "ignored");
  },
});

async function loadOneTimeOrder(client: WaffoPancake, id: string): Promise<OneTimeOrder> {
  const result = await client.graphql.query<{ onetimeOrder: OneTimeOrder | null }>({
    query: `query ($id: String!) {
      onetimeOrder(id: $id) {
        id status testMode priceSnapshot { currency subtotal total } onetimeProduct { id }
      }
    }`,
    variables: { id },
  });
  if (result.errors?.length || !result.data?.onetimeOrder) throw new Error("Waffo one-time order is unavailable");
  return result.data.onetimeOrder;
}

async function loadSubscriptionOrder(client: WaffoPancake, id: string): Promise<SubscriptionOrder> {
  const result = await client.graphql.query<{ subscriptionOrder: SubscriptionOrder | null }>({
    query: `query ($id: String!) {
      subscriptionOrder(id: $id) {
        id status billingPeriod currentPeriodStart currentPeriodEnd
        priceSnapshot { currency regularPhase { subtotal total } }
        subscriptionProduct { id }
      }
    }`,
    variables: { id },
  });
  if (result.errors?.length || !result.data?.subscriptionOrder) throw new Error("Waffo subscription order is unavailable");
  return result.data.subscriptionOrder;
}

async function processSubscription(
  ctx: ActionCtx,
  event: WebhookEvent<WebhookEventData>,
  order: SubscriptionOrder,
  plan: "pro" | "studio",
  userId: string,
  occurredAt: number,
  eventType: "subscription.started" | "subscription.renewed" | "subscription.updated" |
    "subscription.canceled" | "subscription.payment_failed" | "subscription.refunded",
  cancelAtPeriodEnd: boolean,
  canonicalOrderId: string,
  eventKey: string
): Promise<boolean> {
  const periodStart = Date.parse(order.currentPeriodStart);
  const periodEnd = Date.parse(order.currentPeriodEnd);
  if (eventType !== "subscription.refunded" && (
    !sameCalendarDay(event.data.currentPeriodStart, order.currentPeriodStart) ||
    !sameCalendarDay(event.data.currentPeriodEnd, order.currentPeriodEnd)
  )) return false;
  const expectedPrice = plan === "pro" ? PRO_MONTHLY_PRICE_MINOR : STUDIO_MONTHLY_PRICE_MINOR;
  if (
    order.billingPeriod !== "monthly" ||
    (eventType !== "subscription.refunded" && event.data.billingPeriod !== "monthly") ||
    order.priceSnapshot.currency !== "USD" || event.data.currency !== "USD" ||
    dollarsToMinor(order.priceSnapshot.regularPhase.subtotal) !== expectedPrice ||
    !Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart
  ) throw new Error("Waffo subscription does not match the monthly catalog");
  await ctx.runMutation(internal.subscriptions.processWebhookEvent, {
    eventId: eventKey,
    provider: "waffo",
    eventType,
    externalSubscriptionId: canonicalOrderId,
    userId,
    planType: plan,
    periodStart,
    periodEnd,
    monthlyCredits: eventType === "subscription.started" || eventType === "subscription.renewed"
      ? plan === "pro" ? PRO_MONTHLY_CREDITS : STUDIO_MONTHLY_CREDITS : 0,
    cancelAtPeriodEnd,
    occurredAt,
    payloadJson: JSON.stringify({ waffoEventType: event.eventType, orderId: order.id, productId: order.subscriptionProduct.id }),
  });
  return true;
}

function sameCalendarDay(eventValue: string | undefined, orderValue: string): boolean {
  const parsed = Date.parse(eventValue ?? "");
  const order = Date.parse(orderValue);
  return Number.isFinite(parsed) && Number.isFinite(order) &&
    new Date(parsed).toISOString().slice(0, 10) === new Date(order).toISOString().slice(0, 10);
}
