export const CHECKOUT_COUNTRY = "US";

export type CheckoutPaymentMethod = "card" | "other";
export type CheckoutProvider = "creem" | "waffo";
export type CheckoutRouteOffer = "pro" | "studio" | "pack";

/**
 * Chooses the billing provider for a checkout.
 * Callers pass the offer, the server-resolved country, and a payment method.
 * The browser never names a provider.
 * Card payments use Creem. Other methods use Waffo.
 */
export function selectCheckoutProvider(input: {
  offer: CheckoutRouteOffer;
  country: string;
  paymentMethod: CheckoutPaymentMethod;
}): CheckoutProvider {
  if (input.country.trim().length !== 2) {
    throw new Error("Checkout country is unavailable");
  }
  if (input.paymentMethod === "other") return "waffo";
  return cardProvider(input.offer);
}

function cardProvider(offer: CheckoutRouteOffer): CheckoutProvider {
  switch (offer) {
    case "pro":
    case "studio":
    case "pack":
      return "creem";
  }
}
