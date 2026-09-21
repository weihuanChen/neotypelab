"use node";

import { v } from "convex/values";
import { randomUUID } from "crypto";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  isManagedCatalogKey,
  vKitImageKind,
  type KitImageKind,
} from "./modelCatalogImages";
import { getPublicR2ObjectUrl } from "./r2Config";
import {
  deleteR2Object,
  purgePublicR2Urls,
  uploadR2Object,
} from "./r2Storage";

const MAX_KIT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
]);

function extensionForContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  return "webp";
}

function buildCatalogKey(kitVariantId: string, kind: KitImageKind, contentType: string) {
  const role = kind === "cover" ? "cover" : "fullbody";
  return `catalog/kits/${kitVariantId}/${role}-${randomUUID()}.${extensionForContentType(contentType)}`;
}

async function cleanupManagedPublicObject(key: string | null | undefined) {
  if (!isManagedCatalogKey(key) || !key) return;
  await deleteR2Object("public", key);
  const publicUrl = getPublicR2ObjectUrl(key);
  if (publicUrl) {
    await purgePublicR2Urls([publicUrl]);
  }
}

export const commitKitImage = action({
  args: {
    kitVariantId: v.id("baseModels"),
    kind: vKitImageKind,
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<{
    key: string;
    publicUrl: string | null;
    kind: KitImageKind;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication is required");
    }
    await ctx.runQuery(internal.generation.assertPlatformAdminForConnectionTest, {
      tokenIdentifier: identity.tokenIdentifier,
    });

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Uploaded image was not found");
    }

    const contentType = (blob.type || "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Use a WebP, JPEG, or PNG image");
    }
    if (blob.size > MAX_KIT_IMAGE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Image must be 5 MB or smaller");
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const key = buildCatalogKey(args.kitVariantId, args.kind, contentType);

    try {
      await uploadR2Object("public", {
        buffer,
        contentType,
        key,
      });
    } catch (error) {
      await ctx.storage.delete(args.storageId);
      throw error;
    }

    const applied: {
      previousKey: string | null;
      publicUrl: string | null;
    } = await ctx.runMutation(internal.modelCatalogAdmin.applyKitImageKey, {
      kitVariantId: args.kitVariantId,
      kind: args.kind,
      key,
      actorTokenIdentifier: identity.tokenIdentifier,
    });

    await cleanupManagedPublicObject(applied.previousKey);
    await ctx.storage.delete(args.storageId);

    return {
      key,
      publicUrl: applied.publicUrl ?? getPublicR2ObjectUrl(key) ?? null,
      kind: args.kind,
    };
  },
});

export const removeKitImage = action({
  args: {
    kitVariantId: v.id("baseModels"),
    kind: vKitImageKind,
  },
  handler: async (ctx, args): Promise<{ cleared: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication is required");
    }
    await ctx.runQuery(internal.generation.assertPlatformAdminForConnectionTest, {
      tokenIdentifier: identity.tokenIdentifier,
    });

    const cleared: { previousKey: string | null } = await ctx.runMutation(
      internal.modelCatalogAdmin.clearKitImageKey,
      {
        kitVariantId: args.kitVariantId,
        kind: args.kind,
        actorTokenIdentifier: identity.tokenIdentifier,
      }
    );

    await cleanupManagedPublicObject(cleared.previousKey);
    return { cleared: true };
  },
});
