import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const GIB = 1024 ** 3;

describe("effective entitlements", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("provides the built-in Free baseline before profiles are seeded", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "free-user",
      email: "free@example.test",
    });

    const result = await user.client.query(api.entitlements.viewerEffective, {});

    expect(result).toMatchObject({
      planType: "free",
      profileId: null,
      profileSlug: "free-default",
      libraryQuotaBytes: 2 * GIB,
      originalRetentionDays: 7,
      versionRetentionDays: 7,
      masterMaxDimensionPx: 2048,
      originalPermanentStorage: false,
    });
  });

  it("seeds profiles idempotently and selects the account plan", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "pro-user",
      email: "pro@example.test",
    });
    await t.run((ctx) => ctx.db.patch(user.userId, { planType: "pro" }));

    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const result = await user.client.query(api.entitlements.viewerEffective, {});
    const profileCount = await t.run((ctx) => ctx.db.query("entitlementProfiles").collect());

    expect(profileCount).toHaveLength(3);
    expect(result).toMatchObject({
      planType: "pro",
      profileSlug: "pro-default",
      libraryQuotaBytes: 20 * GIB,
      originalRetentionDays: 90,
      versionRetentionDays: 30,
      exportMaxDimensionPx: 4096,
      originalPermanentStorage: false,
    });
    expect(result?.profileId).not.toBeNull();
  });

  it("merges only active grants with field-specific rules", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "reward-user",
      email: "reward@example.test",
    });
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("accountEntitlementGrants", {
        userId: user.userId,
        sourceType: "feedback",
        sourceReference: "feedback-42",
        libraryQuotaBytesDelta: 5 * GIB,
        originalRetentionDays: 30,
        masterMaxDimensionPx: 4096,
        batchDownloadAllowed: true,
        startsAt: now - 1_000,
        expiresAt: now + 60_000,
        createdAt: now,
      });
      await ctx.db.insert("accountEntitlementGrants", {
        userId: user.userId,
        sourceType: "promotion",
        libraryQuotaBytesDelta: 100 * GIB,
        startsAt: now - 60_000,
        expiresAt: now - 1,
        createdAt: now,
      });
      await ctx.db.insert("accountEntitlementGrants", {
        userId: user.userId,
        sourceType: "manual",
        libraryQuotaBytesDelta: 50 * GIB,
        startsAt: now - 1_000,
        revokedAt: now - 500,
        createdAt: now,
      });
    });

    const result = await user.client.query(api.entitlements.viewerEffective, {});

    expect(result).toMatchObject({
      libraryQuotaBytes: 7 * GIB,
      originalRetentionDays: 30,
      masterMaxDimensionPx: 4096,
      batchDownloadAllowed: true,
    });
    expect(result?.activeGrantIds).toHaveLength(1);
  });
});
