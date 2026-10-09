import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { creem } from "./creemBilling";

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), config: vi.fn() }));
vi.mock("@waffo/pancake-ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@waffo/pancake-ts")>(),
  WaffoPancake: class {
    constructor(config: unknown) { mocks.config(config); }
    graphql = { query: mocks.query };
    checkout = { authenticated: { create: mocks.create } };
  },
}));

const modules = import.meta.glob("./**/*.ts");

describe("checkout creation", () => {
  beforeEach(() => {
    vi.stubEnv("CREEM_BILLING_ENABLED", "true");
    vi.stubEnv("CREEM_API_KEY", "creem_test_example");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("CREEM_SERVER_URL", "https://test-api.creem.io");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", "prod_pro_monthly");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(["card", "other"] as const)("creates a Waffo checkout for %s", async (paymentMethod) => {
    vi.stubEnv("WAFFO_CHECKOUT_ENABLED", "true");
    vi.stubEnv("WAFFO_ENVIRONMENT", "prod");
    vi.stubEnv("WAFFO_MERCHANT_ID", "MER_live");
    vi.stubEnv("WAFFO_PRIVATE_KEY", "key");
    vi.stubEnv("WAFFO_STORE_ID", "STO_live");
    vi.stubEnv("WAFFO_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "checkout-live", email: "live@example.test" });
    mocks.query.mockResolvedValue({ data: { products: [{ id: "PROD_pro", name: "Pro", status: "active", billingPeriod: "monthly", prices: [{ currency: "USD", priceInfo: { amount: "19.90" } }] }] } });
    mocks.create.mockResolvedValue({ checkoutUrl: "https://pancake.waffo.ai/checkout/live" });
    const result = await user.client.action(api.checkout.create, { returnOrigin: "http://localhost:3001", plan: "pro", paymentMethod });
    expect(result).toMatchObject({ status: "redirect", url: "https://pancake.waffo.ai/checkout/live" });
    expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ environment: "prod" }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ productId: "PROD_pro", buyerIdentity: user.userId }));
  });

  it("does not open Creem for other payment methods", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "checkout-other",
      email: "checkout-other@example.test",
    });
    const create = vi.spyOn(creem.sdk.checkouts, "create").mockResolvedValue({
      checkoutUrl: "https://www.creem.io/test/checkout/unused",
    } as never);

    await expect(user.client.action(api.checkout.create, {
      returnOrigin: "http://localhost:3001",
      plan: "pro",
      paymentMethod: "other",
    })).rejects.toThrow(/Waffo/);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a request that names both a plan and a Credit Pack", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "checkout-both",
      email: "checkout-both@example.test",
    });
    await expect(user.client.action(api.checkout.create, {
      returnOrigin: "http://localhost:3001",
      plan: "pro",
      credits: 64,
      paymentMethod: "card",
    })).rejects.toThrow("Choose one plan or Credit Pack");
  });
});
