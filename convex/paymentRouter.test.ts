import { describe, expect, it } from "vitest";
import { CHECKOUT_COUNTRY, selectCheckoutProvider } from "./paymentRouter";

describe("checkout payment router", () => {
  it("sends card payments to Creem", () => {
    expect(selectCheckoutProvider({
      offer: "pro",
      country: CHECKOUT_COUNTRY,
      paymentMethod: "card",
    })).toBe("creem");
    expect(selectCheckoutProvider({
      offer: "studio",
      country: "US",
      paymentMethod: "card",
    })).toBe("creem");
    expect(selectCheckoutProvider({
      offer: "pack",
      country: "US",
      paymentMethod: "card",
    })).toBe("creem");
  });

  it("sends other payment methods to Waffo", () => {
    expect(selectCheckoutProvider({
      offer: "pro",
      country: "US",
      paymentMethod: "other",
    })).toBe("waffo");
  });

  it("requires a server-resolved country", () => {
    expect(() => selectCheckoutProvider({
      offer: "pro",
      country: "",
      paymentMethod: "card",
    })).toThrow("country");
  });
});
