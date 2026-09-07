import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { buildPaintPlan } from "./paintMappingEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { query } from "./functions";
import { buildFeasibilitySnapshotForSignals } from "./feasibility";
import { getShoppingListSnapshotForRecommendations } from "./shopping";
import { QueryCtx } from "./types";

type RecommendationFeedbackKind = "helpful" | "not-helpful" | "try";
type RecommendationType = "style" | "material" | "workflow" | "sourcing";

type RecommendationItem = {
  type: RecommendationType;
  label: string;
  value: string;
  rationale: string;
  feedback: {
    helpful: boolean;
    notHelpful: boolean;
    try: boolean;
  };
};

type RecommendationSnapshot = {
  conceptId: Id<"concepts">;
  conceptTitle: string;
  feasibilityBias: "balanced" | "practical";
  currentStyle: {
    name: string;
    slug: string;
    category?: string;
    contrastLevel?: string;
  } | null;
  currentMaterial: {
    name: string;
    slug: string;
    difficultyLevel?: string;
    finishType: string;
  } | null;
  alternativeStyles: RecommendationItem[];
  easierMaterials: RecommendationItem[];
  beginnerAlternatives: RecommendationItem[];
  sourcingAlternatives: RecommendationItem[];
};

export const getPublicConceptRecommendations = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    const concept = await ctx.db.get(conceptId);
    if (
      concept === null ||
      (concept.visibility !== "public" && concept.visibility !== "unlisted") ||
      (concept.status !== "generated" && concept.status !== "archived")
    ) {
      return null;
    }

    return await buildRecommendationSnapshot(ctx, concept);
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
    const results = await Promise.all(
      uniqueConceptIds.map(async (conceptId) => {
        const concept = await ctx.db.get(conceptId);
        if (concept === null || concept.userId !== ctx.viewerX()._id) {
          return null;
        }

        return await buildRecommendationSnapshot(ctx, concept);
      })
    );

    return results.filter((result): result is NonNullable<typeof result> => result !== null);
  },
});

export const getViewerConceptRecommendations = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    if (ctx.viewer === null) {
      return null;
    }

    const concept = await ctx.db.get(conceptId);
    if (concept === null || concept.userId !== ctx.viewerX()._id) {
      return null;
    }

    return await buildRecommendationSnapshot(ctx, concept);
  },
});

async function buildRecommendationSnapshot(
  ctx: QueryCtx,
  concept: Doc<"concepts">
): Promise<RecommendationSnapshot | null> {
  const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings, stylePresets, materialPresets] =
    await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      listResolvedPaintMappings(ctx),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
    ]);

  const feasibility = await buildFeasibilitySnapshotForSignals(ctx, concept);
  const shopping = await getShoppingListSnapshotForRecommendations(ctx, concept);

  const feedback =
    ctx.viewer === null
      ? []
      : await ctx.db
          .query("recommendationFeedback")
          .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer!._id))
          .collect()
          .then((items) => items.filter((item) => item.conceptId === concept._id));

  const paintPlan = buildPaintPlan({
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

  const activeStyles = stylePresets.filter((preset) => preset.isActive);
  const activeMaterials = materialPresets.filter((preset) => preset.isActive);

  const preferPracticalAlternatives =
    feasibility !== null &&
    (feasibility.beginnerDifficulty === "advanced" ||
      feasibility.surfaceCompatibility === "sensitive" ||
      feasibility.estimatedLayerCount >= 6);

  const alternativeStyles = activeStyles
    .filter((preset) => preset._id !== stylePreset?._id)
    .filter((preset) => {
      if (stylePreset?.category && preset.category === stylePreset.category) {
        return true;
      }
      if (stylePreset?.contrastLevel && preset.contrastLevel === stylePreset.contrastLevel) {
        return true;
      }
      return (concept.moodTags ?? []).some((tag) =>
        [preset.shortDescription ?? "", preset.searchText].join(" ").toLowerCase().includes(tag.split("-")[0])
      );
    })
    .slice(0, 3)
    .map((preset) => ({
      type: "style" as const,
      label: preset.name,
      value: preset.slug,
      rationale:
        preferPracticalAlternatives
          ? "Keeps the concept in a compatible style family while reducing the risk of overly aggressive contrast or finishing overhead."
          : preset.category === stylePreset?.category
            ? "Keeps the concept in the same Style DNA family while opening a new branch direction."
            : "Preserves enough contrast and mood logic to stay compatible with the current concept.",
    }));

  const easierMaterials = activeMaterials
    .filter((preset) => preset._id !== materialPreset?._id)
    .filter((preset) => {
      const currentDifficulty = materialPreset?.difficultyLevel ?? "medium";
      return currentDifficulty === "hard"
        ? preset.difficultyLevel === "easy" || preset.difficultyLevel === "medium"
        : currentDifficulty === "medium"
          ? preset.difficultyLevel === "easy"
          : false;
    })
    .slice(0, 2)
    .map((preset) => ({
      type: "material" as const,
      label: preset.name,
      value: preset.slug,
      rationale:
        preferPracticalAlternatives
          ? "Directly lowers finish-control difficulty and helps pull the concept back toward more reliable spray execution."
          : "Reduces finish-control overhead while keeping the concept closer to beginner-friendly spray conditions.",
    }));

  const beginnerAlternatives = [
    preferPracticalAlternatives
      ? {
          type: "workflow" as const,
          label: "Rebuild this concept as a practical-first variant",
          value: "practical-first-variant",
          rationale:
            "The current combination is visually strong but operationally demanding; a practical-first pass would reduce masking strain and finish risk before final polish.",
        }
      : null,
    concept.weatheringLevel === "heavy"
      ? {
          type: "workflow" as const,
          label: "Drop weathering from Heavy to Light",
          value: "light-weathering",
          rationale:
            "Reduces post-decal finishing, abrasion, and sealing steps without fully flattening the concept.",
        }
      : null,
    stylePreset?.contrastLevel === "high"
      ? {
          type: "workflow" as const,
          label: "Use fewer high-contrast separations",
          value: "lower-contrast-blocking",
          rationale:
            "A slightly calmer contrast stack reduces masking pressure while preserving the overall silhouette logic.",
        }
      : null,
    paintPlan.entries.length > 5
      ? {
          type: "workflow" as const,
          label: "Merge minor accent roles into one spray pass",
          value: "merge-accent-roles",
          rationale:
            "Grouping smaller accent zones into one pass keeps the layer count and touch-up overhead down.",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const sourcingAlternatives =
    shopping === null
      ? []
      : shopping.alternateItems.slice(0, 3).map((item) => ({
          type: "sourcing" as const,
          label: `${item.brand} ${item.code}`,
          value: item.mappingKey,
          rationale: item.affiliateUrl
            ? "A backup sourcing path is already attached here, which can help if the main purchase list is harder to fulfill."
            : "This alternate paint keeps the role coverage intact while giving you another sourcing path if the primary item is unavailable.",
        }));

  return {
    conceptId: concept._id,
    conceptTitle: concept.title,
    feasibilityBias:
      feasibility === null
        ? "balanced"
        : preferPracticalAlternatives
          ? "practical"
          : "balanced",
    currentStyle: stylePreset
      ? {
          name: stylePreset.name,
          slug: stylePreset.slug,
          category: stylePreset.category,
          contrastLevel: stylePreset.contrastLevel,
        }
      : null,
    currentMaterial: materialPreset
      ? {
          name: materialPreset.name,
          slug: materialPreset.slug,
          difficultyLevel: materialPreset.difficultyLevel,
          finishType: materialPreset.finishType,
        }
      : null,
    alternativeStyles: attachFeedback(alternativeStyles, feedback, "style"),
    easierMaterials: attachFeedback(easierMaterials, feedback, "material"),
    beginnerAlternatives: attachFeedback(beginnerAlternatives, feedback, "workflow"),
    sourcingAlternatives: attachFeedback(sourcingAlternatives, feedback, "sourcing"),
  };
}

function attachFeedback(
  items: Array<{
    type: RecommendationType;
    label: string;
    value: string;
    rationale: string;
  }>,
  feedback: Array<{
    recommendationType: string;
    recommendationValue: string;
    kind: RecommendationFeedbackKind;
  }>,
  type: RecommendationType
) {
  return items.map((item) => {
    const itemFeedback = feedback.filter(
      (entry) =>
        entry.recommendationType === type &&
        entry.recommendationValue === item.value
    );

    return {
      ...item,
      feedback: {
        helpful: itemFeedback.some((entry) => entry.kind === "helpful"),
        notHelpful: itemFeedback.some((entry) => entry.kind === "not-helpful"),
        try: itemFeedback.some((entry) => entry.kind === "try"),
      },
    };
  });
}
