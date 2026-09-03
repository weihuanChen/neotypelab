import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("credit campaign integration", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("redeems a code once and records the ledger atomically", async () => {
    const admin = await seedUser(t, {
      tokenIdentifier: "admin-token",
      email: "admin@example.test",
      isAdmin: true,
    });
    const user = await seedUser(t, {
      tokenIdentifier: "user-token",
      email: "pilot@example.test",
      balance: 5,
    });
    const now = Date.now();
    const { campaignId } = await admin.client.mutation(api.creditCampaigns.createCampaign, {
      name: "Pilot launch",
      startsAt: now - 1_000,
      endsAt: now + 60_000,
      defaultCreditAmount: 10,
      perUserLimit: 1,
      isActive: true,
    });
    const { codes } = await admin.client.mutation(api.creditCampaigns.generateActivationCodes, {
      campaignId,
      count: 1,
    });

    await expect(
      user.client.mutation(api.creditCampaigns.redeemActivationCode, { code: codes[0] })
    ).resolves.toMatchObject({ creditAmount: 10, balanceAfter: 15 });
    await expect(
      user.client.mutation(api.creditCampaigns.redeemActivationCode, { code: codes[0] })
    ).rejects.toThrow(/not active|already/);

    const state = await t.run(async (ctx) => ({
      account: await ctx.db
        .query("creditAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .unique(),
      transactions: await ctx.db
        .query("creditTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .collect(),
      redemptions: await ctx.db
        .query("creditCodeRedemptions")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .collect(),
    }));
    expect(state.account?.balance).toBe(15);
    expect(state.account?.lifetimeGranted).toBe(15);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0]).toMatchObject({
      actionType: "campaign-code-redemption",
      delta: 10,
      balanceAfter: 15,
    });
    expect(state.redemptions).toHaveLength(1);
  });

  it("enforces the per-user campaign limit across different codes", async () => {
    const admin = await seedUser(t, {
      tokenIdentifier: "admin-token",
      email: "admin@example.test",
      isAdmin: true,
    });
    const user = await seedUser(t, {
      tokenIdentifier: "user-token",
      email: "pilot@example.test",
    });
    const now = Date.now();
    const { campaignId } = await admin.client.mutation(api.creditCampaigns.createCampaign, {
      name: "One reward per pilot",
      startsAt: now - 1_000,
      endsAt: now + 60_000,
      defaultCreditAmount: 4,
      perUserLimit: 1,
      isActive: true,
    });
    const { codes } = await admin.client.mutation(api.creditCampaigns.generateActivationCodes, {
      campaignId,
      count: 2,
    });

    await user.client.mutation(api.creditCampaigns.redeemActivationCode, { code: codes[0] });
    await expect(
      user.client.mutation(api.creditCampaigns.redeemActivationCode, { code: codes[1] })
    ).rejects.toThrow(/Campaign redemption limit/);
  });

  it("rejects campaign administration by a regular user", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "user-token",
      email: "pilot@example.test",
    });
    const now = Date.now();
    await expect(
      user.client.mutation(api.creditCampaigns.createCampaign, {
        name: "Unauthorized campaign",
        startsAt: now,
        endsAt: now + 60_000,
        defaultCreditAmount: 5,
        perUserLimit: 1,
        isActive: true,
      })
    ).rejects.toThrow(/Super admin access required/);
  });
});
