import { v, type Infer } from "convex/values";
import type { MutationCtx } from "./types";
import { ownedStyle } from "./userStyles";
import { internal } from "./_generated/api";
import { vConceptVisibility, vMoodTag, vWeatheringLevel } from "./domain";
import { mutation } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { buildModelPromptContext, normalizeModelGeometryText } from "./modelPromptContext";
import { nextArchiveNumber } from "./archiveNumbers";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";
import { creativeInputKey, legacyCreativeInputKey, creativeTemplateSeeds, fillCreativeTemplate, styleIntentSchema, stylePlanningRules, legacyRepaintTemplate, legacyStylePlanningRules } from "./creativeContracts";
import { assertExecutableIntent, effectiveStyleForExecution, requiredPaletteRolesForExecution, resolvedCreativeIntentSchema, resolvedIntentForExecution } from "./creativeIntentResolver";
import { scopedMaterialPlanningRules } from "./creativeContracts";
import { effectiveMaterialForExecution, type CreativeSnapshot } from "./creativePipeline";
import type { PaintPlan } from "./paintMappingEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import {
  buildPaintRecommendationSets,
  paintRecommendationSetsSchema,
  visualPaletteForRender,
  visualPaletteFromLegacyPlan,
  visualPaletteSchema,
} from "./paintRecommendationEngine";
import { debitCredits } from "./creditLedger";
import { customKitModelContext } from "./customKits";
import { customKitPlanningRules } from "./customKitContracts";

export const prototypeArgs = {
    customKitId: v.optional(v.id("customKits")), customKitVersionId: v.optional(v.id("customKitVersions")),
    userStyleId: v.optional(v.id("userStyles")),
    sourceConceptId: v.optional(v.id("concepts")),
    baseModelId: v.optional(v.id("baseModels")), kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")), materialPresetId: v.id("materialPresets"),
    moodTags: v.optional(v.array(vMoodTag)), weatheringLevel: vWeatheringLevel,
    visibility: v.optional(vConceptVisibility), notes: v.optional(v.string()),
    paletteCompositionId: v.optional(v.id("promptCompositions")), requestKey: v.optional(v.string()),
    styleRevision: v.optional(v.string()), styleIntentJson: v.optional(v.string()), styleIntentVersion: v.optional(v.string()),
    styleDescription: v.optional(v.string()),
    selectionSources: v.optional(v.object({
      material: v.union(v.literal("user-selection"), v.literal("system-default")),
      weathering: v.union(v.literal("user-selection"), v.literal("system-default")),
    })),
  };
export const initializePrototype = mutation({ args: prototypeArgs, handler: (ctx, args) => initializeConcept(ctx, args) });
export async function initializeConcept(ctx: MutationCtx, args: Infer<ReturnType<typeof prototypeValidator>>, prepaid = false) {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
    if (args.stylePresetId && args.styleIntentJson) throw new Error("Choose either a preset or custom style");
    if (args.userStyleId && args.stylePresetId) throw new Error("Choose either a saved style or a preset");
    const savedStyle = args.userStyleId ? await ownedStyle(ctx, args.userStyleId, args.styleIntentJson) : null;
    const inputKey = creativeInputKey(args);
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", viewer._id)).unique();
    if (!account) throw new Error("Credit account is not initialized");
    if (args.requestKey) {
      if (args.requestKey.length > 120) throw new Error("Invalid request key");
      const existing = await ctx.db.query("promptCompositions").withIndex("by_user_request", q => q.eq("userId", viewer._id).eq("requestKey", args.requestKey)).unique();
      if (existing) {
        const snapshot = JSON.parse(existing.inputSnapshotJson);
        if (snapshot.inputKey !== (snapshot.contractVersion ? inputKey : legacyCreativeInputKey(args)) || snapshot.kind !== "repaint-concept" || snapshot.paletteCompositionId !== args.paletteCompositionId || snapshot.sourceConceptId !== args.sourceConceptId || snapshot.visibility !== (args.visibility ?? "private")) throw new Error("Request key belongs to different creative inputs");
        const concept = existing.conceptId ? await ctx.db.get(existing.conceptId) : null;
        if (!concept || !existing.generationJobId) throw new Error("Incomplete existing creative request");
        return { conceptId: concept._id, promptCompositionId: existing._id, generationJobId: existing.generationJobId,
          balanceAfter: account.balance, title: concept.title, templateName: snapshot.templateName as string, promptPreview: existing.composedPrompt,
          priceRule: snapshot.priceRule as { actionType: string; label: string; creditCost: number } };
      }
    }
    await assertGenerationCapacity(ctx, viewer._id);
    const notes = args.notes?.trim() || undefined;
    if ((notes?.length ?? 0) > 2000) throw new Error("Notes must be 2000 characters or fewer");
    const palette = args.paletteCompositionId ? await ctx.db.get(args.paletteCompositionId) : null;
    if (!palette || palette.userId !== viewer._id || palette.status !== "consumed") throw new Error("Generate and approve a palette plan before creating the repaint specification");
    const paletteInput = JSON.parse(palette.inputSnapshotJson) as CreativeSnapshot;
    const paletteOutput = JSON.parse(palette.outputSummaryJson ?? "{}");
    if (paletteInput.kind !== "palette-plan" || paletteInput.inputKey !== (paletteInput.contractVersion ? inputKey : legacyCreativeInputKey(args)) || !paletteOutput.plan) throw new Error("Palette inputs have changed. Generate and approve a new palette plan");
    const resolvedIntent = paletteInput.resolvedIntent ? resolvedCreativeIntentSchema.parse(paletteInput.resolvedIntent) : undefined;
    if (paletteInput.contractVersion && !resolvedIntent) throw new Error("The approved palette is missing resolved creative intent");
    if (resolvedIntent) assertExecutableIntent(resolvedIntent);
    const intent = paletteInput.styleIntent ? styleIntentSchema.parse(paletteInput.styleIntent) : undefined;
    const palettePlan = paletteOutput.plan as PaintPlan;
    const visualPalette = paletteOutput.visualPalette
      ? visualPaletteSchema.parse(paletteOutput.visualPalette)
      : visualPaletteFromLegacyPlan(JSON.stringify(palettePlan));
    if (!visualPalette) throw new Error("The approved palette does not contain usable visual colors");
    const paintRecommendations = paletteOutput.paintRecommendations
      ? paintRecommendationSetsSchema.parse(paletteOutput.paintRecommendations)
      : buildPaintRecommendationSets(visualPalette, await listResolvedPaintMappings(ctx));
    const modelId = args.kitVariantId ?? args.baseModelId;
    const customKitContext = await customKitModelContext(ctx, viewer._id, args);
    const model = modelId ? await ctx.db.get(modelId) : null;
    const style = args.stylePresetId ? await ctx.db.get(args.stylePresetId) : null;
    const currentMaterial = await ctx.db.get(args.materialPresetId);
    if ((!customKitContext && (!model || !isPublicModelCatalogRecord(model))) || (!style?.isActive && !args.styleIntentJson) || !currentMaterial?.isActive) throw new Error("Selected kit, style or material is unavailable");
    // Approved palette inputs remain frozen even if the catalog is edited between stages.
    const material = paletteInput.materialSnapshot ?? { id: currentMaterial._id, name: currentMaterial.name, slug: currentMaterial.slug,
      finishType: currentMaterial.finishType, promptKeywords: currentMaterial.promptKeywords, paintFinish: currentMaterial.paintFinish,
      reflectivityLevel: currentMaterial.reflectivityLevel, sheenLevel: currentMaterial.sheenLevel, materialSpec: currentMaterial.materialSpec };
    const source = args.sourceConceptId ? await ctx.db.get(args.sourceConceptId) : null;
    if (args.sourceConceptId && (!source || source.visibility === "private" || source.status === "draft")) throw new Error("Remix source is unavailable");
    const template = await resolvePipelineTemplate(ctx, "repaint-concept");
    const configuredPrice = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-repaint-concept")).collect()).find(p => p.isActive);
    const price = configuredPrice ? { ...configuredPrice, creditCost: prepaid ? 0 : configuredPrice.creditCost } : null;
    if (!template || !price) throw new Error("Repaint specification template or price rule is missing");
    if (account.balance < price.creditCost) throw new Error("Insufficient credits");
    const modelContext = customKitContext ?? await buildModelPromptContext(ctx, model!);
    const executionTemplate = resolvedIntent ? creativeTemplateSeeds.find(item => item.kind === "repaint-concept")! : legacyRepaintTemplate;
    const legacyVersion = !resolvedIntent ? (await ctx.db.query("promptTemplateVersions")
      .withIndex("by_template", q => q.eq("promptTemplateId", template._id)).take(100)).find(version => version.version === "creation.v2") : null;
    const executionTemplateVersionId = resolvedIntent ? template.promptTemplateVersionId : legacyVersion?._id;
    const title = `${modelContext.snapshot.name} / ${intent?.name ?? style?.name ?? "Custom Style"}${source ? " Remix" : ""}`;
    const priceRule = { actionType: price.actionType, label: price.label, creditCost: price.creditCost };
    const inputSnapshot = {
      contractVersion: paletteInput.contractVersion, resolvedIntent, materialSnapshot: material,
      customKit: paletteInput.customKit,
      kind: "repaint-concept", textStage: "repaint-concept", inputKey: paletteInput.contractVersion ? inputKey : legacyCreativeInputKey(args),
      systemPrompt: executionTemplate.systemPrompt + "\n" + (resolvedIntent ? `${stylePlanningRules}\n${scopedMaterialPlanningRules}` : legacyStylePlanningRules) + (customKitContext ? `\n${customKitPlanningRules}` : ""), templateName: template.name, templateVersion: resolvedIntent ? template.version : "creation.v2",
      baseModel: paletteInput.contractVersion ? paletteInput.baseModel : modelContext.snapshot, ...(style ? { stylePreset: { id: style._id, name: style.name, slug: style.slug } } : {}), styleIntent: intent,
      materialPreset: { id: material.id, name: material.name, slug: material.slug },
      weatheringLevel: resolvedIntent?.effectiveStyle.weathering ?? args.weatheringLevel, moodTags: Array.from(new Set(args.moodTags ?? [])),
      visualPalette, palettePlan, paletteCompositionId: palette._id, sourceConceptId: source?._id, visibility: args.visibility ?? "private", priceRule,
    };
    const composedPrompt = fillCreativeTemplate(executionTemplate.userPromptTemplate, {
      baseModel: normalizeModelGeometryText(paletteInput.promptValues?.baseModel ?? modelContext.promptText),
      kitVariant: normalizeModelGeometryText(paletteInput.promptValues?.kitVariant ?? modelContext.promptText),
      stylePreset: JSON.stringify(resolvedIntent ? effectiveStyleForExecution(resolvedIntent) : intent ?? style),
      materialPreset: JSON.stringify(resolvedIntent ? effectiveMaterialForExecution(material, resolvedIntent) : material),
      resolvedIntent: resolvedIntent ? JSON.stringify(resolvedIntentForExecution(resolvedIntent)) : "None",
      mood: resolvedIntent?.effectiveStyle.mood ?? (inputSnapshot.moodTags.join(", ") || intent?.mood || "Style default"), weatheringLevel: inputSnapshot.weatheringLevel,
      approvedPalette: JSON.stringify(visualPaletteForRender(visualPalette)), colorRoles: resolvedIntent ? JSON.stringify(requiredPaletteRolesForExecution(resolvedIntent)) : visualPalette.entries.map(e => e.roleSlug).join(", "),
      notes: resolvedIntent ? "Apply only the frozen effective intent; original notes are retained for provenance." : notes ?? "None", remixSource: source?.title ?? "None",
    });
    const conceptId = await ctx.db.insert("concepts", {
      userStyleId: savedStyle?._id, styleRootId: savedStyle ? savedStyle.rootStyleId ?? savedStyle._id : undefined,
      userId: viewer._id, recordNumber: await nextArchiveNumber(ctx, "prototype"), title, notes,
      baseModelId: model?._id, customKitSnapshotJson: paletteInput.customKit ? JSON.stringify(paletteInput.customKit) : undefined, stylePresetId: style?._id, materialPresetId: material.id,
      moodTags: inputSnapshot.moodTags, weatheringLevel: inputSnapshot.weatheringLevel, status: "draft",
      visibility: args.visibility ?? "private", sourceConceptId: source?._id,
      paletteCompositionId: palette._id,
      visualPaletteJson: JSON.stringify(visualPalette),
      paintRecommendationSetsJson: JSON.stringify(paintRecommendations),
      palettePlanJson: JSON.stringify(palettePlan),
      styleIntentJson: intent ? JSON.stringify(intent) : undefined, styleIntentVersion: intent?.version,
      resolvedIntentJson: resolvedIntent ? JSON.stringify(resolvedIntent) : undefined,
      materialSnapshotJson: paletteInput.contractVersion ? JSON.stringify(material) : undefined,
      searchText: `${title} ${notes ?? ""} ${intent?.name ?? style?.name ?? "Custom Style"} ${material.name}`,
    });
    const promptCompositionId = await ctx.db.insert("promptCompositions", {
      userId: viewer._id, conceptId, promptTemplateId: template._id, promptTemplateVersionId: executionTemplateVersionId,
      requestKey: args.requestKey, reservedCredits: price.creditCost, status: "ready", composedPrompt,
      negativePrompt: template.negativePromptTemplate, additionalNotes: notes,
      inputSnapshotJson: JSON.stringify(inputSnapshot),
      outputSummaryJson: JSON.stringify({ template: template.name, templateVersion: inputSnapshot.templateVersion }),
    });
    const generationJobId = await ctx.db.insert("generationJobs", {
      userId: viewer._id, kind: "palette-plan", status: "queued", requestedCredits: price.creditCost,
      baseModelId: model?._id, stylePresetId: style?._id, materialPresetId: material.id, conceptId, promptCompositionId,
      inputSnapshotJson: JSON.stringify(inputSnapshot), outputSummaryJson: JSON.stringify({ phase: "queued", label: "PREPARING REPAINT SPECIFICATION" }),
    });
    await ctx.db.patch(conceptId, { generationJobId });
    await ctx.db.patch(promptCompositionId, { generationJobId });
    const balanceAfter = !prepaid && price.creditCost > 0
      ? (await debitCredits(ctx, {
          userId: viewer._id,
          actionType: "generate-repaint-concept",
          amount: price.creditCost,
          metadata: {
            generationJobId,
            conceptId,
            referenceTable: "promptCompositions",
            referenceId: promptCompositionId,
            description: `Queued repaint specification for ${title}`,
            sourceType: "generation-spend",
          },
        })).balanceAfter
      : account.balance;
    if (!prepaid) await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, { generationJobId });
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.creativePipeline.failStale, { promptCompositionId });
    return { conceptId, promptCompositionId, generationJobId, balanceAfter, title, templateName: template.name, promptPreview: composedPrompt, priceRule };
}
function prototypeValidator() { return v.object(prototypeArgs); }
