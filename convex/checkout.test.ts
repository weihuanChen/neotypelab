import creemTest from "@mmailaender/convex-creem/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { creem } from "./creemBilling";

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
    vi.unstubAllEnvs();
  });

  it("creates a Creem checkout when the payment method is card", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    const user = await seedUser(t, {
      tokenIdentifier: "checkout-card",
      email: "checkout-card@example.test",
    });
    await t.mutation(components.creem.lib.updateProducts, {
      products: [{
        id: "prod_pro_monthly",
        name: "NeoTypeLab Pro",
        description: null,
        price: 1990,
        currency: "USD",
        billingType: "recurring",
        billingPeriod: "every-month",
        status: "active",
        mode: "test",
        createdAt: new Date().toISOString(),
        modifiedAt: null,
      }],
    });
    const create = vi.spyOn(creem.sdk.checkouts, "create").mockResolvedValue({
      checkoutUrl: "https://www.creem.io/test/checkout/prod_pro_monthly/ch_123",
      customer: { id: "cust_123", email: "checkout-card@example.test" },
    } as never);

    const result = await user.client.action(api.checkout.create, {
      returnOrigin: "http://localhost:3001",
      plan: "pro",
      paymentMethod: "card",
    });

    expect(result).toMatchObject({
      status: "redirect",
      url: expect.stringContaining("https://www.creem.io/"),
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      productId: "prod_pro_monthly",
    }));
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
