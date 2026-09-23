import type { CreemWebhookEvent, WebhookEventHandlers } from "@mmailaender/convex-creem";
import {
  CREDIT_PACK_SPECS,
  PRO_MONTHLY_CREDITS,
  STUDIO_MONTHLY_CREDITS,
} from "../lib/productPricing";
import { components, internal } from "./_generated/api";

type EventCtx = Parameters<WebhookEventHandlers[string]>[0];
type CreemEventInput = CreemWebhookEvent & {
  id?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
};
type BillingEventType = "subscription.started" | "subscription.renewed" |
  "subscription.updated" | "subscription.payment_failed" | "subscription.canceled" | "subscription.refunded";

type SyncedSubscription = {
  id: string;
  productId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, unknown>;
};

type SubscriptionCatalog = { proProductId?: string; studioProductId?: string };

const eventTypes: Partial<Record<string, BillingEventType>> = {
  "checkout.completed": "subscription.started",
  "subscription.paid": "subscription.renewed",
  "subscription.active": "subscription.updated",
  "subscription.update": "subscription.updated",
  "subscription.scheduled_cancel": "subscription.canceled",
  "subscription.canceled": "subscription.canceled",
  "subscription.expired": "subscription.canceled",
  "subscription.unpaid": "subscription.payment_failed",
  "subscription.past_due": "subscription.payment_failed",
  "refund.created": "subscription.refunded",
};

export async function handleCreemSubscriptionEvent(ctx: EventCtx, event: CreemEventInput) {
  const catalog = subscriptionCatalog();
  const eventType = readText(event.type) ?? readText(event.eventType);
  if (!eventType || !eventTypes[eventType]) return;
  if (eventType === "refund.created" && !isCanceledRefund(event.data ?? event.object)) return;

  const subscriptionId = extractCreemSubscriptionId(eventType, event.data ?? event.object);
  if (!subscriptionId) throw new Error(`Creem ${eventType} has no subscription ID`);
  const subscription = await ctx.runQuery(components.creem.lib.getSubscription, { id: subscriptionId });
  if (!subscription) throw new Error(`Creem subscription ${subscriptionId} has not synced`);
  const normalized = normalizeCreemSubscriptionEvent(event, subscription, catalog);
  if (!normalized) return;
  await ctx.runMutation(internal.subscriptions.processWebhookEvent, normalized);
}

export function normalizeCreemSubscriptionEvent(
  event: CreemEventInput,
  subscription: SyncedSubscription,
  catalog: SubscriptionCatalog
) {
  const eventType = readText(event.type) ?? readText(event.eventType);
  if (!eventType || !eventTypes[eventType]) return null;
  const planType: "pro" | "studio" | null = subscription.productId === catalog.proProductId ? "pro"
    : subscription.productId === catalog.studioProductId ? "studio"
    : null;
  if (!planType) return null;
  if (eventType === "refund.created" && !isCanceledRefund(event.data ?? event.object)) return null;
  const raw = asRecord(event);
  const eventId = readText(raw.id);
  if (!eventId) throw new Error("Creem webhook event ID is missing");
  const periodStart = Date.parse(subscription.currentPeriodStart);
  const periodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : NaN;
  if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart) {
    throw new Error("Creem subscription period is invalid");
  }
  const occurredAt = readTimestamp(raw.created_at ?? raw.createdAt) ?? Date.now();
  const billingEventType = eventTypes[eventType];
  return {
    eventId,
    provider: "creem",
    eventType: billingEventType,
    externalSubscriptionId: subscription.id,
    userId: readText(subscription.metadata.convexUserId) ?? undefined,
    planType,
    periodStart,
    periodEnd,
    monthlyCredits: billingEventType === "subscription.started" || billingEventType === "subscription.renewed"
      ? planType === "pro" ? PRO_MONTHLY_CREDITS : STUDIO_MONTHLY_CREDITS
      : 0,
    cancelAtPeriodEnd: eventType === "subscription.scheduled_cancel" || subscription.cancelAtPeriodEnd,
    occurredAt,
    payloadJson: JSON.stringify(event),
  };
}

export async function handleCreemCheckoutEvent(ctx: EventCtx, event: CreemEventInput) {
  const checkout = asRecord(event.data ?? event.object);
  if (extractCreemSubscriptionId("checkout.completed", checkout)) {
    await handleCreemSubscriptionEvent(ctx, event);
    return;
  }
  const order = asRecord(checkout.order);
  const productId = readId(checkout.product) ?? readId(order.product);
  if (!productId) return;
  const packCredits = configuredPackCredits(productId);
  if (!packCredits) return;
  const product = await ctx.runQuery(components.creem.lib.getProduct, { id: productId });
  if (
    !product || product.status !== "active" || product.billingType !== "onetime" ||
    product.currency !== "USD" || product.price !== CREDIT_PACK_SPECS[packCredits].priceMinor
  ) {
    throw new Error("Creem Credit Pack product is invalid");
  }
  const normalized = normalizeCreemCreditPackCheckout(event, productId, packCredits);
  await ctx.runMutation(internal.creemPackOrders.fulfill, normalized);
}

export function normalizeCreemCreditPackCheckout(
  event: CreemEventInput,
  productId: string,
  credits: 64 | 160 | 400
) {
  const checkout = asRecord(event.data ?? event.object);
  const order = asRecord(checkout.order);
  const userId = readText(asRecord(checkout.metadata).convexUserId);
  const externalOrderId = readText(order.id);
  const totalMinor = readInteger(order.amount_paid ?? order.amountPaid ?? order.amount);
  const currency = readText(order.currency);
  if (!userId || !externalOrderId || order.status !== "paid" || !totalMinor || !currency) {
    throw new Error("Creem Credit Pack checkout is missing verified order details");
  }
  return {
    userId,
    productId,
    externalOrderId,
    externalTransactionId: readId(order.transaction) ?? undefined,
    credits,
    priceMinor: CREDIT_PACK_SPECS[credits].priceMinor,
    totalMinor,
    currency: currency.toUpperCase(),
    occurredAt: readTimestamp(asRecord(event).created_at ?? asRecord(event).createdAt) ?? Date.now(),
  };
}

export async function handleCreemRefundEvent(ctx: EventCtx, event: CreemEventInput) {
  const refund = asRecord(event.data ?? event.object);
  if (extractCreemSubscriptionId("refund.created", refund)) {
    await handleCreemSubscriptionEvent(ctx, event);
    return;
  }
  if (refund.status !== "succeeded") return;
  const externalTransactionId = readId(refund.transaction);
  const refundAmountMinor = readInteger(refund.refund_amount ?? refund.refundAmount);
  const eventId = readText(asRecord(event).id);
  if (!externalTransactionId || !refundAmountMinor || !eventId) return;
  await ctx.runMutation(internal.creemPackOrders.refund, { eventId, externalTransactionId, refundAmountMinor });
}

function subscriptionCatalog(): SubscriptionCatalog {
  return {
    proProductId: process.env.CREEM_PRO_MONTHLY_PRODUCT_ID?.trim(),
    studioProductId: process.env.CREEM_STUDIO_MONTHLY_PRODUCT_ID?.trim(),
  };
}

function configuredPackCredits(productId: string): 64 | 160 | 400 | null {
  if (productId === process.env.CREEM_CREDIT_PACK_64_PRODUCT_ID?.trim()) return 64;
  if (productId === process.env.CREEM_CREDIT_PACK_160_PRODUCT_ID?.trim()) return 160;
  if (productId === process.env.CREEM_CREDIT_PACK_400_PRODUCT_ID?.trim()) return 400;
  return null;
}

export function extractCreemSubscriptionId(eventType: string, data: unknown) {
  const record = asRecord(data);
  const rawSubscription = eventType === "checkout.completed" || eventType === "refund.created"
    ? record.subscription
    : data;
  if (typeof rawSubscription === "string") return rawSubscription;
  return readText(asRecord(rawSubscription).id);
}

function isCanceledRefund(data: unknown) {
  const refund = asRecord(data);
  return refund.status === "succeeded" && asRecord(refund.subscription).status === "canceled";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readId(value: unknown) {
  return typeof value === "string" ? readText(value) : readText(asRecord(value).id);
}

function readInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
