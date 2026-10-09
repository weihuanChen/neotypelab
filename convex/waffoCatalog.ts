"use node";

import { WaffoPancake } from "@waffo/pancake-ts";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import {
  CREDIT_PACK_SPECS,
  PRO_MONTHLY_PRICE_MINOR,
  STUDIO_MONTHLY_PRICE_MINOR,
} from "../lib/productPricing";

type Product = {
  id: string;
  name: string;
  status: string;
  billingPeriod?: string;
  prices: Array<{ currency: string; priceInfo: { amount: string } }>;
};

export const catalogKeys = ["pro", "studio", "pack64", "pack160", "pack400"] as const;
export type CatalogKey = typeof catalogKeys[number];

const specs = {
  pro: { env: "WAFFO_PRO_MONTHLY_PRODUCT_ID", type: "subscription", priceMinor: PRO_MONTHLY_PRICE_MINOR },
  studio: { env: "WAFFO_STUDIO_MONTHLY_PRODUCT_ID", type: "subscription", priceMinor: STUDIO_MONTHLY_PRICE_MINOR },
  pack64: { env: "WAFFO_CREDIT_PACK_64_PRODUCT_ID", type: "onetime", priceMinor: CREDIT_PACK_SPECS[64].priceMinor },
  pack160: { env: "WAFFO_CREDIT_PACK_160_PRODUCT_ID", type: "onetime", priceMinor: CREDIT_PACK_SPECS[160].priceMinor },
  pack400: { env: "WAFFO_CREDIT_PACK_400_PRODUCT_ID", type: "onetime", priceMinor: CREDIT_PACK_SPECS[400].priceMinor },
} as const;

export function configuredWaffoProductId(key: CatalogKey): string | null {
  return process.env[specs[key].env]?.trim() || null;
}

export function mappedWaffoProduct(productId: string): CatalogKey | null {
  return catalogKeys.find((key) => configuredWaffoProductId(key) === productId) ?? null;
}

export function validateWaffoProduct(key: CatalogKey, product: Product | undefined): boolean {
  if (!product || product.status !== "active") return false;
  const spec = specs[key];
  if (spec.type === "subscription" && product.billingPeriod !== "monthly") return false;
  const usd = product.prices.find((price) => price.currency.toUpperCase() === "USD");
  return usd !== undefined && dollarsToMinor(usd.priceInfo.amount) === spec.priceMinor;
}

export function dollarsToMinor(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

export const check = internalAction({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    products: v.record(v.string(), v.object({ id: v.union(v.string(), v.null()), valid: v.boolean() })),
    issues: v.array(v.string()),
  }),
  handler: async (): Promise<{
    configured: boolean;
    products: Record<CatalogKey, { id: string | null; valid: boolean }>;
    issues: string[];
  }> => {
    const ids = Object.fromEntries(catalogKeys.map((key) => [key, configuredWaffoProductId(key)])) as Record<CatalogKey, string | null>;
    const products = Object.fromEntries(catalogKeys.map((key) => [key, { id: ids[key], valid: false }])) as Record<CatalogKey, { id: string | null; valid: boolean }>;
    const issues: string[] = [];
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if (!merchantId || !privateKey || !storeId || !["test", "prod"].includes(process.env.WAFFO_ENVIRONMENT ?? "")) {
      return { configured: false, products, issues: ["Waffo credentials, Store ID or environment are missing"] };
    }
    const allIds = Object.values(ids).filter((id): id is string => Boolean(id));
    if (new Set(allIds).size !== allIds.length) issues.push("Product IDs must be unique");
    const client = new WaffoPancake({ merchantId, privateKey });
    const result = await client.graphql.query<{ onetimeProducts: Product[]; subscriptionProducts: Product[] }>({
      query: `query ($storeId: String!) {
        onetimeProducts(storeId: $storeId) { id name status prices { currency priceInfo { amount } } }
        subscriptionProducts(storeId: $storeId) { id name status billingPeriod prices { currency priceInfo { amount } } }
      }`,
      variables: { storeId },
    });
    if (result.errors?.length || !result.data) {
      return { configured: false, products, issues: ["Waffo product query failed"] };
    }
    for (const key of catalogKeys) {
      const source = specs[key].type === "subscription" ? result.data.subscriptionProducts : result.data.onetimeProducts;
      products[key].valid = validateWaffoProduct(key, source.find((product) => product.id === ids[key]));
      if (!products[key].valid) issues.push(`${key} product is missing or differs from the published catalog`);
    }
    return { configured: issues.length === 0, products, issues };
  },
});

export const planChangeGroups = internalAction({
  args: {},
  handler: async () => {
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    if (!merchantId || !privateKey || !storeId) throw new Error("Waffo is not configured");
    const client = new WaffoPancake({ merchantId, privateKey });
    const result = await client.graphql.query<{
      subscriptionProductGroups: Array<{ id: string; name: string; products: Array<{ id: string }> }>;
    }>({
      query: `query ($storeId: String!) {
        subscriptionProductGroups(storeId: $storeId) { id name products { id } }
      }`,
      variables: { storeId },
    });
    if (result.errors?.length || !result.data) throw new Error("Waffo product group query failed");
    return result.data.subscriptionProductGroups.map((group) => ({
      id: group.id,
      name: group.name,
      productIds: group.products.map((product) => product.id),
    }));
  },
});

export const configureTestPlanGroup = internalAction({
  args: {},
  handler: async (): Promise<{ id: string; status: "created" | "updated" | "existing" }> => {
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    const storeId = process.env.WAFFO_STORE_ID?.trim();
    const proId = configuredWaffoProductId("pro");
    const studioId = configuredWaffoProductId("studio");
    if (process.env.WAFFO_ENVIRONMENT !== "test" || !merchantId || !privateKey || !storeId ||
        !proId || !studioId || proId === studioId) {
      throw new Error("Waffo Test Mode plans are not configured");
    }
    const client = new WaffoPancake({ merchantId, privateKey });
    const groups = await client.graphql.query<{
      subscriptionProductGroups: Array<{
        id: string;
        name: string;
        rules: { selfServicePlanChange: boolean };
        products: Array<{ id: string }>;
      }>;
    }>({
      query: `query ($storeId: String!) {
        subscriptionProductGroups(storeId: $storeId) { id name rules { selfServicePlanChange } products { id } }
      }`,
      variables: { storeId },
    });
    if (groups.errors?.length || !groups.data) throw new Error("Waffo plan group lookup failed");
    const name = "NeotypeLab Monthly Plans";
    const existing = groups.data.subscriptionProductGroups.find((group) => group.name === name);
    if (existing) {
      const productIds = existing.products.map((product) => product.id);
      if (productIds.length !== 2 || !productIds.includes(proId) || !productIds.includes(studioId)) {
        throw new Error("Existing Waffo plan group has unexpected products");
      }
      if (existing.rules.selfServicePlanChange) {
        await client.subscriptionProductGroups.update({
          id: existing.id,
          rules: { selfServicePlanChange: false },
        });
        return { id: existing.id, status: "updated" };
      }
      return { id: existing.id, status: "existing" };
    }
    const { group } = await client.subscriptionProductGroups.create({
      storeId,
      name,
      description: "NeotypeLab Pro and Studio monthly subscriptions",
      productIds: [proId, studioId],
      rules: { sharedTrial: false, selfServicePlanChange: false },
    });
    return { id: group.id, status: "created" };
  },
});
