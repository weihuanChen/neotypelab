import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph } from "./assetModel";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("private asset authorization", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("authorizes only the owner of a ready private object", async () => {
    const owner = await seedUser(t, {
      tokenIdentifier: "owner-token",
      email: "owner@example.test",
    });
    const other = await seedUser(t, {
      tokenIdentifier: "other-token",
      email: "other@example.test",
    });
    const records = await t.run((ctx) =>
      createAssetGraph(ctx, {
        legacyAsset: {
          userId: owner.userId,
          key: "users/owner/original.png",
          bucket: "private-library",
          kind: "preview",
          contentType: "image/png",
          byteSize: 4096,
          status: "active",
        },
        mediaKind: "generated-image",
        rendition: "original",
        origin: "generated",
        bucketRole: "private",
      })
    );

    const authorized = await t.query(internal.assets.authorizePrivateDownload, {
      storageObjectId: records.storageObjectId,
      tokenIdentifier: "owner-token",
    });
    const denied = await t.query(internal.assets.authorizePrivateDownload, {
      storageObjectId: records.storageObjectId,
      tokenIdentifier: "other-token",
    });
    const persisted = await t.run(async (ctx) => ({
      legacy: await ctx.db.get(records.legacyAssetId),
      object: await ctx.db.get(records.storageObjectId),
    }));

    expect(authorized).toMatchObject({
      key: "users/owner/original.png",
      rendition: "original",
    });
    expect(denied).toBeNull();
    expect(persisted.legacy?.publicUrl).toBeUndefined();
    expect(persisted.object?.publicUrl).toBeUndefined();
    expect(other.userId).not.toBe(owner.userId);
  });

  it("rejects private objects that are not ready", async () => {
    const owner = await seedUser(t, {
      tokenIdentifier: "pending-owner",
      email: "pending@example.test",
    });
    const records = await t.run((ctx) =>
      createAssetGraph(ctx, {
        legacyAsset: {
          userId: owner.userId,
          key: "users/owner/pending.png",
          bucket: "private-library",
          kind: "preview",
          status: "active",
        },
        mediaKind: "generated-image",
        rendition: "original",
        origin: "generated",
        bucketRole: "private",
        versionStatus: "processing",
        storageStatus: "pending",
      })
    );

    await expect(
      t.query(internal.assets.authorizePrivateDownload, {
        storageObjectId: records.storageObjectId,
        tokenIdentifier: "pending-owner",
      })
    ).resolves.toBeNull();
  });

  it("enforces the effective Original download entitlement", async () => {
    const owner = await seedUser(t, {
      tokenIdentifier: "restricted-owner",
      email: "restricted@example.test",
    });
    await t.mutation(internal.init.seedEntitlementProfiles, {});
    const records = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("entitlementProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", "free-default"))
        .unique();
      if (!profile) throw new Error("Free entitlement profile not found");
      await ctx.db.patch(profile._id, { originalDownloadAllowed: false });
      return await createAssetGraph(ctx, {
        legacyAsset: {
          userId: owner.userId,
          key: "users/restricted/original.png",
          bucket: "private-library",
          kind: "preview",
          status: "active",
        },
        mediaKind: "generated-image",
        rendition: "original",
        origin: "generated",
        bucketRole: "private",
      });
    });

    await expect(
      t.query(internal.assets.authorizePrivateDownload, {
        storageObjectId: records.storageObjectId,
        tokenIdentifier: "restricted-owner",
      })
    ).resolves.toBeNull();
  });
});
