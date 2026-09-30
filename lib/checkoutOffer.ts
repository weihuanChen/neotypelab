import { CREDIT_PACKS, PRODUCT_PLANS } from "@/lib/productPricing";

export type CheckoutPlan = "pro" | "studio";
export type CheckoutPackCredits = 64 | 160 | 400;
export type CheckoutPaymentMethod = "card" | "other";

export type CheckoutSearch = {
  plan?: CheckoutPlan;
  pack?: CheckoutPackCredits;
};

type CheckoutOfferCopy = {
  title: string;
  summary: string;
  price: string;
  cadence: string;
  terms: string;
};

export type CheckoutOffer =
  | ({ kind: "plan"; plan: CheckoutPlan } & CheckoutOfferCopy)
  | ({ kind: "pack"; credits: CheckoutPackCredits } & CheckoutOfferCopy);

const PLAN_SUMMARY = "AI Model Painting Workspace";

export function parseCheckoutSearch(search: Record<string, unknown>): CheckoutSearch {
  const plan = search.plan === "pro" || search.plan === "studio" ? search.plan : undefined;
  return { plan, pack: parsePack(search.pack) };
}

export function checkoutOfferFromSearch(search: CheckoutSearch): CheckoutOffer | null {
  if (search.plan && search.pack) return null;
  if (search.plan) return planOffer(search.plan);
  if (search.pack) return packOffer(search.pack);
  return null;
}

export function assertProviderCheckoutUrl(raw: string) {
  const url = new URL(raw);
  const allowed = url.protocol === "https:" && (
    url.hostname === "creem.io" ||
    url.hostname === "www.creem.io" ||
    url.hostname.endsWith(".waffo.ai")
  );
  if (!allowed) throw new Error("Checkout returned an unexpected URL");
  return url.toString();
}

function planOffer(plan: CheckoutPlan): CheckoutOffer {
  const catalog = PRODUCT_PLANS.find((item) => item.id === plan);
  if (!catalog) throw new Error("Missing checkout plan");
  return {
    kind: "plan",
    plan,
    title: `NeotypeLab ${catalog.name}`,
    summary: PLAN_SUMMARY,
    price: catalog.price,
    cadence: catalog.priceSuffix,
    terms: "Cancel anytime",
  };
}

function packOffer(credits: CheckoutPackCredits): CheckoutOffer {
  const catalog = CREDIT_PACKS.find((item) => item.credits === credits);
  if (!catalog) throw new Error("Missing checkout Credit Pack");
  return {
    kind: "pack",
    credits,
    title: `${catalog.credits} Credits`,
    summary: "Credit Pack",
    price: catalog.price,
    cadence: "",
    terms: "Does not expire",
  };
}

function parsePack(value: unknown): CheckoutPackCredits | undefined {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (numeric === 64 || numeric === 160 || numeric === 400) return numeric;
  return undefined;
}
