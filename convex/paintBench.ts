import { v } from "convex/values";
import { mutation, query } from "./functions";

export const listCatalog = query({
  args: {},
  async handler(ctx) {
    const paints = (await ctx.db.query("paintMappings").collect()).filter(
      (paint) => paint.isActive
    );
    const benchItems =
      ctx.viewer === null
        ? []
        : await ctx.db
            .query("paintBenchItems")
            .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
            .collect();
    const benchByPaint = new Map(
      benchItems.map((item) => [item.paintMappingId, item])
    );

    return await Promise.all(
      paints.map(async (paint) => {
        const sources = await ctx.db
          .query("paintPurchaseSources")
          .withIndex("by_paintMappingId", (q) =>
            q.eq("paintMappingId", paint._id)
          )
          .collect();
        return {
          ...paint,
          benchItem: benchByPaint.get(paint._id) ?? null,
          purchaseSources:
            sources.length > 0
              ? sources.filter((source) => source.isActive)
              : paint.affiliateUrl
                ? [
                    {
                      _id: null,
                      sourceName: "Purchase source",
                      sourceType: "other" as const,
                      url: paint.affiliateUrl,
                      affiliate: true,
                      region: paint.availabilityRegion,
                      priceMinor: undefined,
                      currency: undefined,
                    },
                  ]
                : [],
        };
      })
    );
  },
});

export const setBenchItem = mutation({
  args: {
    paintMappingId: v.id("paintMappings"),
    quantity: v.number(),
    status: v.union(
      v.literal("in-stock"),
      v.literal("low"),
      v.literal("empty"),
      v.literal("wishlist")
    ),
  },
  async handler(ctx, args) {
    if (ctx.viewer === null) {
      throw new Error("Sign in to update your paint bench");
    }
    const paint = await ctx.db.get(args.paintMappingId);
    if (paint === null || !paint.isActive) {
      throw new Error("Paint not found");
    }
    const existing = await ctx.db
      .query("paintBenchItems")
      .withIndex("by_user_paint", (q) =>
        q
          .eq("userId", ctx.viewerX()._id)
          .eq("paintMappingId", args.paintMappingId)
      )
      .unique();
    const patch = {
      quantity: Math.max(0, Math.floor(args.quantity)),
      status: args.status,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("paintBenchItems", {
      userId: ctx.viewerX()._id,
      paintMappingId: args.paintMappingId,
      ...patch,
    });
  },
});
