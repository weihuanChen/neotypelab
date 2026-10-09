import { describe, expect, it } from "vitest";
import { CHECKOUT_COUNTRY, selectCheckoutProvider } from "./paymentRouter";

describe("checkout payment router", () => {
  it("sends new card payments to Waffo", () => {
    expect(selectCheckoutProvider({
      offer: "pro",
      country: CHECKOUT_COUNTRY,
      paymentMethod: "card",
    })).toBe("waffo");
    expect(selectCheckoutProvider({
      offer: "studio",
      country: "US",
      paymentMethod: "card",
    })).toBe("waffo");
    expect(selectCheckoutProvider({
      offer: "pack",
      country: "US",
      paymentMethod: "card",
    })).toBe("waffo");
  });

  it("sends other payment methods to Waffo", () => {
    expect(selectCheckoutProvider({
      offer: "pro",
      country: "US",
      paymentMethod: "other",
    })).toBe("waffo");
  });

  it("keeps existing Creem subscription upgrades on their original provider", () => {
    expect(selectCheckoutProvider({ offer: "studio", country: "US", paymentMethod: "card", subscriptionProvider: "creem" })).toBe("creem");
    expect(selectCheckoutProvider({ offer: "pack", country: "US", paymentMethod: "card", subscriptionProvider: "creem" })).toBe("waffo");
    expect(() => selectCheckoutProvider({ offer: "studio", country: "US", paymentMethod: "other", subscriptionProvider: "creem" })).toThrow("existing Creem");
  });

  it("requires a server-resolved country", () => {
    expect(() => selectCheckoutProvider({
      offer: "pro",
      country: "",
      paymentMethod: "card",
    })).toThrow("country");
  });
});
