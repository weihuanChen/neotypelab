import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { buildPaintPlan } from "./paintMappingEngine";
import { MoodTag, vMoodTag, vWeatheringLevel } from "./domain";
import { mutation } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { buildModelPromptContext } from "./modelPromptContext";
import { MutationCtx } from "./types";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";

const MAX_NOTES_LENGTH = 100;
type RenderMode =
  | "hd-render"
  | "multi-angle-preview"
  | "high-fidelity-render"
  | "build-stage-visualization"
  | "weathering-simulation"
  | "weathering-split-preview"
  | "material-finish-comparison";
type SimulationStage = "primer-pass" | "decal-pass" | "weathering-pass";
type MaterialComparisonVariant = {
  id: Id<"materialPresets">;
  name: string;
  slug: string;
  finishType: string;
  reflectivityLevel?: string;
  paintFinish?: string;
  difficultyLevel?: string;
  sheenLevel?: string;
  promptKeywords: string[];
  role: "current" | "comparison";
};

export const generateStyleSuggestion = mutation({
  args: {
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    moodTags: v.optional(v.array(vMoodTag)),
    notes: v.optional(v.string()),
  },
  async handler(ctx, { baseModelId, kitVariantId, moodTags, notes }) {
    const viewer = ctx.viewerX();
    const sanitizedNotes = sanitizeNotes(notes);
    const sanitizedMoodTags = Array.from(new Set(moodTags ?? []));
    const selectedKitVariantId = kitVariantId ?? baseModelId;

    const [baseModel, stylePresets, account, priceRule] = await Promise.all([
      selectedKitVariantId ? ctx.db.get(selectedKitVariantId) : null,
      ctx.db.query("stylePresets").collect(),
      ctx.db
        .query("creditAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", viewer._id))
        .unique(),
      ctx.db
        .query("creditPriceRules")
        .withIndex("by_actionType", (q) => q.eq("actionType", "generate-style-suggestion"))
        .collect()
        .then((items) => items.find((item) => item.isActive) ?? null),
    ]);

    if (baseModel === null || !isPublicModelCatalogRecord(baseModel)) {
      throw new Error("Selected kit variant is unavailable");
    }
    if (account === null) {
      throw new Error("Credit account is not initialized");
    }
    if (priceRule === null) {
      throw new Error("No active price rule is configured for style suggestions");
    }
    if (account.balance < priceRule.creditCost) {
      throw new Error(
        `Insufficient credits. ${priceRule.creditCost} credits required, ${account.balance} available.`
      );
    }

    const template = await getStyleSuggestionTemplate(ctx);
    if (template === null) {
      throw new Error("No active style suggestion template is configured");
    }

    const activeStylePresets = stylePresets.filter((preset) => preset.isActive);
    if (activeStylePresets.length === 0) {
      throw new Error("No active Style DNA presets are available");
    }

    const modelPromptContext = await buildModelPromptContext(ctx, baseModel);
    const suggestions = buildStyleSuggestions({
      baseModel: {
        name: baseModel.name,
        slug: baseModel.slug,
        silhouetteType: baseModel.silhouetteType,
        tags: baseModel.tags,
        baseUnit: modelPromptContext.snapshot.baseUnit,
      },
      moodTags: sanitizedMoodTags,
      notes: sanitizedNotes,
      stylePresets: activeStylePresets,
    });

    const promptPreview = composePrompt(template.userPromptTemplate, {
      availableStyles: activeStylePresets.map((preset) => preset.name).join(", "),
      baseModel: modelPromptContext.promptText,
      mood: formatMoodTags(sanitizedMoodTags),
      notes: sanitizedNotes ?? "No extra notes.",
      topSuggestions: suggestions.map((item) => item.name).join(", "),
    });

    const promptCompositionId = await ctx.db.insert("promptCompositions", {
      userId: viewer._id,
      promptTemplateId: template._id,
      promptTemplateVersionId: template.promptTemplateVersionId,
      status: "consumed",
      composedPrompt: promptPreview,
      negativePrompt: template.negativePromptTemplate,
      additionalNotes: sanitizedNotes,
      inputSnapshotJson: JSON.stringify({
        baseModel: modelPromptContext.snapshot,
        moodTags: sanitizedMoodTags,
        notes: sanitizedNotes,
      }),
      outputSummaryJson: JSON.stringify({
        tool: "style-suggestion",
        template: template.name,
        templateVersion: template.version,
        suggestions,
      }),
    });

    const balanceAfter = await debitCredits({
      ctx,
      accountId: account._id,
      currentBalance: account.balance,
      currentLifetimeSpent: account.lifetimeSpent,
      userId: viewer._id,
      actionType: "generate-style-suggestion",
      creditAmount: priceRule.creditCost,
      referenceTable: "promptCompositions",
      referenceId: promptCompositionId,
      description: `Generated style suggestion for ${baseModel.name}`,
    });

    return {
      promptCompositionId,
      balanceAfter,
      promptPreview,
      templateName: template.name,
      suggestions,
      priceRule: {
        actionType: priceRule.actionType,
        label: priceRule.label,
        creditCost: priceRule.creditCost,
      },
    };
  },
});

export const generatePalettePlan = mutation({
  args: {
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.id("stylePresets"),
    materialPresetId: v.id("materialPresets"),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: vWeatheringLevel,
    notes: v.optional(v.string()),
  },
  async handler(
    ctx,
    { baseModelId, kitVariantId, stylePresetId, materialPresetId, moodTags, weatheringLevel, notes }
  ) {
    const viewer = ctx.viewerX();
    const sanitizedNotes = sanitizeNotes(notes);
    const sanitizedMoodTags = Array.from(new Set(moodTags ?? []));
    const selectedKitVariantId = kitVariantId ?? baseModelId;

    const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings, account, priceRule] =
      await Promise.all([
        selectedKitVariantId ? ctx.db.get(selectedKitVariantId) : null,
        ctx.db.get(stylePresetId),
        ctx.db.get(materialPresetId),
        ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
        ctx.db.query("paintMappings").collect(),
        ctx.db
          .query("creditAccounts")
          .withIndex("by_userId", (q) => q.eq("userId", viewer._id))
          .unique(),
        ctx.db
          .query("creditPriceRules")
          .withIndex("by_actionType", (q) => q.eq("actionType", "generate-palette"))
          .collect()
          .then((items) => items.find((item) => item.isActive) ?? null),
      ]);

    if (baseModel === null || !isPublicModelCatalogRecord(baseModel)) {
      throw new Error("Selected kit variant is unavailable");
    }
    if (stylePreset === null || !stylePreset.isActive) {
      throw new Error("Selected Style DNA preset is unavailable");
    }
    if (materialPreset === null || !materialPreset.isActive) {
      throw new Error("Selected material preset is unavailable");
    }
    if (account === null) {
      throw new Error("Credit account is not initialized");
    }
    if (priceRule === null) {
      throw new Error("No active price rule is configured for palette plans");
    }
    if (account.balance < priceRule.creditCost) {
      throw new Error(
        `Insufficient credits. ${priceRule.creditCost} credits required, ${account.balance} available.`
      );
    }

    const template = await getPalettePlanTemplate(ctx);
    if (template === null) {
      throw new Error("No active palette plan template is configured");
    }

    const plan = buildPaintPlan({
      conceptTitle: `${baseModel.name} / ${stylePreset.name} palette plan`,
      baseModelName: baseModel.name,
      stylePresetName: stylePreset.name,
      styleSlug: stylePreset.slug,
      materialPresetName: materialPreset.name,
      materialSlug: materialPreset.slug,
      moodTags: sanitizedMoodTags,
      weatheringLevel,
      colorRoles,
      paintMappings,
    });
    const colorRoleNames = colorRoles.map((role) => role.name).join(", ");
    const modelPromptContext = await buildModelPromptContext(ctx, baseModel);
    const promptPreview = composePrompt(template.userPromptTemplate, {
      baseModel: modelPromptContext.promptText,
      colorRoles: colorRoleNames,
      materialPreset: materialPreset.name,
      mood: formatMoodTags(sanitizedMoodTags),
      notes: sanitizedNotes ?? "No extra notes.",
      stylePreset: stylePreset.name,
      weatheringLevel,
    });

    const promptCompositionId = await ctx.db.insert("promptCompositions", {
      userId: viewer._id,
      promptTemplateId: template._id,
      promptTemplateVersionId: template.promptTemplateVersionId,
      status: "consumed",
      composedPrompt: promptPreview,
      negativePrompt: template.negativePromptTemplate,
      additionalNotes: sanitizedNotes,
      inputSnapshotJson: JSON.stringify({
        baseModel: modelPromptContext.snapshot,
        stylePreset: {
          id: stylePreset._id,
          name: stylePreset.name,
          slug: stylePreset.slug,
        },
        materialPreset: {
          id: materialPreset._id,
          name: materialPreset.name,
          slug: materialPreset.slug,
        },
        moodTags: sanitizedMoodTags,
        notes: sanitizedNotes,
        weatheringLevel,
      }),
      outputSummaryJson: JSON.stringify({
        tool: "palette-plan",
        template: template.name,
        templateVersion: template.version,
        plan,
      }),
    });

    const balanceAfter = await debitCredits({
      ctx,
      accountId: account._id,
      currentBalance: account.balance,
      currentLifetimeSpent: account.lifetimeSpent,
      userId: viewer._id,
      actionType: "generate-palette",
      creditAmount: priceRule.creditCost,
      referenceTable: "promptCompositions",
      referenceId: promptCompositionId,
      description: `Generated palette plan for ${baseModel.name} / ${stylePreset.name}`,
    });

    return {
      promptCompositionId,
      balanceAfter,
      promptPreview,
      templateName: template.name,
      plan,
      priceRule: {
        actionType: priceRule.actionType,
        label: priceRule.label,
        creditCost: priceRule.creditCost,
      },
    };
  },
});

export const requestHdRender = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "hd-render");
  },
});

export const requestMultiAnglePreview = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "multi-angle-preview");
  },
});

export const requestHighFidelityRender = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "high-fidelity-render");
  },
});

export const requestWeatheringSimulation = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "weathering-simulation");
  },
});

export const requestWeatheringSplitPreview = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "weathering-split-preview");
  },
});

export const requestMaterialFinishComparison = mutation({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    return await queueConceptRender(ctx, conceptId, "material-finish-comparison");
  },
});

export const requestBuildStageVisualization = mutation({
  args: {
    conceptId: v.id("concepts"),
    stage: v.union(
      v.literal("primer-pass"),
      v.literal("decal-pass"),
      v.literal("weathering-pass")
    ),
  },
  async handler(ctx, { conceptId, stage }) {
    return await queueConceptRender(ctx, conceptId, "build-stage-visualization", stage);
  },
});

async function getStyleSuggestionTemplate(ctx: MutationCtx) {
  const activeTemplate = await resolvePipelineTemplate(ctx, "style-suggestion");
  if (activeTemplate) {
    return activeTemplate;
  }

  const existingDefault = await ctx.db
    .query("promptTemplates")
    .withIndex("by_slug", (q) => q.eq("slug", "style-suggestion-template"))
    .unique();
  if (existingDefault) {
    return null;
  }

  const templateId = await ctx.db.insert("promptTemplates", {
    name: "Style Suggestion Template",
    slug: "style-suggestion-template",
    kind: "style-suggestion",
    version: "p1.v1",
    systemPrompt:
      "Recommend the most defensible Style DNA presets for the selected mecha platform using mood, silhouette, and paintability logic.",
    userPromptTemplate:
      "Base model: {{baseModel}}\nMood Vector: {{mood}}\nOperator notes: {{notes}}\nAvailable Style DNA presets: {{availableStyles}}\nReturn the strongest matching presets in order of fit.",
    negativePromptTemplate:
      "generic ai art language, vague trend buzzwords, rainbow styling, cinematic poster bias",
    notePolicy: "Notes should refine intent, not replace the structured selector system.",
    isActive: true,
  });
  const created = await ctx.db.get(templateId);
  return created ? { ...created, promptTemplateVersionId: undefined } : null;
}

async function getPalettePlanTemplate(ctx: MutationCtx) {
  return await resolvePipelineTemplate(ctx, "palette-plan");
}

async function queueConceptRender(
  ctx: MutationCtx,
  conceptId: Id<"concepts">,
  renderMode: RenderMode,
  simulationStage?: SimulationStage
) {
  const viewer = ctx.viewerX();
  await assertGenerationCapacity(ctx, viewer._id);
  const concept = await ctx.db.get(conceptId);
  if (concept === null || concept.userId !== viewer._id) {
    throw new Error("Concept not found");
  }
  if (concept.status !== "generated" && concept.status !== "archived") {
    throw new Error("Advanced renders can only run after a concept preview has been generated");
  }

  const [
    baseModel,
    stylePreset,
    materialPreset,
    materialPresets,
    colorRoles,
    paintMappings,
    account,
    template,
    priceRule,
  ] =
    await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      ctx.db.query("paintMappings").collect(),
      ctx.db
        .query("creditAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", viewer._id))
        .unique(),
      resolvePipelineTemplate(ctx, "hd-render"),
      ctx.db
        .query("creditPriceRules")
        .withIndex("by_actionType", (q) => q.eq("actionType", getRenderActionType(renderMode)))
        .collect()
        .then((items) => items.find((item) => item.isActive) ?? null),
    ]);

  if (baseModel === null || stylePreset === null || materialPreset === null) {
    throw new Error("Concept is missing its base model, Style DNA, or material profile");
  }
  if (account === null) {
    throw new Error("Credit account is not initialized");
  }
  if (template === null) {
    throw new Error("No active HD render template is configured");
  }
  if (priceRule === null) {
    throw new Error(`No active price rule is configured for ${getRenderLabel(renderMode)}`);
  }
  if (account.balance < priceRule.creditCost) {
    throw new Error(
      `Insufficient credits. ${priceRule.creditCost} credits required, ${account.balance} available.`
    );
  }

  const plan = buildPaintPlan({
    conceptId: concept._id,
    conceptTitle: concept.title,
    baseModelName: baseModel.name,
    stylePresetName: stylePreset.name,
    styleSlug: stylePreset.slug,
    materialPresetName: materialPreset.name,
    materialSlug: materialPreset.slug,
    moodTags: concept.moodTags ?? [],
    weatheringLevel: concept.weatheringLevel,
    colorRoles,
    paintMappings,
  });
  const materialComparisonVariants = selectMaterialComparisonVariants(
    materialPreset,
    materialPresets,
    stylePreset.recommendedMaterialSlugs
  );
  const materialComparisonSummary = formatMaterialComparisonVariants(materialComparisonVariants);
  const modelPromptContext = await buildModelPromptContext(ctx, baseModel);

  const promptPreview = composePrompt(template.userPromptTemplate, {
    baseModel: modelPromptContext.promptText,
    conceptId: concept._id,
    materialPreset: materialPreset.name,
    mood: formatMoodTags(concept.moodTags ?? []),
    notes: concept.notes ?? "No extra notes.",
    stylePreset: stylePreset.name,
    topPalette:
      plan.entries
        .slice(0, 4)
        .map((entry) =>
          entry.suggestedPaint
            ? `${entry.roleName}: ${entry.suggestedPaint.brand} ${entry.suggestedPaint.code}`
            : `${entry.roleName}: no active mapping`
        )
        .join(" | ") || "No paint mapping available.",
    weatheringLevel: concept.weatheringLevel,
  });
  const promptPreviewWithFallback = appendPromptFallbackLines(
    promptPreview,
    template.userPromptTemplate,
    {
      stylePreset: `Style DNA: ${stylePreset.name}`,
      mood: `Mood Vector: ${formatMoodTags(concept.moodTags ?? [])}`,
      weatheringLevel: `Weathering: ${concept.weatheringLevel}`,
      simulationStage: simulationStage
        ? `Simulation Stage: ${getBuildStageLabel(simulationStage)}`
        : "",
      topPalette: `Palette Lock: ${
        plan.entries
          .slice(0, 4)
          .map((entry) =>
            entry.suggestedPaint
              ? `${entry.roleName} ${entry.suggestedPaint.code}`
              : `${entry.roleName} unmapped`
          )
          .join(" | ") || "No paint mapping available."
      }`,
      notes: `Operator notes: ${concept.notes ?? "No extra notes."}`,
      renderMode: `Render Mode: ${getRenderLabel(renderMode)}`,
      renderDirective: `Render Directive: ${getRenderDirective(renderMode, simulationStage)}`,
      layoutSpec: `Layout Spec: ${getRenderLayoutSpec(renderMode)}`,
      materialComparison:
        renderMode === "material-finish-comparison"
          ? `Material Comparison Set: ${materialComparisonSummary}`
          : "",
    }
  );

  const promptCompositionId = await ctx.db.insert("promptCompositions", {
    userId: viewer._id,
    conceptId: concept._id,
    promptTemplateId: template._id,
    promptTemplateVersionId: template.promptTemplateVersionId,
    status: "ready",
    composedPrompt: promptPreviewWithFallback,
    negativePrompt: template.negativePromptTemplate,
    additionalNotes: concept.notes,
    inputSnapshotJson: JSON.stringify({
      sourceConceptId: concept._id,
      baseModel: modelPromptContext.snapshot,
      stylePreset: {
        id: stylePreset._id,
        name: stylePreset.name,
        slug: stylePreset.slug,
      },
      materialPreset: {
        id: materialPreset._id,
        name: materialPreset.name,
        slug: materialPreset.slug,
      },
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      paintPlan: plan,
      renderMode,
      simulationStage,
      renderDirective: getRenderDirective(renderMode, simulationStage),
      layoutSpec: getRenderLayoutSpec(renderMode),
      materialComparisonVariants:
        renderMode === "material-finish-comparison" ? materialComparisonVariants : undefined,
    }),
    outputSummaryJson: JSON.stringify({
      template: template.name,
      templateVersion: template.version,
      sourceConceptId: concept._id,
      tool: renderMode,
      layoutSpec: getRenderLayoutSpec(renderMode),
      materialComparisonVariants:
        renderMode === "material-finish-comparison" ? materialComparisonVariants : undefined,
    }),
  });

  const generationJobId = await ctx.db.insert("generationJobs", {
    userId: viewer._id,
    kind: "hd-preview",
    status: "queued",
    baseModelId: baseModel._id,
    stylePresetId: stylePreset._id,
    materialPresetId: materialPreset._id,
    conceptId: concept._id,
    requestedCredits: priceRule.creditCost,
    promptCompositionId,
    provider: "internal",
    inputSnapshotJson: JSON.stringify({
      sourceConceptId: concept._id,
      requestedAt: Date.now(),
      renderMode,
      simulationStage,
      layoutSpec: getRenderLayoutSpec(renderMode),
      materialComparisonVariants:
        renderMode === "material-finish-comparison" ? materialComparisonVariants : undefined,
    }),
    outputSummaryJson: JSON.stringify({
      phase: "queued",
      label: getQueuedRenderLabel(renderMode, simulationStage),
      generationKind: "hd-preview",
      renderMode,
      simulationStage,
      layoutSpec: getRenderLayoutSpec(renderMode),
      materialComparisonVariants:
        renderMode === "material-finish-comparison" ? materialComparisonVariants : undefined,
    }),
  });

  await ctx.db.patch(concept._id, {
    generationJobId,
  });
  await ctx.db.patch(promptCompositionId, {
    generationJobId,
  });

  const balanceAfter = await debitCredits({
    ctx,
    accountId: account._id,
    currentBalance: account.balance,
    currentLifetimeSpent: account.lifetimeSpent,
    userId: viewer._id,
    actionType: getRenderActionType(renderMode),
    creditAmount: priceRule.creditCost,
    referenceTable: "generationJobs",
    referenceId: generationJobId,
    description: `Queued ${getRenderLabel(renderMode).toLowerCase()} for ${concept.title}`,
    generationJobId,
    conceptId: concept._id,
  });

  await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, {
    generationJobId,
  });

  return {
    conceptId: concept._id,
    generationJobId,
    promptCompositionId,
    balanceAfter,
    promptPreview: promptPreviewWithFallback,
    title: concept.title,
    templateName: template.name,
    renderMode,
    simulationStage,
    priceRule: {
      actionType: priceRule.actionType,
      label: priceRule.label,
      creditCost: priceRule.creditCost,
    },
  };
}

function buildStyleSuggestions(input: {
  baseModel: {
    name: string;
    slug: string;
    silhouetteType?: string;
    tags: string[];
    baseUnit: {
      name: string;
      unitCode?: string;
      keyShapeAnchors: string[];
      forbiddenChanges: string[];
    } | null;
  };
  moodTags: MoodTag[];
  notes?: string;
  stylePresets: Array<{
    _id: Id<"stylePresets">;
    name: string;
    slug: string;
    category?: string;
    shortDescription?: string;
    promptKeywords: string[];
    seoKeywords: string[];
    visibilityWeight?: number;
    weatheringProfile?: string;
  }>;
}) {
  const notes = (input.notes ?? "").toLowerCase();

  return input.stylePresets
    .map((preset) => {
      let score = Math.round((preset.visibilityWeight ?? 0.5) * 10);
      const reasons: string[] = [];

      for (const moodTag of input.moodTags) {
        const moodScore = getMoodStyleScore(moodTag, preset.slug);
        if (moodScore > 0) {
          score += moodScore;
          reasons.push(getMoodReason(moodTag, preset.name));
        }
      }

      for (const tag of input.baseModel.tags) {
        const tagScore = getBaseModelTagScore(tag, preset.slug);
        if (tagScore > 0) {
          score += tagScore;
          reasons.push(getBaseModelReason(tag, input.baseModel.name, preset.name));
        }
      }

      const silhouetteScore = getSilhouetteScore(input.baseModel.silhouetteType, preset.slug);
      if (silhouetteScore > 0) {
        score += silhouetteScore;
        reasons.push(
          `${input.baseModel.silhouetteType ?? "Selected silhouette"} aligns with ${preset.name}'s contrast envelope.`
        );
      }

      if (input.baseModel.baseUnit?.keyShapeAnchors.length) {
        score += 1;
        reasons.push(
          `${preset.name} can preserve ${input.baseModel.baseUnit.keyShapeAnchors
            .slice(0, 3)
            .join(", ")} while changing the paint language.`
        );
      }
      if (input.baseModel.baseUnit?.forbiddenChanges.length) {
        reasons.push(
          `Keep ${input.baseModel.baseUnit.name}'s silhouette intact and avoid ${input.baseModel.baseUnit.forbiddenChanges
            .slice(0, 2)
            .join(", ")}.`
        );
      }
      if (preset.promptKeywords.some((keyword) => notes.includes(keyword.toLowerCase()))) {
        score += 2;
        reasons.push("Operator notes overlap with this preset's governed prompt vocabulary.");
      }

      if (preset.seoKeywords.some((keyword) => notes.includes(keyword.toLowerCase()))) {
        score += 1;
      }

      if (input.moodTags.includes("field-fatigue") && preset.weatheringProfile === "heavy") {
        score += 3;
        reasons.push("Heavy weathering profile matches the requested field-fatigue direction.");
      }

      return {
        stylePresetId: preset._id,
        name: preset.name,
        slug: preset.slug,
        category: preset.category,
        shortDescription: preset.shortDescription,
        score,
        confidenceLabel: score >= 20 ? "high" : score >= 14 ? "medium" : "experimental",
        rationale: uniqueReasons(reasons).slice(0, 3).join(" "),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3);
}

function getMoodStyleScore(moodTag: MoodTag, styleSlug: string) {
  const scoreMap: Record<MoodTag, Record<string, number>> = {
    "command-presence": {
      "eva-inspired": 4,
      "military-prototype": 3,
      "industrial-mecha": 2,
    },
    "stealth-tension": {
      "stealth-black": 5,
      "industrial-mecha": 2,
      "military-prototype": 2,
    },
    "industrial-hazard": {
      "industrial-mecha": 5,
      "military-prototype": 4,
      "desert-ops": 2,
    },
    "reactor-glow": {
      "eva-inspired": 5,
      "industrial-mecha": 2,
      "stealth-black": 1,
    },
    "field-fatigue": {
      "desert-ops": 5,
      "military-prototype": 4,
      "industrial-mecha": 2,
    },
    "ceremonial-clean": {
      "eva-inspired": 4,
      "stealth-black": 3,
      "military-prototype": 2,
    },
  };

  return scoreMap[moodTag][styleSlug] ?? 0;
}

function getMoodReason(moodTag: MoodTag, presetName: string) {
  if (moodTag === "command-presence") {
    return `${presetName} keeps the silhouette authoritative without collapsing armor readability.`;
  }
  if (moodTag === "stealth-tension") {
    return `${presetName} supports a lower-signature armor stack with controlled contrast.`;
  }
  if (moodTag === "industrial-hazard") {
    return `${presetName} matches hazard-striping, maintenance-deck, and workshop-terminal language.`;
  }
  if (moodTag === "reactor-glow") {
    return `${presetName} leaves room for localized reactor accents without flooding the frame.`;
  }
  if (moodTag === "field-fatigue") {
    return `${presetName} tolerates dust, abrasion, and operational grime in a believable way.`;
  }
  return `${presetName} favors inspection-grade discipline and cleaner panel presentation.`;
}

function getBaseModelTagScore(tag: string, styleSlug: string) {
  const normalizedTag = tag.toLowerCase();
  if (normalizedTag === "hero") {
    return styleSlug === "eva-inspired" ? 4 : styleSlug === "military-prototype" ? 2 : 0;
  }
  if (normalizedTag === "heavy") {
    return styleSlug === "industrial-mecha" ? 4 : styleSlug === "desert-ops" ? 3 : 0;
  }
  if (normalizedTag === "experimental" || normalizedTag === "organic") {
    return styleSlug === "eva-inspired" ? 4 : styleSlug === "stealth-black" ? 2 : 0;
  }
  if (normalizedTag === "frame" || normalizedTag === "melee") {
    return styleSlug === "military-prototype" ? 3 : styleSlug === "industrial-mecha" ? 2 : 0;
  }
  return 0;
}

function getBaseModelReason(tag: string, baseModelName: string, presetName: string) {
  return `${baseModelName}'s ${tag} bias maps cleanly onto ${presetName}'s governed Style DNA profile.`;
}

function getSilhouetteScore(silhouetteType: string | undefined, styleSlug: string) {
  if (!silhouetteType) {
    return 0;
  }
  if (silhouetteType.includes("hero") && styleSlug === "eva-inspired") {
    return 2;
  }
  if (silhouetteType.includes("heavy") && styleSlug === "industrial-mecha") {
    return 2;
  }
  if (silhouetteType.includes("agile") && styleSlug === "stealth-black") {
    return 2;
  }
  return 0;
}

async function debitCredits(input: {
  ctx: MutationCtx;
  accountId: Id<"creditAccounts">;
  currentBalance: number;
  currentLifetimeSpent: number;
  userId: Id<"users">;
  actionType:
    | "generate-palette"
    | "generate-style-suggestion"
    | "generate-hd-render"
    | "generate-multi-angle-preview"
    | "generate-high-fidelity-render";
  creditAmount: number;
  referenceTable: string;
  referenceId: string;
  description: string;
  generationJobId?: Id<"generationJobs">;
  conceptId?: Id<"concepts">;
}) {
  const balanceAfter = input.currentBalance - input.creditAmount;
  await input.ctx.db.patch(input.accountId, {
    balance: balanceAfter,
    lifetimeSpent: input.currentLifetimeSpent + input.creditAmount,
    lastCreditEventAt: Date.now(),
  });
  await input.ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: input.actionType,
    delta: -input.creditAmount,
    creditAmount: input.creditAmount,
    balanceAfter,
    generationJobId: input.generationJobId,
    conceptId: input.conceptId,
    referenceTable: input.referenceTable,
    referenceId: input.referenceId,
    description: input.description,
  });
  return balanceAfter;
}

function sanitizeNotes(notes?: string) {
  const sanitizedNotes = notes?.trim() || undefined;
  if (sanitizedNotes !== undefined && sanitizedNotes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Additional notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return sanitizedNotes;
}

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function composePrompt(template: string, values: Record<string, string>) {
  const prompt = applyTemplate(template, values);
  if (template.includes("{{mood}}")) {
    return prompt;
  }

  const mood = values.mood?.trim();
  return mood ? `${prompt}\nMood Vector: ${mood}` : prompt;
}

function appendPromptFallbackLines(
  prompt: string,
  template: string,
  fallbackLines: Record<string, string>
) {
  const missingLines = Object.entries(fallbackLines)
    .filter(([key]) => !template.includes(`{{${key}}}`))
    .map(([, value]) => value)
    .filter((value) => value.trim().length > 0);

  if (missingLines.length === 0) {
    return prompt;
  }

  return `${prompt}\n${missingLines.join("\n")}`;
}

function formatMoodTags(moodTags: MoodTag[]) {
  return moodTags.length > 0 ? moodTags.join(", ") : "No mood vector selected.";
}

function uniqueReasons(reasons: string[]) {
  return Array.from(new Set(reasons));
}

function selectMaterialComparisonVariants(
  currentMaterial: {
    _id: Id<"materialPresets">;
    name: string;
    slug: string;
    finishType: string;
    reflectivityLevel?: string;
    paintFinish?: string;
    difficultyLevel?: string;
    sheenLevel?: string;
    promptKeywords: string[];
  },
  materialPresets: Array<{
    _id: Id<"materialPresets">;
    name: string;
    slug: string;
    finishType: string;
    reflectivityLevel?: string;
    paintFinish?: string;
    difficultyLevel?: string;
    sheenLevel?: string;
    promptKeywords: string[];
    isActive: boolean;
  }>,
  recommendedMaterialSlugs: string[]
): MaterialComparisonVariant[] {
  const variants: MaterialComparisonVariant[] = [
    toMaterialComparisonVariant(currentMaterial, "current"),
  ];
  const seenIds = new Set<string>([currentMaterial._id]);
  const seenFinishTypes = new Set<string>([currentMaterial.finishType]);
  const activeCandidates = materialPresets
    .filter((preset) => preset.isActive)
    .filter((preset) => preset._id !== currentMaterial._id);
  const recommendedCandidates = activeCandidates.filter((preset) =>
    recommendedMaterialSlugs.includes(preset.slug)
  );
  const fallbackCandidates = activeCandidates.filter(
    (preset) => !recommendedMaterialSlugs.includes(preset.slug)
  );

  for (const candidate of [...recommendedCandidates, ...fallbackCandidates]) {
    if (variants.length >= 4 || seenIds.has(candidate._id)) {
      continue;
    }
    if (seenFinishTypes.has(candidate.finishType) && variants.length >= 3) {
      continue;
    }

    variants.push(toMaterialComparisonVariant(candidate, "comparison"));
    seenIds.add(candidate._id);
    seenFinishTypes.add(candidate.finishType);
  }

  return variants;
}

function toMaterialComparisonVariant(
  material: {
    _id: Id<"materialPresets">;
    name: string;
    slug: string;
    finishType: string;
    reflectivityLevel?: string;
    paintFinish?: string;
    difficultyLevel?: string;
    sheenLevel?: string;
    promptKeywords: string[];
  },
  role: "current" | "comparison"
): MaterialComparisonVariant {
  return {
    id: material._id,
    name: material.name,
    slug: material.slug,
    finishType: material.finishType,
    reflectivityLevel: material.reflectivityLevel,
    paintFinish: material.paintFinish,
    difficultyLevel: material.difficultyLevel,
    sheenLevel: material.sheenLevel,
    promptKeywords: material.promptKeywords,
    role,
  };
}

function formatMaterialComparisonVariants(variants: MaterialComparisonVariant[]) {
  return variants
    .map((variant, index) =>
      [
        `${index + 1}. ${variant.role === "current" ? "CURRENT" : "ALT"} ${variant.name}`,
        `finish=${variant.finishType}`,
        variant.reflectivityLevel ? `reflectivity=${variant.reflectivityLevel}` : undefined,
        variant.sheenLevel ? `sheen=${variant.sheenLevel}` : undefined,
        variant.difficultyLevel ? `difficulty=${variant.difficultyLevel}` : undefined,
      ]
        .filter(Boolean)
        .join(" / ")
    )
    .join(" | ");
}

function getRenderActionType(renderMode: RenderMode) {
  if (renderMode === "multi-angle-preview") {
    return "generate-multi-angle-preview" as const;
  }
  if (
    renderMode === "high-fidelity-render" ||
    renderMode === "build-stage-visualization" ||
    renderMode === "weathering-simulation" ||
    renderMode === "weathering-split-preview" ||
    renderMode === "material-finish-comparison"
  ) {
    return "generate-high-fidelity-render" as const;
  }
  return "generate-hd-render" as const;
}

function getRenderLabel(renderMode: RenderMode) {
  if (renderMode === "multi-angle-preview") {
    return "Multi-angle Contact Sheet";
  }
  if (renderMode === "high-fidelity-render") {
    return "High-fidelity Render";
  }
  if (renderMode === "build-stage-visualization") {
    return "Build-stage Visualization";
  }
  if (renderMode === "weathering-simulation") {
    return "Weathering Simulation";
  }
  if (renderMode === "weathering-split-preview") {
    return "Before / After Weathering Split";
  }
  if (renderMode === "material-finish-comparison") {
    return "Material Finish Comparison";
  }
  return "HD Render";
}

function getQueuedRenderLabel(
  renderMode: RenderMode,
  simulationStage?: SimulationStage
) {
  if (renderMode === "multi-angle-preview") {
    return "QUEUED MULTI-ANGLE CONTACT SHEET";
  }
  if (renderMode === "high-fidelity-render") {
    return "QUEUED HIGH-FIDELITY RENDER";
  }
  if (renderMode === "build-stage-visualization") {
    return `QUEUED ${getBuildStageLabel(simulationStage).toUpperCase()} VISUALIZATION`;
  }
  if (renderMode === "weathering-simulation") {
    return "QUEUED WEATHERING SIMULATION";
  }
  if (renderMode === "weathering-split-preview") {
    return "QUEUED BEFORE / AFTER WEATHERING SPLIT";
  }
  if (renderMode === "material-finish-comparison") {
    return "QUEUED MATERIAL FINISH COMPARISON";
  }
  return "QUEUED HD RENDER";
}

function getRenderDirective(renderMode: RenderMode, simulationStage?: SimulationStage) {
  if (renderMode === "multi-angle-preview") {
    return "Produce a labeled 2x2 multi-angle contact sheet with front, side, rear, and three-quarter panels. Keep the approved paint plan consistent across every angle, preserve readable surface mapping, and avoid changing the concept design.";
  }
  if (renderMode === "high-fidelity-render") {
    return "Push the highest material realism, crispest decals, and premium showcase polish without redesigning the palette.";
  }
  if (renderMode === "build-stage-visualization") {
    if (simulationStage === "primer-pass") {
      return "Visualize the concept at primer pass with neutralized coated surfaces, masked subassemblies, and no decals or weathering.";
    }
    if (simulationStage === "decal-pass") {
      return "Visualize the concept immediately after decals and markings are placed, keeping surfaces clean and weathering restrained.";
    }
    if (simulationStage === "weathering-pass") {
      return "Visualize the concept after weathering effects are layered in, including dust, abrasion, chips, and burn marks where appropriate.";
    }
    return "Visualize a specific build stage of the same concept without changing the approved paint plan.";
  }
  if (renderMode === "weathering-simulation") {
    return "Visualize wear, dust, abrasion, chipping, and burn marks without mutating the approved paint plan or base material matching.";
  }
  if (renderMode === "weathering-split-preview") {
    return "Produce a side-by-side before / after weathering split preview. The left panel must show the clean approved paint plan before finishing effects; the right panel must show the same concept after dust, chipping, abrasion, streaking, and burn marks are applied. Keep pose, scale, camera, palette, and base material matching consistent across both panels.";
  }
  if (renderMode === "material-finish-comparison") {
    return "Produce a material finish comparison render using the provided comparison set. Keep base model, camera, pose, Style DNA, palette, weathering level, and color-role mapping identical across panels; only change the material finish interpretation, reflectivity, sheen, and surface response for each panel.";
  }
  return "Upgrade the stabilized concept into a premium single-angle HD preview without changing the paint plan.";
}

function getRenderLayoutSpec(renderMode: RenderMode) {
  if (renderMode === "multi-angle-preview") {
    return "2x2 contact sheet: FRONT, SIDE, REAR, and THREE-QUARTER panels with consistent palette mapping, visible angle labels, and enough spacing for each silhouette to be inspected independently.";
  }
  if (renderMode === "weathering-split-preview") {
    return "horizontal split preview: BEFORE CLEAN BUILD on the left and AFTER WEATHERING PASS on the right, with matching camera, scale, palette, and material interpretation.";
  }
  if (renderMode === "material-finish-comparison") {
    return "2x2 material comparison board: CURRENT FINISH plus up to three alternate material presets, with locked palette, pose, camera, weathering, and color-role mapping.";
  }
  return "single stabilized preview frame";
}

function getBuildStageLabel(stage?: SimulationStage) {
  if (stage === "primer-pass") {
    return "Primer Pass";
  }
  if (stage === "decal-pass") {
    return "Decal Pass";
  }
  if (stage === "weathering-pass") {
    return "Weathering Pass";
  }
  return "Build Stage";
}
