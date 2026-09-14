import { v } from "convex/values";
import { z } from "zod";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./functions";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { styleIntentSchema } from "./creativeContracts";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { getPublishedRenditions } from "./publications";
import type { QueryCtx } from "./types";

// A deliberate public projection. Never expose storage keys or raw provider prompts.
const publicPaletteSchema = z.object({
  entries: z.array(z.object({
    roleName: z.string(), roleSlug: z.string(), rationale: z.string(),
    suggestedPaint: z.object({
      _id: z.string(), brand: z.string(), code: z.string(), colorName: z.string(),
      hexPreview: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    }),
  })).min(1),
});

function officialIntent(style: Doc<"stylePresets">) {
  if (!style.isActive || !style.styleIntentJson) return null;
  try {
    const intent = styleIntentSchema.parse(JSON.parse(style.styleIntentJson));
    return intent.source === "official" && intent.styleType === "preset" ? intent : null;
  } catch {
    return null;
  }
}

async function resolveReview(ctx: QueryCtx, review: Doc<"styleEditorialReviews">) {
  if (!review.isPublished) return null;
  const [style, model, concept] = await Promise.all([
    ctx.db.get(review.stylePresetId), ctx.db.get(review.baseModelId), ctx.db.get(review.conceptId),
  ]);
  const intent = style ? officialIntent(style) : null;
  if (!style || !intent || !model || !isPublicModelCatalogRecord(model) || !concept ||
    concept.visibility !== "public" || !["generated", "archived"].includes(concept.status) ||
    concept.baseModelId !== model._id || concept.stylePresetId !== style._id ||
    concept.activePublicationId !== review.publicationId ||
    JSON.stringify(intent) !== review.styleIntentJson ||
    concept.styleIntentJson !== review.styleIntentJson ||
    concept.palettePlanJson !== review.palettePlanJson ||
    concept.renderSpecificationJson !== review.renderSpecificationJson) return null;
  const published = await getPublishedRenditions(ctx, concept);
  if (!published || published.publication.conceptId !== concept._id ||
    published.publication.visibility !== "public" || !published.preview?.publicUrl) return null;
  const palette = publicPaletteSchema.safeParse(JSON.parse(review.palettePlanJson));
  if (!palette.success) return null;
  return {
    style: {
      id: style._id, slug: style.slug, name: intent.name,
      description: style.shortDescription ?? intent.graphicLanguage,
      category: style.category ?? "Repaint studies", featured: style.isFeaturedStyle ?? false, intent,
    },
    model: { id: model._id, slug: model.slug, name: model.name, scale: model.scale, grade: model.grade },
    conceptId: concept._id, imageUrl: published.preview.publicUrl,
    palette: palette.data, reviewedAt: review.reviewedAt,
  };
}

export async function listEditorialPairs(ctx: QueryCtx) {
  const reviews = await ctx.db.query("styleEditorialReviews").withIndex("by_published", q => q.eq("isPublished", true)).collect();
  const pairs = await Promise.all(reviews.map(review => resolveReview(ctx, review)));
  return pairs.filter((pair): pair is NonNullable<typeof pair> => pair !== null);
}

export const gallery = query({
  args: {},
  handler: async (ctx) => {
    const pairs = await listEditorialPairs(ctx);
    return pairs.filter((pair, index) => pairs.findIndex(p => p.style.id === pair.style.id) === index)
      .map(pair => ({
        ...pair.style, imageUrl: pair.imageUrl,
        modelCount: pairs.filter(p => p.style.id === pair.style.id).length,
        reviewedAt: Math.max(...pairs.filter(p => p.style.id === pair.style.id).map(p => p.reviewedAt)),
      })).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  },
});

export const getStyle = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const style = await ctx.db.query("stylePresets").withIndex("by_slug", q => q.eq("slug", slug)).unique();
    if (!style || !officialIntent(style)) return null;
    const reviews = await ctx.db.query("styleEditorialReviews").withIndex("by_style", q => q.eq("stylePresetId", style._id)).collect();
    const resolved = await Promise.all(reviews.map(review => resolveReview(ctx, review)));
    const pairs = resolved.filter((pair): pair is NonNullable<typeof pair> => pair !== null)
      .sort((a, b) => a.model.name.localeCompare(b.model.name));
    return pairs.length ? { style: pairs[0].style, pairs } : null;
  },
});

export const getPair = query({
  args: { styleSlug: v.string(), modelSlug: v.string() },
  handler: async (ctx, { styleSlug, modelSlug }) => {
    const [style, model] = await Promise.all([
      ctx.db.query("stylePresets").withIndex("by_slug", q => q.eq("slug", styleSlug)).unique(),
      ctx.db.query("baseModels").withIndex("by_slug", q => q.eq("slug", modelSlug)).unique(),
    ]);
    if (!style || !model) return null;
    const review = await ctx.db.query("styleEditorialReviews").withIndex("by_style_model", q =>
      q.eq("stylePresetId", style._id).eq("baseModelId", model._id)).unique();
    return review ? resolveReview(ctx, review) : null;
  },
});

export const sitemap = query({
  args: {},
  handler: async (ctx) => (await listEditorialPairs(ctx)).map(pair => ({
    styleSlug: pair.style.slug, modelSlug: pair.model.slug, lastModified: pair.reviewedAt,
  })),
});

export const adminWorkspace = query({
  args: {},
  handler: async (ctx) => {
    requireSuperAdmin(ctx);
    const [styles, reviews, concepts] = await Promise.all([
      ctx.db.query("stylePresets").collect(), ctx.db.query("styleEditorialReviews").collect(),
      ctx.db.query("concepts").withIndex("by_visibility", q => q.eq("visibility", "public")).collect(),
    ]);
    return {
      styles: styles.map(style => ({ id: style._id, name: style.name, slug: style.slug, intentJson: style.styleIntentJson ?? "" })),
      reviews: await Promise.all(reviews.map(async review => ({
        id: review._id, styleId: review.stylePresetId, conceptId: review.conceptId,
        isPublished: review.isPublished, live: Boolean(await resolveReview(ctx, review)),
      }))),
      candidates: concepts.filter(c => c.stylePresetId && c.styleIntentJson && c.palettePlanJson && c.renderSpecificationJson)
        .map(c => ({ id: c._id, title: c.title, styleId: c.stylePresetId })),
    };
  },
});

export const saveOfficialIntent = mutation({
  args: { stylePresetId: v.id("stylePresets"), intentJson: v.string() },
  handler: async (ctx, args) => {
    const { viewer } = requireSuperAdmin(ctx);
    const style = await ctx.db.get(args.stylePresetId);
    if (!style) throw new Error("Style not found");
    const intent = styleIntentSchema.parse(JSON.parse(args.intentJson));
    if (intent.source !== "official" || intent.styleType !== "preset") throw new Error("Use an official preset intent");
    await ctx.db.patch(style._id, {
      name: intent.name,
      searchText: [intent.name, style.category, style.shortDescription, ...style.promptKeywords, ...style.seoKeywords].filter(Boolean).join(" "),
      styleIntentJson: JSON.stringify(intent), styleIntentVersion: intent.version,
    });
    await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: "save-official-style-intent", entityType: "stylePreset", entityId: style._id });
  },
});

export const reviewConcept = mutation({
  args: { conceptId: v.id("concepts"), confirmed: v.boolean() },
  handler: async (ctx, { conceptId, confirmed }) => {
    const { viewer } = requireSuperAdmin(ctx);
    if (!confirmed) throw new Error("Review the preview and paint mapping before publishing");
    const concept = await ctx.db.get(conceptId);
    if (!concept?.stylePresetId || !concept.baseModelId || !concept.styleIntentJson ||
      !concept.palettePlanJson || !concept.renderSpecificationJson || !concept.activePublicationId) {
      throw new Error("Choose a generated preset concept with frozen intent, palette and a public preview");
    }
    const palette = publicPaletteSchema.parse(JSON.parse(concept.palettePlanJson));
    for (const entry of palette.entries) {
      const id = ctx.db.normalizeId("paintMappings", entry.suggestedPaint._id);
      const paint = id ? await ctx.db.get(id) : null;
      if (!paint?.isActive || paint.code !== entry.suggestedPaint.code || paint.brand !== entry.suggestedPaint.brand) {
        throw new Error("Every role must map to a real active catalog paint");
      }
    }
    const previous = await ctx.db.query("styleEditorialReviews").withIndex("by_style_model", q =>
      q.eq("stylePresetId", concept.stylePresetId!).eq("baseModelId", concept.baseModelId!)).unique();
    const fields = {
      stylePresetId: concept.stylePresetId, baseModelId: concept.baseModelId, conceptId,
      publicationId: concept.activePublicationId, styleIntentJson: concept.styleIntentJson,
      palettePlanJson: concept.palettePlanJson, renderSpecificationJson: concept.renderSpecificationJson,
      isPublished: true, reviewedByUserId: viewer._id, reviewedAt: Date.now(),
    };
    const id = previous ? previous._id : await ctx.db.insert("styleEditorialReviews", fields);
    if (previous) await ctx.db.patch(id, fields);
    const saved = await ctx.db.get(id);
    if (!saved || !await resolveReview(ctx, saved)) throw new Error("Preview must be public and match the current active official intent");
    await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: "publish-style-model-review", entityType: "styleEditorialReview", entityId: id });
    return id;
  },
});

export const withdraw = mutation({
  args: { reviewId: v.id("styleEditorialReviews") },
  handler: async (ctx, { reviewId }) => {
    const { viewer } = requireSuperAdmin(ctx);
    await ctx.db.patch(reviewId, { isPublished: false });
    await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: "withdraw-style-model-review", entityType: "styleEditorialReview", entityId: reviewId });
  },
});
