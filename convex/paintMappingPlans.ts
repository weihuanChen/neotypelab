import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { buildPaintPlan } from "./paintMappingEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { query } from "./functions";
import { QueryCtx } from "./types";

export const getConceptPaintPlan = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    if (ctx.viewer === null) {
      return null;
    }
    return await buildConceptPaintPlan(ctx, conceptId);
  },
});

export const listForViewerConcepts = query({
  args: {
    conceptIds: v.array(v.id("concepts")),
  },
  async handler(ctx, { conceptIds }) {
    if (ctx.viewer === null || conceptIds.length === 0) {
      return [];
    }

    const uniqueConceptIds = Array.from(new Set(conceptIds));
    const plans = await Promise.all(
      uniqueConceptIds.map((conceptId) => buildConceptPaintPlan(ctx, conceptId))
    );
    return plans.filter((plan): plan is NonNullable<typeof plan> => plan !== null);
  },
});

async function buildConceptPaintPlan(ctx: QueryCtx, conceptId: Id<"concepts">) {
  const concept = await ctx.db.get(conceptId);
  if (concept === null || concept.userId !== ctx.viewerX()._id) {
    return null;
  }

  const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings] = await Promise.all([
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
    ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
    listResolvedPaintMappings(ctx),
  ]);

  return buildPaintPlan({
    conceptId: concept._id,
    conceptTitle: concept.title,
    baseModelName: baseModel?.name,
    stylePresetName: stylePreset?.name,
    styleSlug: stylePreset?.slug,
    materialPresetName: materialPreset?.name,
    materialSlug: materialPreset?.slug,
    moodTags: concept.moodTags ?? [],
    weatheringLevel: concept.weatheringLevel,
    colorRoles,
    paintMappings,
  });
}
