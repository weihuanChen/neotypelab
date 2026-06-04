import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { buildPaintPlan } from "./paintMappingEngine";
import { query } from "./functions";
import { QueryCtx } from "./types";

type FeasibilityLevel = "easy" | "moderate" | "advanced";

type FeasibilitySignal = {
  label: string;
  impact: number;
  note: string;
};

type FeasibilitySnapshot = {
  summary: string;
  beginnerDifficulty: FeasibilityLevel;
  maskingComplexity: number;
  estimatedLayerCount: number;
  paintCostBand: "low" | "medium" | "high";
  surfaceCompatibility: "forgiving" | "balanced" | "sensitive";
  signals: FeasibilitySignal[];
  sprayNotes: string[];
};

export const getPublicConceptFeasibility = query({
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

    return await buildFeasibilitySnapshot(ctx, concept);
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

        const snapshot = await buildFeasibilitySnapshot(ctx, concept);
        if (snapshot === null) {
          return null;
        }

        return {
          conceptId,
          ...snapshot,
        };
      })
    );

    return results.filter((result): result is NonNullable<typeof result> => result !== null);
  },
});

export const getViewerConceptFeasibility = query({
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

    return await buildFeasibilitySnapshot(ctx, concept);
  },
});

async function buildFeasibilitySnapshot(
  ctx: QueryCtx,
  concept: Doc<"concepts">
): Promise<FeasibilitySnapshot | null> {
  const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings] = await Promise.all([
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
    ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
    ctx.db.query("paintMappings").collect(),
  ]);

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

  const signals: FeasibilitySignal[] = [];

  const complexityLevel = baseModel?.complexityLevel ?? "medium";
  if (complexityLevel === "high") {
    signals.push({
      label: "Complexity",
      impact: 18,
      note: "High part count and silhouette complexity will slow masking and touch-up work.",
    });
  } else if (complexityLevel === "medium") {
    signals.push({
      label: "Complexity",
      impact: 10,
      note: "Moderate part separation should stay manageable with a staged masking plan.",
    });
  } else {
    signals.push({
      label: "Complexity",
      impact: 4,
      note: "The underlying silhouette is relatively forgiving for first-pass spray workflows.",
    });
  }

  const materialDifficulty = materialPreset?.difficultyLevel ?? "medium";
  if (materialDifficulty === "hard") {
    signals.push({
      label: "Finish difficulty",
      impact: 18,
      note: "This finish demands tighter prep, cleaner passes, and more careful top-coat control.",
    });
  } else if (materialDifficulty === "medium") {
    signals.push({
      label: "Finish difficulty",
      impact: 10,
      note: "The selected finish is realistic, but still needs controlled layering and cleanup.",
    });
  } else {
    signals.push({
      label: "Finish difficulty",
      impact: 4,
      note: "This finish is relatively approachable for a clean hobby spray workflow.",
    });
  }

  if (concept.weatheringLevel === "heavy") {
    signals.push({
      label: "Weathering load",
      impact: 18,
      note: "Heavy weathering adds extra abrasion, sealing, and post-decal finishing steps.",
    });
  } else if (concept.weatheringLevel === "light") {
    signals.push({
      label: "Weathering load",
      impact: 8,
      note: "Light weathering adds a manageable finishing pass without fully changing the workflow.",
    });
  } else {
    signals.push({
      label: "Weathering load",
      impact: 2,
      note: "Clean builds reduce finishing complexity and keep the main spray sequence straightforward.",
    });
  }

  if ((concept.moodTags ?? []).includes("industrial-hazard")) {
    signals.push({
      label: "Accent masking",
      impact: 10,
      note: "Hazard striping and caution accents usually increase tape work and cleanup precision.",
    });
  }

  if ((concept.moodTags ?? []).includes("reactor-glow")) {
    signals.push({
      label: "Highlight control",
      impact: 8,
      note: "Localized glow accents need cleaner separation to avoid overpowering nearby armor panels.",
    });
  }

  if (stylePreset?.contrastLevel === "high") {
    signals.push({
      label: "Contrast separation",
      impact: 12,
      note: "High-contrast style stacks demand more disciplined color blocking and edge cleanup.",
    });
  } else if (stylePreset?.contrastLevel === "medium") {
    signals.push({
      label: "Contrast separation",
      impact: 6,
      note: "Moderate contrast keeps the palette readable without fully maximizing masking complexity.",
    });
  }

  const maskingComplexity = Math.min(
    100,
    signals.reduce((sum, signal) => sum + signal.impact, 0)
  );
  const layerCount = estimateLayerCount({
    paintPlanEntryCount: paintPlan.entries.length,
    weatheringLevel: concept.weatheringLevel,
    contrastLevel: stylePreset?.contrastLevel,
    materialDifficulty,
  });
  const paintCostBand = estimatePaintCostBand(layerCount, paintPlan.entries.length);
  const beginnerDifficulty = scoreToLevel(maskingComplexity);
  const surfaceCompatibility = estimateSurfaceCompatibility(materialPreset?.finishType);

  const summary =
    beginnerDifficulty === "easy"
      ? "This concept looks spray-friendly for a careful hobby workflow."
      : beginnerDifficulty === "moderate"
        ? "This concept is achievable, but benefits from staged masking and disciplined finish control."
        : "This concept is visually strong, but the full spray workflow is better suited to an experienced builder.";

  return {
    summary,
    beginnerDifficulty,
    maskingComplexity,
    estimatedLayerCount: layerCount,
    paintCostBand,
    surfaceCompatibility,
    signals,
    sprayNotes: paintPlan.sprayNotes,
  };
}

export async function buildFeasibilitySnapshotForSignals(
  ctx: QueryCtx,
  concept: Doc<"concepts">
) {
  return await buildFeasibilitySnapshot(ctx, concept);
}

function estimateLayerCount(input: {
  paintPlanEntryCount: number;
  weatheringLevel: "clean" | "light" | "heavy";
  contrastLevel?: string;
  materialDifficulty: string;
}) {
  let count = 3;

  count += Math.max(0, Math.ceil(input.paintPlanEntryCount / 2) - 1);

  if (input.contrastLevel === "high") {
    count += 1;
  }
  if (input.materialDifficulty === "hard") {
    count += 1;
  }
  if (input.weatheringLevel === "light") {
    count += 1;
  }
  if (input.weatheringLevel === "heavy") {
    count += 2;
  }

  return count;
}

function estimatePaintCostBand(layerCount: number, paintPlanEntryCount: number) {
  const complexity = layerCount + paintPlanEntryCount;
  if (complexity >= 12) {
    return "high";
  }
  if (complexity >= 8) {
    return "medium";
  }
  return "low";
}

function scoreToLevel(score: number): FeasibilityLevel {
  if (score >= 55) {
    return "advanced";
  }
  if (score >= 28) {
    return "moderate";
  }
  return "easy";
}

function estimateSurfaceCompatibility(finishType?: string) {
  if (finishType === "metallic" || finishType === "ceramic") {
    return "sensitive";
  }
  if (finishType === "semi-gloss") {
    return "balanced";
  }
  return "forgiving";
}
