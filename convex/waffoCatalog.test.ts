import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configuredWaffoProductId,
  dollarsToMinor,
  mappedWaffoProduct,
  validateWaffoProduct,
} from "./waffoCatalog";

afterEach(() => vi.unstubAllEnvs());

describe("Waffo product mapping", () => {
  it("maps only configured product IDs", () => {
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_pack64");
    expect(configuredWaffoProductId("pro")).toBe("PROD_pro");
    expect(mappedWaffoProduct("PROD_pro")).toBe("pro");
    expect(mappedWaffoProduct("PROD_pack64")).toBe("pack64");
    expect(mappedWaffoProduct("PROD_unknown")).toBeNull();
  });

  it("checks exact USD prices and monthly billing", () => {
    const pro = {
      id: "PROD_pro",
      name: "NeoTypeLab Pro",
      status: "active",
      billingPeriod: "monthly",
      prices: [{ currency: "USD", priceInfo: { amount: "19.90" } }],
    };
    expect(validateWaffoProduct("pro", pro)).toBe(true);
    expect(validateWaffoProduct("pro", { ...pro, billingPeriod: "yearly" })).toBe(false);
    expect(validateWaffoProduct("pro", { ...pro, prices: [{ currency: "USD", priceInfo: { amount: "19.99" } }] })).toBe(false);
    expect(validateWaffoProduct("pro", { ...pro, status: "inactive" })).toBe(false);
    expect(validateWaffoProduct("pack400", {
      ...pro,
      prices: [{ currency: "USD", priceInfo: { amount: "39.00" } }],
    })).toBe(true);
  });

  it("parses display amounts without floating point rounding", () => {
    expect(dollarsToMinor("19.90")).toBe(1990);
    expect(dollarsToMinor("9")).toBe(900);
    expect(dollarsToMinor("19.999")).toBeNull();
    expect(dollarsToMinor("n/a")).toBeNull();
  });
});
