export const CHECKOUT_COUNTRY = "US";

export type CheckoutPaymentMethod = "card" | "other";
export type CheckoutProvider = "creem" | "waffo";
export type CheckoutRouteOffer = "pro" | "studio" | "pack";

/**
 * Chooses the billing provider for a checkout.
 * Callers pass the offer, the server-resolved country, and a payment method.
 * The browser never names a provider.
 * Waffo handles new purchases. Existing Creem subscriptions upgrade in place.
 */
export function selectCheckoutProvider(input: {
  offer: CheckoutRouteOffer;
  country: string;
  paymentMethod: CheckoutPaymentMethod;
  subscriptionProvider?: string;
}): CheckoutProvider {
  if (input.country.trim().length !== 2) {
    throw new Error("Checkout country is unavailable");
  }
  if (input.offer === "studio" && input.subscriptionProvider === "creem") {
    if (input.paymentMethod !== "card") {
      throw new Error("Use card payment to upgrade your existing Creem subscription");
    }
    return "creem";
  }
  return "waffo";
}
