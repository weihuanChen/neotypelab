import creemTest from "@mmailaender/convex-creem/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Creem payment readiness", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps checkout disabled until explicitly enabled with server credentials and a return origin", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    vi.stubEnv("CREEM_BILLING_ENABLED", "false");
    vi.stubEnv("CREEM_API_KEY", "creem_test_example");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("CREEM_SERVER_URL", "https://test-api.creem.io");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", "prod_pro");
    expect(await t.query(api.creemReadiness.forOrigin, { returnOrigin: "http://localhost:3001" }))
      .toMatchObject({ enabled: false, products: { pro: false } });

    vi.stubEnv("CREEM_BILLING_ENABLED", "true");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "");
    expect(await t.query(api.creemReadiness.forOrigin, { returnOrigin: "http://localhost:3001" }))
      .toMatchObject({ enabled: false, products: { pro: false } });
  });

  it("opens only synced products matching the test environment and published price", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    vi.stubEnv("CREEM_BILLING_ENABLED", "true");
    vi.stubEnv("CREEM_API_KEY", "creem_test_example");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("CREEM_SERVER_URL", "https://test-api.creem.io");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", "prod_pro");
    vi.stubEnv("CREEM_CREDIT_PACK_64_PRODUCT_ID", "prod_pack_64");
    await t.mutation(components.creem.lib.updateProducts, { products: [
      {
        id: "prod_pro", name: "Pro", description: null, price: 1990, currency: "USD",
        billingType: "recurring", billingPeriod: "every-month", status: "active",
        mode: "test", createdAt: new Date().toISOString(), modifiedAt: null,
      },
      {
        id: "prod_pack_64", name: "Pack", description: null, price: 900, currency: "USD",
        billingType: "onetime", billingPeriod: "once", status: "active",
        mode: "test", createdAt: new Date().toISOString(), modifiedAt: null,
      },
    ] });
    expect(await t.query(api.creemReadiness.forOrigin, { returnOrigin: "http://localhost:3001" }))
      .toMatchObject({ enabled: true, mode: "test", products: {
        pro: true, studio: false, pack64: true, pack160: false, pack400: false,
      } });
    expect(await t.query(api.creemReadiness.forOrigin, { returnOrigin: "https://unlisted.example" }))
      .toMatchObject({ enabled: false, products: { pro: false, pack64: false } });

    vi.stubEnv("CREEM_SERVER_URL", "");
    expect(await t.query(api.creemReadiness.forOrigin, { returnOrigin: "http://localhost:3001" }))
      .toMatchObject({ enabled: true, mode: "prod", products: { pro: false, pack64: false } });
  });
});
