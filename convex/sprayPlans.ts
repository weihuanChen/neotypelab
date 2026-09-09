import { v } from "convex/values";
import { buildPaintPlan } from "./paintMappingEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { mutation, query } from "./functions";

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const plans = await ctx.db
      .query("sprayPlans")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();

    return await Promise.all(
      plans.map(async (plan) => {
        const [concept, version] = await Promise.all([
          ctx.db.get(plan.conceptId),
          plan.currentVersionId ? ctx.db.get(plan.currentVersionId) : null,
        ]);
        return {
          ...plan,
          conceptRecordNumber: concept?.recordNumber,
          snapshot: version ? JSON.parse(version.planSnapshotJson) : null,
        };
      })
    );
  },
});

export const createFromConcept = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    if (ctx.viewer === null) {
      throw new Error("Sign in to create a spray plan");
    }

    const concept = await ctx.db.get(conceptId);
    if (concept === null || concept.userId !== ctx.viewerX()._id) {
      throw new Error("Prototype not found");
    }

    const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings] =
      await Promise.all([
        concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
        concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
        concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
        ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
        listResolvedPaintMappings(ctx),
      ]);

    const snapshot = buildPaintPlan({
      approvedPlanJson: concept.palettePlanJson,
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

    const existing = await ctx.db
      .query("sprayPlans")
      .withIndex("by_user_concept", (q) =>
        q.eq("userId", ctx.viewerX()._id).eq("conceptId", conceptId)
      )
      .unique();
    const now = Date.now();
    const nextVersion = (existing?.currentVersion ?? 0) + 1;
    const planId = existing
      ? existing._id
      : await ctx.db.insert("sprayPlans", {
          userId: ctx.viewerX()._id,
          conceptId,
          title: concept.title,
          status: "draft",
          currentVersion: nextVersion,
          createdAt: now,
          updatedAt: now,
        });
    const versionId = await ctx.db.insert("sprayPlanVersions", {
      sprayPlanId: planId,
      userId: ctx.viewerX()._id,
      version: nextVersion,
      sourceConceptId: conceptId,
      sourceConceptCreatedAt: concept._creationTime,
      planSnapshotJson: JSON.stringify(snapshot),
      changeNote: existing ? "Regenerated from current prototype data" : "Initial plan",
      createdAt: now,
    });

    await ctx.db.patch(planId, {
      title: concept.title,
      status: "ready",
      currentVersion: nextVersion,
      currentVersionId: versionId,
      updatedAt: now,
    });

    return { planId, version: nextVersion };
  },
});
