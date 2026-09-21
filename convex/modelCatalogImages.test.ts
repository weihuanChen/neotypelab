import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import {
  assertCatalogImageReference,
  isManagedCatalogKey,
  kitImageField,
} from "./modelCatalogImages";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");

describe("model catalog images", () => {
  it("classifies managed catalog keys and field mapping", () => {
    expect(isManagedCatalogKey("catalog/kits/abc/cover-1.webp")).toBe(true);
    expect(isManagedCatalogKey("https://cdn.example/cover.webp")).toBe(false);
    expect(isManagedCatalogKey("showcase/concept/preview.webp")).toBe(false);
    expect(kitImageField("cover")).toBe("thumbnailAssetKey");
    expect(kitImageField("fullBody")).toBe("fullBodyAssetKey");
    expect(() => assertCatalogImageReference("storage:abc")).toThrow(/HTTPS/);
    expect(() => assertCatalogImageReference("catalog/kits/x/cover.webp")).not.toThrow();
  });

  it("stores cover and full-body keys and resolves public URLs for admin list", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.test";
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.init, {});
    const admin = await seedUser(t, {
      tokenIdentifier: "catalog-admin",
      email: "admin@example.test",
      isAdmin: true,
    });

    const kitVariantId = await admin.client.mutation(api.modelCatalogAdmin.upsertKitVariant, {
      name: "Test Kit Cover",
      aliases: [],
      tags: [],
      status: "active",
      isActive: true,
      thumbnailAssetKey: "catalog/kits/demo/cover.webp",
      fullBodyAssetKey: "catalog/kits/demo/fullbody.webp",
    });

    const catalog = await admin.client.query(api.modelCatalogAdmin.listModelCatalogData, {});
    const kit = catalog.kitVariants.find((item) => item._id === kitVariantId);
    expect(kit?.thumbnailAssetKey).toBe("catalog/kits/demo/cover.webp");
    expect(kit?.fullBodyAssetKey).toBe("catalog/kits/demo/fullbody.webp");
    expect(kit?.portraitUrl).toBe("https://cdn.example.test/catalog/kits/demo/cover.webp");
    expect(kit?.fullBodyUrl).toBe("https://cdn.example.test/catalog/kits/demo/fullbody.webp");

    const selected = await t.query(api.kitPicker.selected, { kitId: kitVariantId });
    expect(selected?.portrait).toBe("https://cdn.example.test/catalog/kits/demo/cover.webp");
    expect(selected).not.toHaveProperty("fullBody");
  });

  it("applyKitImageKey replaces cover and reports previous managed key", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.init, {});
    const admin = await seedUser(t, {
      tokenIdentifier: "catalog-admin-2",
      email: "admin2@example.test",
      isAdmin: true,
    });
    const kitVariantId = await admin.client.mutation(api.modelCatalogAdmin.upsertKitVariant, {
      name: "Replace Cover Kit",
      aliases: [],
      tags: [],
      status: "active",
      isActive: true,
      thumbnailAssetKey: "catalog/kits/demo/old-cover.webp",
    });

    const result = await t.mutation(internal.modelCatalogAdmin.applyKitImageKey, {
      kitVariantId,
      kind: "cover",
      key: "catalog/kits/demo/new-cover.webp",
      actorTokenIdentifier: "catalog-admin-2",
    });
    expect(result.previousKey).toBe("catalog/kits/demo/old-cover.webp");

    const kit = await t.run(async (ctx) => ctx.db.get(kitVariantId));
    expect(kit?.thumbnailAssetKey).toBe("catalog/kits/demo/new-cover.webp");
  });

  it("rejects non-admin staging URL generation", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.init, {});
    const user = await seedUser(t, {
      tokenIdentifier: "catalog-user",
      email: "user@example.test",
    });
    await expect(
      user.client.mutation(api.modelCatalogAdmin.generateKitImageStagingUrl, {})
    ).rejects.toThrow(/Super admin/);
  });
});
