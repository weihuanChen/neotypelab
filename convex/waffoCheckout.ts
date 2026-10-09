"use node";

import { ChangeTiming, WaffoPancake } from "@waffo/pancake-ts";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { configuredWaffoProductId, validateWaffoProduct, type CatalogKey } from "./waffoCatalog";

type Product = Parameters<typeof validateWaffoProduct>[1];

export const createSubscriptionCheckout = action({
  args: {
    returnOrigin: v.string(),
    planType: v.union(v.literal("pro"), v.literal("studio")),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const viewer = await ctx.runQuery(api.users.viewer, {});
    if (!viewer || viewer.accountStatus !== "active") {
      throw new Error("Sign in to an active account before subscribing");
    }
    if (viewer.entitlements.planType !== "free") {
      throw new Error("This account already has paid plan access");
    }
    const subscription = await ctx.runQuery(api.subscriptions.viewerCurrent, {});
    if (subscription && ["active", "canceling", "past-due"].includes(subscription.status)) {
      throw new Error("This account already has a subscription");
    }
    const origin = allowedReturnOrigin(args.returnOrigin);
    const client = configuredClient();
    return await createCheckout(client, args.planType, viewer._id, viewer.email, origin);
  },
});

export const createCreditPackCheckout = action({
  args: {
    returnOrigin: v.string(),
    credits: v.union(v.literal(64), v.literal(160), v.literal(400)),
  },
  returns: v.object({ url: v.string() }),
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
    const origin = allowedReturnOrigin(args.returnOrigin);
    const client = configuredClient();
    return await createCheckout(client, `pack${args.credits}` as CatalogKey, viewer._id, viewer.email, origin);
  },
});

export const createStudioUpgradeCheckout = action({
  args: { returnOrigin: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const viewer = await ctx.runQuery(api.users.viewer, {});
    if (!viewer || viewer.accountStatus !== "active" || viewer.entitlements.planType !== "pro") {
      throw new Error("An active Pro account is required to upgrade");
    }
    const current = await ctx.runQuery(internal.waffoCheckoutQueries.currentProUpgradeOrder, {});
    if (!current || current.userId !== viewer._id) {
      throw new Error("An active Waffo Pro subscription is required to upgrade");
    }
    const origin = allowedReturnOrigin(args.returnOrigin);
    const client = configuredClient();
    const groupId = process.env.WAFFO_PLAN_GROUP_ID?.trim();
    const proId = configuredWaffoProductId("pro");
    const studioId = configuredWaffoProductId("studio");
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if (!groupId || !proId || !studioId || !storeId) throw new Error("Waffo plan change is not configured");
    await requireCatalogProduct(client, "studio", storeId, studioId);
    const groups = await client.graphql.query<{
      subscriptionProductGroups: Array<{
        id: string;
        products: Array<{ id: string }>;
      }>;
    }>({
      query: `query ($storeId: String!) {
        subscriptionProductGroups(storeId: $storeId) {
          id products { id }
        }
      }`,
      variables: { storeId },
    });
    const group = groups.data?.subscriptionProductGroups.find((candidate) => candidate.id === groupId);
    if (groups.errors?.length || !group ||
        !group.products.some((product) => product.id === proId) ||
        !group.products.some((product) => product.id === studioId)) {
      throw new Error("Waffo Pro and Studio plan change is unavailable");
    }
    const checkout = await client.checkout.authenticated.createPlanChange({
      originOrderId: current.orderId,
      productId: studioId,
      currency: "USD",
      buyerIdentity: viewer._id,
      changeTiming: ChangeTiming.Immediate,
      successUrl: `${origin}/pricing?checkout=success&provider=waffo`,
      metadata: { convexUserId: viewer._id, catalogKey: "studio" },
    });
    return { url: checkedCheckoutUrl(checkout.checkoutUrl) };
  },
});

function configuredClient(): WaffoPancake {
  const environment = process.env.WAFFO_ENVIRONMENT;
  const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
  const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
  const storeId = process.env.WAFFO_STORE_ID?.trim();
  if (
    process.env.WAFFO_CHECKOUT_ENABLED !== "true" ||
    (environment !== "test" && environment !== "prod") ||
    !merchantId || !privateKey || !storeId
  ) {
    throw new Error("Waffo checkout is unavailable");
  }
  return new WaffoPancake({ merchantId, privateKey, environment });
}

function allowedReturnOrigin(rawOrigin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new Error("Waffo checkout is unavailable for this origin");
  }
  const allowed = (process.env.WAFFO_CHECKOUT_RETURN_ORIGINS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (
    parsed.origin !== rawOrigin ||
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) ||
    !allowed.includes(rawOrigin)
  ) {
    throw new Error("Waffo checkout is unavailable for this origin");
  }
  return parsed.origin;
}

async function createCheckout(
  client: WaffoPancake,
  key: CatalogKey,
  userId: string,
  email: string,
  origin: string
): Promise<{ url: string }> {
  const productId = configuredWaffoProductId(key);
  const storeId = process.env.WAFFO_STORE_ID?.trim();
  if (!productId || !storeId) throw new Error("Waffo product is not configured");
  await requireCatalogProduct(client, key, storeId, productId);
  const checkout = await client.checkout.authenticated.create({
    productId,
    currency: "USD",
    buyerIdentity: userId,
    buyerEmail: email,
    successUrl: `${origin}/pricing?checkout=success&provider=waffo`,
    metadata: { convexUserId: userId, catalogKey: key },
  });
  return { url: checkedCheckoutUrl(checkout.checkoutUrl) };
}

async function requireCatalogProduct(client: WaffoPancake, key: CatalogKey, storeId: string, productId: string) {
  const type = key === "pro" || key === "studio" ? "subscriptionProducts" : "onetimeProducts";
  const result = await client.graphql.query<{ products: NonNullable<Product>[] }>({
    query: `query ($storeId: String!) {
      products: ${type}(storeId: $storeId) {
        id name status ${type === "subscriptionProducts" ? "billingPeriod" : ""}
        prices { currency priceInfo { amount } }
      }
    }`,
    variables: { storeId },
  });
  if (result.errors?.length || !result.data ||
      !validateWaffoProduct(key, result.data.products.find((product) => product.id === productId))) {
    throw new Error("Waffo product does not match the published catalog");
  }
}

function checkedCheckoutUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".waffo.ai")) {
    throw new Error("Waffo returned an unexpected checkout URL");
  }
  return url.toString();
}
