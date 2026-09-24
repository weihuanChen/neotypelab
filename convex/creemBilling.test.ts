import creemTest from "@mmailaender/convex-creem/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { creem } from "./creemBilling";

const modules = import.meta.glob("./**/*.ts");

describe("Creem checkout authorization", () => {
  beforeEach(() => {
    vi.stubEnv("CREEM_BILLING_ENABLED", "true");
    vi.stubEnv("CREEM_API_KEY", "creem_test_example");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("CREEM_SERVER_URL", "https://test-api.creem.io");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires an authenticated account", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("Sign in");
  });

  it("does not sell Pro to an account with paid plan access", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, {
      tokenIdentifier: "already-paid",
      email: "already-paid@example.test",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(user.userId, { planType: "pro" });
    });
    await expect(user.client.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("paid plan access");
  });

  it("creates a checkout for the authenticated user and the configured Pro product", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    const user = await seedUser(t, {
      tokenIdentifier: "pro-buyer",
      email: "pro-buyer@example.test",
    });
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", "prod_pro_monthly");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
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
      customer: { id: "cust_123", email: "pro-buyer@example.test" },
    } as never);

    const checkout = await user.client.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    });

    expect(checkout.url).toContain("/test/checkout/prod_pro_monthly/");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      productId: "prod_pro_monthly",
      successUrl: "http://localhost:3001/pricing?checkout=success",
      metadata: {
        convexUserId: user.userId,
        convexBillingEntityId: user.userId,
      },
      customer: { email: "pro-buyer@example.test" },
    }));
    await expect(user.client.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "https://not-our-site.example",
      planType: "pro",
    })).rejects.toThrow("unavailable");
    vi.stubEnv("CREEM_BILLING_ENABLED", "false");
    await expect(user.client.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("unavailable");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("creates the configured Studio checkout for a free account", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    const user = await seedUser(t, {
      tokenIdentifier: "studio-buyer",
      email: "studio-buyer@example.test",
    });
    vi.stubEnv("CREEM_STUDIO_MONTHLY_PRODUCT_ID", "prod_studio_monthly");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    await t.mutation(components.creem.lib.updateProducts, {
      products: [{
        id: "prod_studio_monthly",
        name: "NeoTypeLab Studio",
        description: null,
        price: 2990,
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
      checkoutUrl: "https://www.creem.io/test/checkout/prod_studio_monthly/ch_123",
      customer: { id: "cust_studio", email: "studio-buyer@example.test" },
    } as never);
    await user.client.action(api.creemBilling.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "studio",
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      productId: "prod_studio_monthly",
      metadata: { convexUserId: user.userId, convexBillingEntityId: user.userId },
    }));
  });

  it("sells Credit Packs only while the buyer has paid subscription access", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    const user = await seedUser(t, {
      tokenIdentifier: "pack-checkout-buyer",
      email: "pack-checkout@example.test",
    });
    vi.stubEnv("CREEM_CREDIT_PACK_64_PRODUCT_ID", "prod_pack_64");
    vi.stubEnv("CREEM_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    await t.mutation(components.creem.lib.updateProducts, {
      products: [{
        id: "prod_pack_64",
        name: "64 Credit Pack",
        description: null,
        price: 900,
        currency: "USD",
        billingType: "onetime",
        billingPeriod: "once",
        status: "active",
        mode: "test",
        createdAt: new Date().toISOString(),
        modifiedAt: null,
      }],
    });
    await expect(user.client.action(api.creemBilling.createCreditPackCheckout, {
      returnOrigin: "http://localhost:3001",
      credits: 64,
    })).rejects.toThrow("active subscription");
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, {
      eventId: "evt_pack_buyer_subscription",
      provider: "test",
      eventType: "subscription.started",
      externalSubscriptionId: "sub_pack_buyer",
      userId: user.userId,
      planType: "pro",
      periodStart: now,
      periodEnd: now + 30 * 24 * 60 * 60 * 1000,
      monthlyCredits: 160,
      cancelAtPeriodEnd: false,
      occurredAt: now,
      payloadJson: "{}",
    });
    const create = vi.spyOn(creem.sdk.checkouts, "create").mockResolvedValue({
      checkoutUrl: "https://www.creem.io/test/checkout/prod_pack_64/ch_123",
      customer: { id: "cust_pack", email: "pack-checkout@example.test" },
    } as never);
    await user.client.action(api.creemBilling.createCreditPackCheckout, {
      returnOrigin: "http://localhost:3001",
      credits: 64,
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      productId: "prod_pack_64",
      metadata: { convexUserId: user.userId, convexBillingEntityId: user.userId },
    }));
  });

  it("schedules a Studio upgrade for the buyer's own active Pro subscription", async () => {
    const t = convexTest(schema, modules);
    creemTest.register(t);
    const user = await seedUser(t, {
      tokenIdentifier: "upgrade-to-studio",
      email: "upgrade-to-studio@example.test",
    });
    vi.stubEnv("CREEM_PRO_MONTHLY_PRODUCT_ID", "prod_pro_monthly");
    vi.stubEnv("CREEM_STUDIO_MONTHLY_PRODUCT_ID", "prod_studio_monthly");
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, {
      eventId: "evt_pro_buyer",
      provider: "creem",
      eventType: "subscription.started",
      externalSubscriptionId: "sub_upgrade_buyer",
      userId: user.userId,
      planType: "pro",
      periodStart: now,
      periodEnd: now + 30 * 24 * 60 * 60 * 1000,
      monthlyCredits: 160,
      cancelAtPeriodEnd: false,
      occurredAt: now,
      payloadJson: "{}",
    });
    await t.mutation(components.creem.lib.updateProducts, { products: [
      {
        id: "prod_pro_monthly", name: "Pro", description: null, price: 1990,
        currency: "USD", billingType: "recurring", billingPeriod: "every-month",
        status: "active", mode: "test", createdAt: new Date(now).toISOString(), modifiedAt: null,
      },
      {
        id: "prod_studio_monthly", name: "Studio", description: null, price: 2990,
        currency: "USD", billingType: "recurring", billingPeriod: "every-month",
        status: "active", mode: "test", createdAt: new Date(now).toISOString(), modifiedAt: null,
      },
    ] });
    await t.mutation(components.creem.lib.insertCustomer, {
      id: "cust_upgrade", entityId: user.userId, email: "upgrade-to-studio@example.test",
    });
    await t.mutation(components.creem.lib.createSubscription, { subscription: {
      id: "sub_upgrade_buyer",
      customerId: "cust_upgrade",
      productId: "prod_pro_monthly",
      status: "active",
      amount: 1990,
      currency: "USD",
      recurringInterval: "every-month",
      currentPeriodStart: new Date(now).toISOString(),
      currentPeriodEnd: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      startedAt: new Date(now).toISOString(),
      endedAt: null,
      checkoutId: "ch_upgrade",
      metadata: { convexUserId: user.userId },
      createdAt: new Date(now).toISOString(),
      modifiedAt: new Date(now).toISOString(),
    } });

    expect(await user.client.mutation(api.creemBilling.upgradeToStudio, {})).toEqual({ status: "scheduled" });
    expect(await t.query(components.creem.lib.getSubscription, { id: "sub_upgrade_buyer" }))
      .toMatchObject({ productId: "prod_studio_monthly" });
  });
});
