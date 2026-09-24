import { Creem } from "@mmailaender/convex-creem";
import { v } from "convex/values";
import {
  CREDIT_PACK_SPECS,
  PRO_MONTHLY_PRICE_MINOR,
  STUDIO_MONTHLY_PRICE_MINOR,
} from "../lib/productPricing";
import { api, components } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { mutation } from "./functions";

export const creem = new Creem(components.creem);

export const createSubscriptionCheckout = action({
  args: {
    returnOrigin: v.string(),
    planType: v.union(v.literal("pro"), v.literal("studio")),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const viewer = await ctx.runQuery(api.users.viewer, {});
    if (!viewer || viewer.accountStatus !== "active") {
      throw new Error("Sign in to an active account before subscribing");
    }
    if (viewer.entitlements.planType !== "free") {
      throw new Error("This account already has paid plan access");
    }

    const existing = await ctx.runQuery(api.subscriptions.viewerCurrent, {});
    if (existing && ["active", "canceling", "past-due"].includes(existing.status)) {
      throw new Error("This account already has a subscription");
    }
    const creemSubscription = await ctx.runQuery(components.creem.lib.getCurrentSubscription, {
      entityId: viewer._id,
    });
    if (creemSubscription) {
      throw new Error("This account already has a Creem subscription");
    }

    const readiness = await ctx.runQuery(api.creemReadiness.forOrigin, { returnOrigin: args.returnOrigin });
    if (!readiness.products[args.planType]) throw new Error("Subscription checkout is unavailable");

    const productId = subscriptionProductId(args.planType);
    if (!productId) throw new Error(`${args.planType} checkout is not configured`);
    const product = await ctx.runQuery(components.creem.lib.getProduct, { id: productId });
    if (
      !product || product.status !== "active" || product.billingType !== "recurring" ||
      product.billingPeriod !== "every-month" || product.currency !== "USD" ||
      product.price !== (args.planType === "pro" ? PRO_MONTHLY_PRICE_MINOR : STUDIO_MONTHLY_PRICE_MINOR)
    ) {
      throw new Error("The configured subscription product does not match the published plan");
    }

    const origin = validateReturnOrigin(args.returnOrigin);
    return await creem.checkouts.create(
      ctx as unknown as Parameters<typeof creem.checkouts.create>[0],
      {
        entityId: viewer._id,
        userId: viewer._id,
        email: viewer.email,
        productId,
        successUrl: `${origin}/pricing?checkout=success`,
      }
    );
  },
});

export const createCreditPackCheckout = action({
  args: {
    returnOrigin: v.string(),
    credits: v.union(v.literal(64), v.literal(160), v.literal(400)),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const viewer = await ctx.runQuery(api.users.viewer, {});
    if (!viewer || viewer.accountStatus !== "active") {
      throw new Error("Sign in to an active account before purchasing Credits");
    }
    const subscription = await ctx.runQuery(api.subscriptions.viewerCurrent, {});
    if (
      !subscription || !["active", "canceling"].includes(subscription.status) ||
      subscription.currentPeriodEnd <= Date.now()
    ) {
      throw new Error("Credit Packs require an active subscription");
    }
    const readiness = await ctx.runQuery(api.creemReadiness.forOrigin, { returnOrigin: args.returnOrigin });
    const packKey = `pack${args.credits}` as const;
    if (!readiness.products[packKey]) throw new Error("Credit Pack checkout is unavailable");
    const productId = creditPackProductId(args.credits);
    if (!productId) throw new Error("Credit Pack checkout is not configured");
    const product = await ctx.runQuery(components.creem.lib.getProduct, { id: productId });
    if (
      !product || product.status !== "active" || product.billingType !== "onetime" ||
      product.currency !== "USD" || product.price !== CREDIT_PACK_SPECS[args.credits].priceMinor
    ) {
      throw new Error("The configured Credit Pack does not match the published price");
    }
    const origin = validateReturnOrigin(args.returnOrigin);
    return await creem.checkouts.create(
      ctx as unknown as Parameters<typeof creem.checkouts.create>[0],
      {
        entityId: viewer._id,
        userId: viewer._id,
        email: viewer.email,
        productId,
        successUrl: `${origin}/pricing?checkout=success`,
      }
    );
  },
});

export const upgradeToStudio = mutation({
  args: {},
  handler: async (ctx): Promise<{ status: "scheduled" }> => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus !== "active") throw new Error("Account is not active");
    const current = await ctx.runQuery(api.subscriptions.viewerCurrent, {});
    if (
      !current || current.provider !== "creem" || current.planType !== "pro" ||
      current.status !== "active" || current.currentPeriodEnd <= Date.now()
    ) {
      throw new Error("An active Pro subscription is required to upgrade");
    }
    const readiness = await ctx.runQuery(api.creemReadiness.forOrigin, {});
    if (!readiness.products.studio) throw new Error("Studio upgrade is unavailable");
    const creemSubscription = await ctx.runQuery(components.creem.lib.getCurrentSubscription, {
      entityId: viewer._id,
    });
    if (!creemSubscription || creemSubscription.productId !== subscriptionProductId("pro")) {
      throw new Error("The current Creem subscription is not Pro");
    }
    const studioProductId = subscriptionProductId("studio");
    if (!studioProductId) throw new Error("Studio checkout is not configured");
    const product = await ctx.runQuery(components.creem.lib.getProduct, { id: studioProductId });
    if (
      !product || product.status !== "active" || product.billingType !== "recurring" ||
      product.billingPeriod !== "every-month" || product.currency !== "USD" ||
      product.price !== STUDIO_MONTHLY_PRICE_MINOR
    ) {
      throw new Error("The configured Studio product does not match the published plan");
    }
    await creem.subscriptions.update(
      ctx,
      {
        entityId: viewer._id,
        subscriptionId: creemSubscription.id,
        productId: studioProductId,
        updateBehavior: "proration-charge",
      }
    );
    return { status: "scheduled" };
  },
});

function subscriptionProductId(planType: "pro" | "studio") {
  return (planType === "pro"
    ? process.env.CREEM_PRO_MONTHLY_PRODUCT_ID
    : process.env.CREEM_STUDIO_MONTHLY_PRODUCT_ID)?.trim();
}

function creditPackProductId(credits: 64 | 160 | 400) {
  const keys = {
    64: process.env.CREEM_CREDIT_PACK_64_PRODUCT_ID,
    160: process.env.CREEM_CREDIT_PACK_160_PRODUCT_ID,
    400: process.env.CREEM_CREDIT_PACK_400_PRODUCT_ID,
  };
  return keys[credits]?.trim();
}

function validateReturnOrigin(rawOrigin: string) {
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error("Invalid checkout return origin");
  }
  const allowedOrigins = (process.env.CREEM_CHECKOUT_RETURN_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (url.origin !== rawOrigin || !allowedOrigins.includes(url.origin)) {
    throw new Error("Checkout return origin is not allowed");
  }
  return url.origin;
}

export const syncProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    // The package types expect a newer Convex action context; this method only uses runAction.
    await creem.syncProducts(ctx as unknown as Parameters<typeof creem.syncProducts>[0]);
  },
});
