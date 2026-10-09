import { v } from "convex/values";
import { query } from "./_generated/server";

type ProductAvailability = {
  pro: boolean;
  studio: boolean;
  pack64: boolean;
  pack160: boolean;
  pack400: boolean;
};

export const forOrigin = query({
  args: { returnOrigin: v.string() },
  returns: v.object({
    enabled: v.boolean(),
    planChange: v.boolean(),
    products: v.object({ pro: v.boolean(), studio: v.boolean(), pack64: v.boolean(), pack160: v.boolean(), pack400: v.boolean() }),
  }),
  handler: async (_ctx, args): Promise<{ enabled: boolean; planChange: boolean; products: ProductAvailability }> => {
    const ids = {
      pro: process.env.WAFFO_PRO_MONTHLY_PRODUCT_ID?.trim(),
      studio: process.env.WAFFO_STUDIO_MONTHLY_PRODUCT_ID?.trim(),
      pack64: process.env.WAFFO_CREDIT_PACK_64_PRODUCT_ID?.trim(),
      pack160: process.env.WAFFO_CREDIT_PACK_160_PRODUCT_ID?.trim(),
      pack400: process.env.WAFFO_CREDIT_PACK_400_PRODUCT_ID?.trim(),
    };
    const values = Object.values(ids).filter((id): id is string => Boolean(id));
    const origins = (process.env.WAFFO_CHECKOUT_RETURN_ORIGINS ?? "")
      .split(",").map((origin) => origin.trim()).filter(Boolean);
    const enabled = process.env.WAFFO_CHECKOUT_ENABLED === "true" &&
      ["test", "prod"].includes(process.env.WAFFO_ENVIRONMENT ?? "") &&
      Boolean(process.env.WAFFO_MERCHANT_ID?.trim()) &&
      Boolean(process.env.WAFFO_PRIVATE_KEY?.trim()) &&
      Boolean(process.env.WAFFO_STORE_ID?.trim()) &&
      values.length === 5 && new Set(values).size === 5 &&
      origins.includes(args.returnOrigin) && isAllowedOrigin(args.returnOrigin);
    return {
      enabled,
      planChange: enabled && Boolean(process.env.WAFFO_PLAN_GROUP_ID?.trim()),
      products: {
        pro: enabled && Boolean(ids.pro),
        studio: enabled && Boolean(ids.studio),
        pack64: enabled && Boolean(ids.pack64),
        pack160: enabled && Boolean(ids.pack160),
        pack400: enabled && Boolean(ids.pack400),
      },
    };
  },
});

function isAllowedOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.origin === value && (url.protocol === "https:" || (
      url.protocol === "http:" && url.hostname === "localhost"
    ));
  } catch {
    return false;
  }
}
