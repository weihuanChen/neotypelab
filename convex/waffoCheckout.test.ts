import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), planChange: vi.fn() }));
vi.mock("@waffo/pancake-ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@waffo/pancake-ts")>(),
  WaffoPancake: class {
    graphql = { query: mocks.query };
    checkout = { authenticated: { create: mocks.create, createPlanChange: mocks.planChange } };
  },
}));

const modules = import.meta.glob("./**/*.ts");

describe("Waffo authenticated checkout", () => {
  beforeEach(() => {
    vi.stubEnv("WAFFO_CHECKOUT_ENABLED", "true");
    vi.stubEnv("WAFFO_ENVIRONMENT", "test");
    vi.stubEnv("WAFFO_MERCHANT_ID", "MER_test");
    vi.stubEnv("WAFFO_PRIVATE_KEY", "test-private-key");
    vi.stubEnv("WAFFO_STORE_ID", "STO_test");
    vi.stubEnv("WAFFO_CHECKOUT_RETURN_ORIGINS", "http://localhost:3001");
    vi.stubEnv("WAFFO_PRO_MONTHLY_PRODUCT_ID", "PROD_pro");
    mocks.query.mockResolvedValue({ data: { products: [{
      id: "PROD_pro",
      name: "NeoTypeLab Pro",
      status: "active",
      billingPeriod: "monthly",
      prices: [{ currency: "USD", priceInfo: { amount: "19.90" } }],
    }] } });
    mocks.create.mockResolvedValue({ checkoutUrl: "https://pancake.waffo.ai/store/test/checkout/one#token=test" });
    mocks.planChange.mockResolvedValue({ checkoutUrl: "https://pancake.waffo.ai/store/test/change/one#token=test" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires a signed-in active user", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.waffoCheckout.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("Sign in");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("binds the authenticated account to the Waffo session and order metadata", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-buyer", email: "waffo-buyer@example.test" });
    const result = await user.client.action(api.waffoCheckout.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    });
    expect(result.url).toContain("#token=test");
    expect(mocks.create).toHaveBeenCalledWith({
      productId: "PROD_pro",
      currency: "USD",
      buyerIdentity: user.userId,
      buyerEmail: "waffo-buyer@example.test",
      successUrl: "http://localhost:3001/pricing?checkout=success&provider=waffo",
      metadata: { convexUserId: user.userId, catalogKey: "pro" },
    });
  });

  it("rejects unapproved origins, incorrect prices, and a disabled checkout", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-guarded", email: "waffo-guarded@example.test" });
    await expect(user.client.action(api.waffoCheckout.createSubscriptionCheckout, {
      returnOrigin: "https://other.example",
      planType: "pro",
    })).rejects.toThrow("unavailable");
    mocks.query.mockResolvedValueOnce({ data: { products: [{
      id: "PROD_pro", name: "NeoTypeLab Pro", status: "active", billingPeriod: "monthly",
      prices: [{ currency: "USD", priceInfo: { amount: "0.01" } }],
    }] } });
    await expect(user.client.action(api.waffoCheckout.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("does not match");
    vi.stubEnv("WAFFO_CHECKOUT_ENABLED", "false");
    await expect(user.client.action(api.waffoCheckout.createSubscriptionCheckout, {
      returnOrigin: "http://localhost:3001",
      planType: "pro",
    })).rejects.toThrow("unavailable");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requires an active subscription before buying a Credit Pack", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-pack", email: "waffo-pack@example.test" });
    await expect(user.client.action(api.waffoCheckout.createCreditPackCheckout, {
      returnOrigin: "http://localhost:3001",
      credits: 64,
    })).rejects.toThrow("active subscription");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("binds a subscriber's Credit Pack checkout to the same user", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-pack-buyer", email: "waffo-pack-buyer@example.test" });
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId: user.userId,
        provider: "creem",
        externalSubscriptionId: "sub_pack_buyer",
        planType: "pro",
        status: "active",
        currentPeriodStart: now - 1_000,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1_000,
        cancelAtPeriodEnd: false,
        latestEventOccurredAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });
    vi.stubEnv("WAFFO_CREDIT_PACK_64_PRODUCT_ID", "PROD_pack64");
    mocks.query.mockResolvedValueOnce({ data: { products: [{
      id: "PROD_pack64", name: "64 Credits", status: "active",
      prices: [{ currency: "USD", priceInfo: { amount: "9.00" } }],
    }] } });
    await user.client.action(api.waffoCheckout.createCreditPackCheckout, {
      returnOrigin: "http://localhost:3001",
      credits: 64,
    });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: "PROD_pack64",
      buyerIdentity: user.userId,
      metadata: { convexUserId: user.userId, catalogKey: "pack64" },
    }));
  });

  it("opens an authenticated Studio plan change only for the current Waffo Pro owner", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "waffo-upgrade-owner", email: "upgrade@example.test" });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const now = Date.now();
    await t.mutation(internal.subscriptions.processWebhookEvent, {
      eventId: "activated-upgrade-owner",
      provider: "waffo",
      eventType: "subscription.started",
      externalSubscriptionId: "ORD_upgrade_owner",
      userId: user.userId,
      planType: "pro",
      periodStart: now,
      periodEnd: now + 30 * 24 * 60 * 60 * 1000,
      monthlyCredits: 160,
      cancelAtPeriodEnd: false,
      occurredAt: now,
      payloadJson: "{}",
    });
    vi.stubEnv("WAFFO_STUDIO_MONTHLY_PRODUCT_ID", "PROD_studio");
    vi.stubEnv("WAFFO_PLAN_GROUP_ID", "group_test");
    mocks.query.mockResolvedValueOnce({ data: { products: [{
      id: "PROD_studio", name: "NeoTypeLab Studio", status: "active", billingPeriod: "monthly",
      prices: [{ currency: "USD", priceInfo: { amount: "29.90" } }],
    }] } }).mockResolvedValueOnce({ data: { subscriptionProductGroups: [{
      id: "group_test",
      products: [{ id: "PROD_pro" }, { id: "PROD_studio" }],
    }] } });
    const result = await user.client.action(api.waffoCheckout.createStudioUpgradeCheckout, {
      returnOrigin: "http://localhost:3001",
    });
    expect(result.url).toContain("/change/one#token=test");
    expect(mocks.planChange).toHaveBeenCalledWith(expect.objectContaining({
      originOrderId: "ORD_upgrade_owner",
      productId: "PROD_studio",
      buyerIdentity: user.userId,
      metadata: { convexUserId: user.userId, catalogKey: "studio" },
    }));
  });
});
