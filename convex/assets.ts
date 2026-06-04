import { v } from "convex/values";
import { vAssetKind } from "./domain";
import { internalMutation, mutation, query } from "./functions";

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
      bucket: process.env.R2_BUCKET ?? "r2",
      kind,
      contentType,
      byteSize,
      publicUrl,
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
