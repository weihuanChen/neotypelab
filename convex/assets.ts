import { v } from "convex/values";
import { vAssetKind } from "./domain";
import { internalMutation, mutation, query } from "./functions";

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
    return await ctx.db.insert("assets", {
      userId: ctx.viewerX()._id,
      key,
      bucket: process.env.R2_BUCKET_PRIVATE ?? "r2",
      kind,
      contentType,
      byteSize,
      publicUrl,
      status: "active",
    });
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
    return await ctx.db.insert("assets", {
      userId: viewer._id,
      key: storageId,
      bucket: "convex-storage",
      kind: "reference",
      contentType: metadata.contentType ?? undefined,
      byteSize: metadata.size,
      publicUrl: publicUrl ?? undefined,
      status: "active",
    });
  },
});

export const setPublicUrl = internalMutation({
  args: {
    assetId: v.id("assets"),
    publicUrl: v.string(),
  },
  async handler(ctx, { assetId, publicUrl }) {
    await ctx.db.patch(assetId, {
      publicUrl,
    });
  },
});
