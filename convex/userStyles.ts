import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./functions";
import type { MutationCtx, QueryCtx } from "./types";
import { styleIntentSchema } from "./creativeContracts";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { getPublishedRenditions } from "./publications";

function activeViewer(ctx: MutationCtx) {
  const viewer = ctx.viewerX();
  if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
  return viewer;
}
export async function ownedStyle(ctx: QueryCtx | MutationCtx, styleId: Id<"userStyles">, intentJson?: string) {
  const style = await ctx.db.get(styleId);
  if (!style || style.userId !== ctx.viewerX()._id || style.status !== "active") throw new Error("Saved style is unavailable");
  if (intentJson === undefined || JSON.stringify(styleIntentSchema.parse(JSON.parse(intentJson))) !== style.intentJson) {
    throw new Error("Saved style does not match the selected intent");
  }
  return style;
}

export const saveInterpretation = mutation({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }) => {
    const viewer = activeViewer(ctx);
    const row = await ctx.db.get(promptCompositionId);
    if (!row || row.userId !== viewer._id || row.status !== "consumed" ||
      JSON.parse(row.inputSnapshotJson).kind !== "style-interpreter") throw new Error("Use a completed interpretation that belongs to you");
    const previous = await ctx.db.query("userStyles").withIndex("by_user_composition", q =>
      q.eq("userId", viewer._id).eq("promptCompositionId", promptCompositionId)).unique();
    if (previous) {
      if (previous.status !== "active") throw new Error("Saved style is unavailable");
      return { styleId: previous._id, intent: styleIntentSchema.parse(JSON.parse(previous.intentJson)) };
    }
    const intent = styleIntentSchema.parse(JSON.parse(row.outputSummaryJson ?? "{}").intent);
    if (intent.source !== "private" || intent.styleType !== "custom") throw new Error("Only custom interpretations can be saved");
    const styleId = await ctx.db.insert("userStyles", {
      userId: viewer._id, name: intent.name, intentJson: JSON.stringify(intent),
      promptCompositionId, visibility: "private", status: "active", saveCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
    });
    return { styleId, intent };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    if (!ctx.viewer) return [];
    const rows = await ctx.db.query("userStyles").withIndex("by_user", q => q.eq("userId", ctx.viewer!._id)).order("desc").collect();
    return rows.map(row => ({
      id: row._id, name: row.name, intent: styleIntentSchema.parse(JSON.parse(row.intentJson)),
      visibility: row.visibility, status: row.status, sourceStyleId: row.sourceStyleId,
      promoted: Boolean(row.promotedPresetId), saveCount: row.saveCount,
    }));
  },
});

export const setVisibility = mutation({
  args: { styleId: v.id("userStyles"), visibility: v.union(v.literal("private"), v.literal("community")) },
  handler: async (ctx, { styleId, visibility }) => {
    const viewer = activeViewer(ctx);
    const style = await ctx.db.get(styleId);
    if (!style || style.userId !== viewer._id || style.status !== "active") throw new Error("Style unavailable");
    if (visibility === "community" && style.sourceStyleId) throw new Error("Saved community copies stay private. Interpret your own variation to publish a new style.");
    await ctx.db.patch(styleId, { visibility, updatedAt: Date.now() });
  },
});

async function communityCard(ctx: QueryCtx, style: Doc<"userStyles">) {
  if (style.visibility !== "community" || style.status !== "active" || style.sourceStyleId) return null;
  const creator = await ctx.db.get(style.userId);
  if (!creator || creator.accountStatus === "suspended") return null;
  const concepts = await ctx.db.query("concepts").withIndex("by_styleRoot", q => q.eq("styleRootId", style._id)).collect();
  const publicConcepts = concepts.filter(c => c.visibility === "public" &&
    (c.status === "generated" || c.status === "archived") && c.styleIntentJson === style.intentJson);
  const previews = await Promise.all(publicConcepts.map(async concept => {
    const assets = await getPublishedRenditions(ctx, concept);
    return assets?.publication.visibility === "public" && assets.publication.conceptId === concept._id && assets.preview?.publicUrl
      ? { conceptId: concept._id, imageUrl: assets.preview.publicUrl } : null;
  }));
  const published = previews.filter((item): item is NonNullable<typeof item> => item !== null);
  const intent = styleIntentSchema.parse(JSON.parse(style.intentJson));
  return {
    id: style._id, name: style.name, intent: { ...intent, source: "community" as const },
    creator: { handle: creator.handle, name: creator.fullName },
    saveCount: style.saveCount, publicPrototypeCount: published.length, preview: published.at(0) ?? null,
    promoted: Boolean(style.promotedPresetId), createdAt: style.createdAt,
  };
}

export const community = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("userStyles").withIndex("by_visibility_status", q =>
      q.eq("visibility", "community").eq("status", "active")).collect();
    const cards = await Promise.all(rows.map(row => communityCard(ctx, row)));
    return cards.filter((card): card is NonNullable<typeof card> => card !== null)
      .sort((a, b) => (b.saveCount + b.publicPrototypeCount * 2) - (a.saveCount + a.publicPrototypeCount * 2) || b.createdAt - a.createdAt);
  },
});

export const getCommunityStyle = query({
  args: { styleId: v.string() },
  handler: async (ctx, { styleId }) => {
    const id = ctx.db.normalizeId("userStyles", styleId);
    const style = id ? await ctx.db.get(id) : null;
    return style ? communityCard(ctx, style) : null;
  },
});

export const saveCommunityStyle = mutation({
  args: { styleId: v.id("userStyles") },
  handler: async (ctx, { styleId }) => {
    const viewer = activeViewer(ctx);
    const source = await ctx.db.get(styleId);
    if (!source || !await communityCard(ctx, source)) throw new Error("Community style is unavailable");
    if (source.userId === viewer._id) return { styleId: source._id, intent: styleIntentSchema.parse(JSON.parse(source.intentJson)) };
    const previous = await ctx.db.query("userStyles").withIndex("by_user_root", q =>
      q.eq("userId", viewer._id).eq("rootStyleId", source._id)).unique();
    if (previous) {
      if (previous.status !== "active") throw new Error("Saved style is unavailable");
      return { styleId: previous._id, intent: styleIntentSchema.parse(JSON.parse(previous.intentJson)) };
    }
    const id = await ctx.db.insert("userStyles", {
      userId: viewer._id, name: source.name, intentJson: source.intentJson,
      sourceStyleId: source._id, rootStyleId: source._id, visibility: "private", status: "active",
      saveCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await ctx.db.patch(source._id, { saveCount: source.saveCount + 1 });
    return { styleId: id, intent: styleIntentSchema.parse(JSON.parse(source.intentJson)) };
  },
});

export const adminCommunity = query({
  args: {},
  handler: async (ctx) => {
    requireSuperAdmin(ctx);
    const rows = (await ctx.db.query("userStyles").collect()).filter(row => row.visibility === "community" && !row.sourceStyleId);
    return rows.map(row => ({
      id: row._id, name: row.name, status: row.status, saveCount: row.saveCount,
      intent: styleIntentSchema.parse(JSON.parse(row.intentJson)), promotedPresetId: row.promotedPresetId,
    })).sort((a, b) => b.saveCount - a.saveCount);
  },
});

export const moderate = mutation({
  args: { styleId: v.id("userStyles"), hidden: v.boolean() },
  handler: async (ctx, { styleId, hidden }) => {
    const { viewer } = requireSuperAdmin(ctx);
    await ctx.db.patch(styleId, { status: hidden ? "hidden" : "active", updatedAt: Date.now() });
    await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: hidden ? "hide-community-style" : "restore-community-style", entityType: "userStyle", entityId: styleId });
  },
});

export const promote = mutation({
  args: { styleId: v.id("userStyles"), name: v.string(), slug: v.string(), description: v.string(), confirmed: v.boolean() },
  handler: async (ctx, args) => {
    const { viewer } = requireSuperAdmin(ctx);
    const source = await ctx.db.get(args.styleId);
    if (!source || !await communityCard(ctx, source)) throw new Error("Choose an active community style");
    if (!args.confirmed) throw new Error("Review the style before promoting");
    if (source.promotedPresetId) return source.promotedPresetId;
    const name = args.name.trim();
    const slug = args.slug.trim();
    const description = args.description.trim();
    if (!name || name.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !description || description.length > 1500) {
      throw new Error("Supply a visual-language name, lowercase hyphenated slug and a short description");
    }
    if (await ctx.db.query("stylePresets").withIndex("by_slug", q => q.eq("slug", slug)).unique()) throw new Error("Style slug already exists");
    const intent = styleIntentSchema.parse({ ...JSON.parse(source.intentJson), name, source: "official", styleType: "preset" });
    const id = await ctx.db.insert("stylePresets", {
      name, slug, shortDescription: description, category: "Community curated", promptKeywords: [],
      negativeKeywords: [], recommendedMaterialSlugs: [], seoKeywords: [], creatorUserId: source.userId,
      isActive: false, isFeaturedStyle: false, searchText: name + " " + description,
      styleIntentJson: JSON.stringify(intent), styleIntentVersion: intent.version,
    });
    await ctx.db.patch(source._id, { promotedPresetId: id, updatedAt: Date.now() });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id, action: "promote-community-style", entityType: "stylePreset", entityId: id,
      detailsJson: JSON.stringify({ sourceStyleId: source._id, status: "inactive-draft" }),
    });
    return id;
  },
});
