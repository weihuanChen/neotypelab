import { v } from "convex/values";
import {
  CREDIT_PACK_SPECS,
  PRO_MONTHLY_PRICE_MINOR,
  STUDIO_MONTHLY_PRICE_MINOR,
} from "../lib/productPricing";
import { components } from "./_generated/api";
import { query } from "./_generated/server";

type ProductAvailability = {
  pro: boolean;
  studio: boolean;
  pack64: boolean;
  pack160: boolean;
  pack400: boolean;
};

export type CreemReadiness = {
  enabled: boolean;
  mode: "test" | "prod" | null;
  products: ProductAvailability;
};

const unavailable: ProductAvailability = {
  pro: false,
  studio: false,
  pack64: false,
  pack160: false,
  pack400: false,
};

export const forOrigin = query({
  args: { returnOrigin: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CreemReadiness> => {
    const serverUrl = process.env.CREEM_SERVER_URL?.trim();
    const mode = serverUrl === "https://test-api.creem.io" ? "test" as const
      : !serverUrl ? "prod" as const : null;
    if (mode === null) return { enabled: false, mode, products: { ...unavailable } };
    const allowedOrigins = (process.env.CREEM_CHECKOUT_RETURN_ORIGINS ?? "")
      .split(",").map((origin) => origin.trim()).filter(Boolean);
    const originReady = args.returnOrigin === undefined || (
      isValidOrigin(args.returnOrigin) && allowedOrigins.includes(args.returnOrigin)
    );
    const enabled = process.env.CREEM_BILLING_ENABLED === "true" &&
      Boolean(process.env.CREEM_API_KEY?.trim()) &&
      Boolean(process.env.CREEM_WEBHOOK_SECRET?.trim()) &&
      !process.env.CREEM_SERVER_IDX?.trim() &&
      allowedOrigins.length > 0 && originReady;
    if (!enabled) return { enabled: false, mode, products: { ...unavailable } };

    const ids = {
      pro: process.env.CREEM_PRO_MONTHLY_PRODUCT_ID?.trim(),
      studio: process.env.CREEM_STUDIO_MONTHLY_PRODUCT_ID?.trim(),
      pack64: process.env.CREEM_CREDIT_PACK_64_PRODUCT_ID?.trim(),
      pack160: process.env.CREEM_CREDIT_PACK_160_PRODUCT_ID?.trim(),
      pack400: process.env.CREEM_CREDIT_PACK_400_PRODUCT_ID?.trim(),
    };
    const [pro, studio, pack64, pack160, pack400] = await Promise.all(
      Object.values(ids).map(async (id) => id
        ? await ctx.runQuery(components.creem.lib.getProduct, { id })
        : null)
    );
    return {
      enabled: true,
      mode,
      products: {
        pro: productMatches(pro, "recurring", PRO_MONTHLY_PRICE_MINOR, mode),
        studio: productMatches(studio, "recurring", STUDIO_MONTHLY_PRICE_MINOR, mode),
        pack64: productMatches(pack64, "onetime", CREDIT_PACK_SPECS[64].priceMinor, mode),
        pack160: productMatches(pack160, "onetime", CREDIT_PACK_SPECS[160].priceMinor, mode),
        pack400: productMatches(pack400, "onetime", CREDIT_PACK_SPECS[400].priceMinor, mode),
      },
    };
  },
});

function isValidOrigin(value: string) {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

function productMatches(
  product: {
    status: string;
    billingType: string;
    billingPeriod?: string;
    currency: string;
    price: number;
    mode?: string;
  } | null,
  billingType: "recurring" | "onetime",
  priceMinor: number,
  mode: "test" | "prod"
) {
  return Boolean(
    product && product.status === "active" && product.billingType === billingType &&
    (billingType === "onetime" || product.billingPeriod === "every-month") &&
    product.currency === "USD" && product.price === priceMinor &&
    (mode === "test" ? product.mode === "test" : product.mode === "prod" || product.mode === "live")
  );
}
