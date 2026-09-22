import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { buildPaintPlan } from "./paintMappingEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import {
  visualPaletteForRender,
  visualPaletteFromLegacyPlan,
  visualPaletteSchema,
  type VisualPalette,
} from "./paintRecommendationEngine";
import { MoodTag } from "./domain";
import { mutation } from "./functions";
import { action } from "./_generated/server";
import { creativeArgs, type CreativeResult } from "./creativePipeline";
import { styleIntentSchema } from "./creativeContracts";
import type { InterpretationResult } from "./styleInterpretations";
import { buildModelPromptContext } from "./modelPromptContext";
import { MutationCtx } from "./types";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";
import { reserveGenerationStorageForJob } from "./storageAccounting";
import { debitCredits } from "./creditLedger";

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

/** Interpret free-form style direction into the shared StyleIntent v1 contract. */
export const interpretCustomStyle = action({
  args: { description: v.string(), requestKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<InterpretationResult> => {
    const id = await ctx.runMutation(internal.styleInterpretations.begin, { description: args.description, requestKey: args.requestKey ?? crypto.randomUUID() });
    const claimed = await ctx.runMutation(internal.styleInterpretations.claim, { promptCompositionId: id });
    if (claimed) {
      try {
        const response = await ctx.runAction(internal.generationNode.executeText, {
          templateKind: "style-suggestion", ...claimed, jsonOutput: true,
        });
        await ctx.runMutation(internal.styleInterpretations.complete, {
          promptCompositionId: id, responseJson: JSON.stringify(response.json), executionJson: JSON.stringify(response),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0].slice(0, 500) : "Style interpretation failed";
        await ctx.runMutation(internal.creativePipeline.fail, { promptCompositionId: id, reason });
        throw new ConvexError(reason);
      }
    }
    return ctx.runQuery(internal.styleInterpretations.result, { promptCompositionId: id });
  },
});

export const generateStyleSuggestion = action({
  args: { ...creativeArgs, requestKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CreativeResult> => {
    const id = await ctx.runMutation(internal.creativePipeline.begin, { ...args, requestKey: args.requestKey ?? crypto.randomUUID(), kind: "style-suggestion" });
    await ctx.runAction(internal.creativeNode.executeComposition, { promptCompositionId: id });
    return ctx.runQuery(internal.creativePipeline.result, { promptCompositionId: id });
  },
});

export const generatePalettePlan = action({
  args: { ...creativeArgs, requestKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CreativeResult & { plan: NonNullable<CreativeResult["plan"]> }> => {
    const id = await ctx.runMutation(internal.creativePipeline.begin, { ...args, requestKey: args.requestKey ?? crypto.randomUUID(), kind: "palette-plan" });
    await ctx.runAction(internal.creativeNode.executeComposition, { promptCompositionId: id });
    const result = await ctx.runQuery(internal.creativePipeline.result, { promptCompositionId: id });
    if (!result.plan) throw new Error("Palette result is missing");
    return { ...result, plan: result.plan };
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

export async function queueConceptRender(
  ctx: MutationCtx,
  conceptId: Id<"concepts">,
  renderMode: RenderMode,
  simulationStage?: SimulationStage,
  prepaid = false
) {
  const viewer = ctx.viewerX();
  await assertGenerationCapacity(ctx, viewer._id);
  const concept = await ctx.db.get(conceptId);
  if (concept === null || concept.userId !== viewer._id) {
    throw new Error("Concept not found");
  }
  if (concept.status !== "generated" && concept.status !== "archived" && !concept.renderSpecificationJson) {
    throw new Error("Create a repaint specification before requesting the first render");
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
      listResolvedPaintMappings(ctx),
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

  const intent = concept.styleIntentJson ? styleIntentSchema.parse(JSON.parse(concept.styleIntentJson)) : null;
  if (baseModel === null || (!stylePreset && !intent) || materialPreset === null) {
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
  if (prepaid) priceRule.creditCost = 0;
  if (account.balance < priceRule.creditCost) {
    throw new Error(
      `Insufficient credits. ${priceRule.creditCost} credits required, ${account.balance} available.`
    );
  }

  const plan = buildPaintPlan({
      approvedPlanJson: concept.palettePlanJson,
    conceptId: concept._id,
    conceptTitle: concept.title,
    baseModelName: baseModel.name,
    stylePresetName: (intent?.name ?? stylePreset?.name ?? "Custom Style"),
    styleSlug: stylePreset?.slug,
    materialPresetName: materialPreset.name,
    materialSlug: materialPreset.slug,
    moodTags: concept.moodTags ?? [],
    weatheringLevel: concept.weatheringLevel,
    colorRoles,
    paintMappings,
  });
  const visualPalette = concept.visualPaletteJson
    ? visualPaletteSchema.parse(JSON.parse(concept.visualPaletteJson))
    : visualPaletteFromLegacyPlan(concept.palettePlanJson);
  if (!visualPalette) {
    throw new Error("Concept is missing a usable visual palette");
  }
  const renderPalette = visualPaletteForRender(visualPalette);
  const renderSpecification = sanitizeRenderSpecification(
    concept.renderSpecificationJson,
    visualPalette,
    paintMappings
  );
  const materialComparisonVariants = selectMaterialComparisonVariants(
    materialPreset,
    materialPresets,
    stylePreset?.recommendedMaterialSlugs ?? []
  );
  const materialComparisonSummary = formatMaterialComparisonVariants(materialComparisonVariants);
  const modelPromptContext = await buildModelPromptContext(ctx, baseModel);

  const promptPreview = composePrompt(template.userPromptTemplate, {
    baseModel: modelPromptContext.promptText,
    conceptId: concept._id,
    materialPreset: materialPreset.name,
    mood: formatMoodTags(concept.moodTags ?? []),
    notes: concept.notes ?? "No extra notes.",
    stylePreset: (intent?.name ?? stylePreset?.name ?? "Custom Style"),
    colorRoles: JSON.stringify(renderPalette.entries),
    topPalette: JSON.stringify(renderPalette.entries),
    weatheringLevel: concept.weatheringLevel,
    approvedPalette: JSON.stringify(renderPalette),
    renderSpecification,
  });
  const promptPreviewWithFallback = [template.systemPrompt, appendPromptFallbackLines(
    promptPreview,
    template.userPromptTemplate,
    {
      stylePreset: `Style DNA: ${(intent?.name ?? stylePreset?.name ?? "Custom Style")}`,
      mood: `Mood Vector: ${formatMoodTags(concept.moodTags ?? [])}`,
      weatheringLevel: `Weathering: ${concept.weatheringLevel}`,
      simulationStage: simulationStage
        ? `Simulation Stage: ${getBuildStageLabel(simulationStage)}`
        : "",
      topPalette: `Visual color assignment (render instructions only): ${JSON.stringify(renderPalette.entries)}`,
      notes: `Operator notes: ${concept.notes ?? "No extra notes."}`,
      renderMode: `Render Mode: ${getRenderLabel(renderMode)}`,
      renderDirective: `Render Directive: ${getRenderDirective(renderMode, simulationStage)}`,
      layoutSpec: `Layout Spec: ${getRenderLayoutSpec(renderMode)}`,
      materialComparison:
        renderMode === "material-finish-comparison"
          ? `Material Comparison Set: ${materialComparisonSummary}`
          : "",
    }
  ),
    "Output guard: render only the painted model and its native in-universe markings. Do not render paint brands, product names, catalog numbers, HEX strings, palette legends, color swatches, callout lines, specification panels, or technical annotation text.",
    intent ? `Frozen Style Intent:\n${JSON.stringify(intent)}` : "",
    `Approved repaint specification (authoritative):\n${renderSpecification}`,
    `Complete visual palette (authoritative render colors; never reproduce these strings as text):\n${JSON.stringify(renderPalette)}`,
  ].filter(Boolean).join("\n\n");

  const promptCompositionId = await ctx.db.insert("promptCompositions", {
    userId: viewer._id,
    conceptId: concept._id,
    promptTemplateId: template._id,
    promptTemplateVersionId: template.promptTemplateVersionId,
    status: "ready",
    composedPrompt: promptPreviewWithFallback,
    negativePrompt: [
      template.negativePromptTemplate,
      "paint brand labels, paint product codes, catalog numbers, hex text, palette legend, color chart, specification sheet, technical callouts",
    ].filter(Boolean).join(", "),
    additionalNotes: concept.notes,
    inputSnapshotJson: JSON.stringify({
      sourceConceptId: concept._id,
      styleIntent: intent,
      baseModel: modelPromptContext.snapshot,
      stylePreset: {
        id: stylePreset?._id,
        name: (intent?.name ?? stylePreset?.name ?? "Custom Style"),
        slug: stylePreset?.slug,
      },
      materialPreset: {
        id: materialPreset._id,
        name: materialPreset.name,
        slug: materialPreset.slug,
      },
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      visualPalette,
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
    stylePresetId: stylePreset?._id,
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
  await reserveGenerationStorageForJob(ctx, viewer._id, generationJobId);

  await ctx.db.patch(concept._id, {
    generationJobId,
  });
  await ctx.db.patch(promptCompositionId, {
    generationJobId,
  });

  const balanceAfter = !prepaid && priceRule.creditCost > 0
    ? (await debitCredits(ctx, {
        userId: viewer._id,
        actionType: getRenderActionType(renderMode),
        amount: priceRule.creditCost,
        metadata: {
          referenceTable: "generationJobs",
          referenceId: generationJobId,
          description: `Queued ${getRenderLabel(renderMode).toLowerCase()} for ${concept.title}`,
          generationJobId,
          conceptId: concept._id,
          sourceType: "generation-spend",
        },
      })).balanceAfter
    : account.balance;

  if (!prepaid) await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, {
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

function sanitizeRenderSpecification(
  value: string | undefined,
  palette: VisualPalette,
  paintMappings: Array<{ brand: string; code: string }>
) {
  let parsed: Record<string, unknown> = {};
  try {
    const candidate: unknown = JSON.parse(value ?? "{}");
    if (candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }
  const serialized = JSON.stringify({
    summary: parsed.summary,
    panels: parsed.panels,
    material: parsed.material,
    weathering: parsed.weathering,
    decals: parsed.decals,
    colorPlan: visualPaletteForRender(palette),
  });
  const forbiddenTerms = Array.from(new Set(paintMappings.flatMap((paint) =>
    [paint.brand, paint.code]
      .filter((term): term is string => Boolean(term && term.trim().length >= 2))
  ))).sort((left, right) => right.length - left.length);
  return forbiddenTerms.reduce((current, term) =>
    current.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"), "selected visual color"),
    serialized
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
