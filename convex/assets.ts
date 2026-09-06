import { v } from "convex/values";
import { vAssetKind } from "./domain";
import { internalMutation, internalQuery, mutation, query } from "./functions";
import {
  createAssetGraph,
  legacyKindToMediaKind,
  legacyKindToRendition,
} from "./assetModel";
import { resolveEffectiveEntitlements } from "./entitlements";
import {
  assertPrivateStorageAdditionAllowed,
  reconcileAccountStorageUsage,
} from "./storageAccounting";

const MAX_FEEDBACK_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const FEEDBACK_SCREENSHOT_TYPES = new Set(["image/jpeg", "image/png"]);

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();

    return assets.map((asset) => ({
      _id: asset._id,
      key: asset.key,
      bucket: asset.bucket,
      kind: asset.kind,
      status: asset.status,
      publicUrl: asset.publicUrl,
      storageObjectId: asset.storageObjectId,
    }));
  },
});

export const createReference = mutation({
  args: {
    key: v.string(),
    kind: vAssetKind,
    contentType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    publicUrl: v.optional(v.string()),
  },
  async handler(ctx, { key, kind, contentType, byteSize, publicUrl }) {
    const userId = ctx.viewerX()._id;
    if (!Number.isInteger(byteSize) || (byteSize ?? 0) <= 0) {
      throw new Error("Private asset byte size is required for storage quota enforcement");
    }
    await assertPrivateStorageAdditionAllowed(ctx, userId, {
      optimizedBytes: byteSize,
    });
    const result = await createAssetGraph(ctx, {
      legacyAsset: {
        userId,
        key,
        bucket: process.env.R2_BUCKET_PRIVATE ?? "r2",
        kind,
        contentType,
        byteSize,
        publicUrl,
        status: "active",
      },
      mediaKind: legacyKindToMediaKind(kind),
      rendition: legacyKindToRendition(kind),
      origin: "uploaded",
      bucketRole: "private",
    });
    await reconcileAccountStorageUsage(ctx, userId);
    return result.legacyAssetId;
  },
});

export const generateFeedbackUploadUrl = mutation({
  args: {},
  async handler(ctx) {
    ctx.viewerX();
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerFeedbackScreenshot = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  async handler(ctx, { storageId }) {
    const viewer = ctx.viewerX();
    const metadata = await ctx.storage.getMetadata(storageId);

    if (!metadata) {
      throw new Error("The uploaded screenshot could not be found");
    }
    if (!FEEDBACK_SCREENSHOT_TYPES.has(metadata.contentType ?? "")) {
      await ctx.storage.delete(storageId);
      throw new Error("Feedback screenshots must be PNG or JPG files");
    }
    if (metadata.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
      await ctx.storage.delete(storageId);
      throw new Error("Feedback screenshots must be 10 MB or smaller");
    }

    const publicUrl = await ctx.storage.getUrl(storageId);
    const result = await createAssetGraph(ctx, {
      legacyAsset: {
        userId: viewer._id,
        key: storageId,
        bucket: "convex-storage",
        kind: "reference",
        contentType: metadata.contentType ?? undefined,
        byteSize: metadata.size,
        publicUrl: publicUrl ?? undefined,
        status: "active",
      },
      mediaKind: "feedback-screenshot",
      rendition: "source",
      origin: "uploaded",
      bucketRole: "convex",
    });
    return result.legacyAssetId;
  },
});

export const setPublicUrl = internalMutation({
  args: {
    assetId: v.id("assets"),
    publicUrl: v.string(),
  },
  async handler(ctx, { assetId, publicUrl }) {
    const asset = await ctx.db.get(assetId);
    await ctx.db.patch(assetId, {
      publicUrl,
    });
    if (asset?.storageObjectId) {
      await ctx.db.patch(asset.storageObjectId, {
        publicUrl,
        updatedAt: Date.now(),
      });
    }
  },
});

export const authorizePrivateDownload = internalQuery({
  args: {
    storageObjectId: v.id("storageObjects"),
    tokenIdentifier: v.string(),
  },
  async handler(ctx, { storageObjectId, tokenIdentifier }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (!viewer) return null;

    const object = await ctx.db.get(storageObjectId);
    if (
      !object ||
      object.userId !== viewer._id ||
      object.bucketRole !== "private" ||
      object.status !== "ready"
    ) {
      return null;
    }
    const entitlements = await resolveEffectiveEntitlements(ctx, viewer._id);
    if (object.rendition === "original" && !entitlements.originalDownloadAllowed) {
      return null;
    }
    return {
      bucket: object.bucket,
      key: object.key,
      rendition: object.rendition,
      contentType: object.contentType,
    };
  },
});
