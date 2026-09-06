import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const GIB = 1024 ** 3;

describe("admin entitlement operations", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("publishes immutable profile revisions and rejects stale saves", async () => {
    const admin = await seedUser(t, {
      tokenIdentifier: "entitlement-admin",
      email: "admin@example.test",
      isAdmin: true,
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});

    const result = await admin.client.mutation(api.admin.saveEntitlementProfile, {
      planType: "free",
      expectedRevision: 1,
      libraryQuotaGb: 3,
      temporaryOriginalQuotaGb: 2,
      pinnedOriginalQuotaGb: 1,
      originalRetentionDays: 14,
      versionRetentionDays: 7,
      masterMaxDimensionPx: 2048,
      exportMaxDimensionPx: 2048,
      originalPermanentStorage: false,
      originalDownloadAllowed: true,
      originalPinAllowed: true,
      batchDownloadAllowed: false,
    });

    expect(result.revision).toBe(2);
    const revisions = await t.run((ctx) => ctx.db
      .query("entitlementProfiles")
      .withIndex("by_plan_revision", (q) => q.eq("planType", "free"))
      .collect());
    expect(revisions.map((profile) => profile.revision).sort()).toEqual([1, 2]);
    await expect(admin.client.mutation(api.admin.saveEntitlementProfile, {
      planType: "free",
      expectedRevision: 1,
      libraryQuotaGb: 4,
      temporaryOriginalQuotaGb: 2,
      pinnedOriginalQuotaGb: 1,
      originalRetentionDays: 14,
      versionRetentionDays: 7,
      masterMaxDimensionPx: 2048,
      exportMaxDimensionPx: 2048,
      originalPermanentStorage: false,
      originalDownloadAllowed: true,
      originalPinAllowed: true,
      batchDownloadAllowed: false,
    })).rejects.toThrow("changed in another session");
  });

  it("grants and revokes account entitlement increments", async () => {
    const admin = await seedUser(t, { tokenIdentifier: "grant-admin", email: "admin@example.test", isAdmin: true });
    const user = await seedUser(t, { tokenIdentifier: "grant-user", email: "user@example.test" });
    const grantId = await admin.client.mutation(api.adminUsers.grantEntitlements, {
      userId: user.userId,
      sourceType: "manual",
      storageGb: 5,
      temporaryOriginalStorageGb: 0,
      pinnedOriginalStorageGb: 0,
      originalRetentionDays: 30,
      versionRetentionDays: 0,
      masterMaxDimensionPx: 0,
      exportMaxDimensionPx: 0,
      originalPermanentStorage: false,
      originalDownloadAllowed: false,
      originalPinAllowed: false,
      batchDownloadAllowed: true,
    });

    expect(await user.client.query(api.entitlements.viewerEffective, {})).toMatchObject({
      libraryQuotaBytes: 7 * GIB,
      originalRetentionDays: 30,
      batchDownloadAllowed: true,
    });
    await admin.client.mutation(api.adminUsers.revokeEntitlementGrant, { grantId });
    expect(await user.client.query(api.entitlements.viewerEffective, {})).toMatchObject({
      libraryQuotaBytes: 2 * GIB,
      originalRetentionDays: 7,
      batchDownloadAllowed: false,
    });
  });

  it("issues credits and entitlements once for a feedback report", async () => {
    const admin = await seedUser(t, { tokenIdentifier: "reward-admin", email: "admin@example.test", isAdmin: true });
    const user = await seedUser(t, { tokenIdentifier: "reward-user", email: "user@example.test", balance: 10 });
    const feedbackId = await t.run((ctx) => ctx.db.insert("feedbackReports", {
      userId: user.userId,
      category: "other",
      status: "open",
      message: "Detailed product feedback",
    }));
    const reward = {
      feedbackId,
      credits: 200,
      storageGb: 5,
      originalRetentionDays: 30,
      originalDownloadAllowed: true,
      batchDownloadAllowed: false,
    };

    await admin.client.mutation(api.admin.rewardFeedback, reward);
    await expect(admin.client.mutation(api.admin.rewardFeedback, reward)).rejects.toThrow("already received a reward");
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      grants: await ctx.db.query("accountEntitlementGrants").withIndex("by_source", (q) => q.eq("sourceType", "feedback").eq("sourceReference", feedbackId)).collect(),
      audits: await ctx.db.query("adminAuditLogs").collect(),
    }));
    expect(state.account?.balance).toBe(210);
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0].libraryQuotaBytesDelta).toBe(5 * GIB);
    expect(state.audits.some((audit) => audit.action === "reward-feedback")).toBe(true);
  });
});
