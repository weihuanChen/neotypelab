import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Waffo checkout readiness", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stays closed until the test environment, catalog and origin are configured", async () => {
    const t = convexTest(schema, modules);
    const args = { returnOrigin: "http://localhost:3001" };
    expect((await t.query(api.waffoReadiness.forOrigin, args)).enabled).toBe(false);
    vi.stubEnv("WAFFO_CHECKOUT_ENABLED", "true");
    vi.stubEnv("WAFFO_ENVIRONMENT", "test");
    vi.stubEnv("WAFFO_MERCHANT_ID", "MER_test");
    vi.stubEnv("WAFFO_PRIVATE_KEY", "key");
    vi.stubEnv("WAFFO_STORE_ID", "STO_test");
    vi.stubEnv("WAFFO_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
    vi.stubEnv("WAFFO_STUDIO_MONTHLY_PRODUCT_ID", "PROD_studio");
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_64");
    vi.stubEnv("WAFFO_CREDIT_PACK_160_PRODUCT_ID", "PROD_160");
    vi.stubEnv("WAFFO_CREDIT_PACK_400_PRODUCT_ID", "PROD_400");
    expect((await t.query(api.waffoReadiness.forOrigin, args)).products).toEqual({
      pro: true, studio: true, pack64: true, pack160: true, pack400: true,
    });
    expect((await t.query(api.waffoReadiness.forOrigin, { returnOrigin: "https://other.example" })).enabled).toBe(false);
    vi.stubEnv("WAFFO_CREDIT_PACK_400_PRODUCT_ID", "PROD_64");
    expect((await t.query(api.waffoReadiness.forOrigin, args)).enabled).toBe(false);
  });
});
