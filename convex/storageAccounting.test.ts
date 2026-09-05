import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { GENERATION_STORAGE_ESTIMATE } from "./storageAccounting";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
const MIB = 1024 ** 2;

describe("storage accounting", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function seedJob(userId: Id<"users">) {
    return await t.run((ctx) =>
      ctx.db.insert("generationJobs", {
        userId,
        kind: "palette-plan",
        status: "queued",
        requestedCredits: 1,
      })
    );
  }

  it("holds generation capacity idempotently and releases it", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "storage-user",
      email: "storage@example.test",
    });
    const generationJobId = await seedJob(user.userId);

    const first = await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId,
    });
    const second = await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId,
    });
    const heldUsage = await user.client.query(api.storageAccounting.viewerUsage, {});

    expect(second.reservationId).toBe(first.reservationId);
    expect(heldUsage).toMatchObject({
      optimized: {
        usedBytes: 0,
        reservedBytes: GENERATION_STORAGE_ESTIMATE.optimizedBytes,
      },
      temporaryOriginal: {
        usedBytes: 0,
        reservedBytes: GENERATION_STORAGE_ESTIMATE.temporaryOriginalBytes,
      },
    });

    await t.mutation(internal.storageAccounting.releaseGenerationStorageReservation, {
      generationJobId,
    });
    const releasedUsage = await user.client.query(api.storageAccounting.viewerUsage, {});
    expect(releasedUsage?.optimized.reservedBytes).toBe(0);
    expect(releasedUsage?.temporaryOriginal.reservedBytes).toBe(0);
  });

  it("prevents concurrent reservations from exceeding an effective quota", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "limited-user",
      email: "limited@example.test",
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.run(async (ctx) => {
      const free = await ctx.db
        .query("entitlementProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", "free-default"))
        .unique();
      if (!free) throw new Error("Free profile not found");
      await ctx.db.patch(free._id, {
        libraryQuotaBytes: 12 * MIB,
        temporaryOriginalQuotaBytes: 20 * MIB,
      });
    });
    const firstJobId = await seedJob(user.userId);
    const secondJobId = await seedJob(user.userId);

    await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId: firstJobId,
    });
    await expect(
      t.mutation(internal.storageAccounting.reserveGenerationStorage, {
        generationJobId: secondJobId,
      })
    ).rejects.toThrow(/storage quota exceeded/);
  });

  it("checks exact encoded sizes before upload", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "exact-user",
      email: "exact@example.test",
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.run(async (ctx) => {
      const free = await ctx.db
        .query("entitlementProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", "free-default"))
        .unique();
      if (!free) throw new Error("Free profile not found");
      await ctx.db.patch(free._id, {
        libraryQuotaBytes: 20 * MIB,
        temporaryOriginalQuotaBytes: 20 * MIB,
      });
    });
    const generationJobId = await seedJob(user.userId);
    await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId,
    });

    await expect(
      t.mutation(internal.storageAccounting.adjustGenerationStorageReservation, {
        generationJobId,
        optimizedBytes: 4 * MIB,
        originalBytes: 21 * MIB,
      })
    ).rejects.toThrow(/Temporary Original storage quota exceeded/);

    const usage = await user.client.query(api.storageAccounting.viewerUsage, {});
    expect(usage?.temporaryOriginal.reservedBytes).toBe(
      GENERATION_STORAGE_ESTIMATE.temporaryOriginalBytes
    );
  });

  it("reconciles private objects by accounting category", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "reference-user",
      email: "reference@example.test",
    });

    await user.client.mutation(api.assets.createReference, {
      key: "users/reference/source.png",
      kind: "reference",
      contentType: "image/png",
      byteSize: 2 * MIB,
    });
    const usage = await user.client.query(api.storageAccounting.viewerUsage, {});

    expect(usage).toMatchObject({
      optimized: { usedBytes: 2 * MIB, reservedBytes: 0 },
      temporaryOriginal: { usedBytes: 0, reservedBytes: 0 },
      pinnedOriginal: { usedBytes: 0, reservedBytes: 0 },
    });
  });

  it("uses Pinned Original quota for permanent Original entitlements", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "studio-user",
      email: "studio@example.test",
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    await t.run((ctx) => ctx.db.patch(user.userId, { planType: "studio" }));
    const generationJobId = await seedJob(user.userId);

    await t.mutation(internal.storageAccounting.reserveGenerationStorage, {
      generationJobId,
    });
    const usage = await user.client.query(api.storageAccounting.viewerUsage, {});

    expect(usage?.temporaryOriginal.reservedBytes).toBe(0);
    expect(usage?.pinnedOriginal.reservedBytes).toBe(
      GENERATION_STORAGE_ESTIMATE.temporaryOriginalBytes
    );
  });
});
