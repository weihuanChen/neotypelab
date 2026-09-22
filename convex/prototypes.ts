import { v, type Infer } from "convex/values";
import type { MutationCtx } from "./types";
import { ownedStyle } from "./userStyles";
import { internal } from "./_generated/api";
import { vConceptVisibility, vMoodTag, vWeatheringLevel } from "./domain";
import { mutation } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { buildModelPromptContext } from "./modelPromptContext";
import { nextArchiveNumber } from "./archiveNumbers";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";
import { creativeInputKey, fillCreativeTemplate, styleIntentSchema, stylePlanningRules } from "./creativeContracts";
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

export const prototypeArgs = {
    userStyleId: v.optional(v.id("userStyles")),
    sourceConceptId: v.optional(v.id("concepts")),
    baseModelId: v.optional(v.id("baseModels")), kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")), materialPresetId: v.id("materialPresets"),
    moodTags: v.optional(v.array(vMoodTag)), weatheringLevel: vWeatheringLevel,
    visibility: v.optional(vConceptVisibility), notes: v.optional(v.string()),
    paletteCompositionId: v.optional(v.id("promptCompositions")), requestKey: v.optional(v.string()),
    styleRevision: v.optional(v.string()), styleIntentJson: v.optional(v.string()), styleIntentVersion: v.optional(v.string()),
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
        if (snapshot.inputKey !== inputKey || snapshot.kind !== "repaint-concept" || snapshot.paletteCompositionId !== args.paletteCompositionId || snapshot.sourceConceptId !== args.sourceConceptId || snapshot.visibility !== (args.visibility ?? "private")) throw new Error("Request key belongs to different creative inputs");
        const concept = existing.conceptId ? await ctx.db.get(existing.conceptId) : null;
        if (!concept || !existing.generationJobId) throw new Error("Incomplete existing creative request");
        return { conceptId: concept._id, promptCompositionId: existing._id, generationJobId: existing.generationJobId,
          balanceAfter: account.balance, title: concept.title, templateName: snapshot.templateName as string, promptPreview: existing.composedPrompt,
          priceRule: snapshot.priceRule as { actionType: string; label: string; creditCost: number } };
      }
    }
    await assertGenerationCapacity(ctx, viewer._id);
    const notes = args.notes?.trim() || undefined;
    if ((notes?.length ?? 0) > 100) throw new Error("Notes must be 100 characters or fewer");
    const palette = args.paletteCompositionId ? await ctx.db.get(args.paletteCompositionId) : null;
    if (!palette || palette.userId !== viewer._id || palette.status !== "consumed") throw new Error("Generate and approve a palette plan before creating the repaint specification");
    const paletteInput = JSON.parse(palette.inputSnapshotJson);
    const paletteOutput = JSON.parse(palette.outputSummaryJson ?? "{}");
    if (paletteInput.kind !== "palette-plan" || paletteInput.inputKey !== inputKey || !paletteOutput.plan) throw new Error("Palette inputs have changed. Generate and approve a new palette plan");
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
    const model = modelId ? await ctx.db.get(modelId) : null;
    const style = args.stylePresetId ? await ctx.db.get(args.stylePresetId) : null;
    const material = await ctx.db.get(args.materialPresetId);
    if (!model || !isPublicModelCatalogRecord(model) || (!style?.isActive && !args.styleIntentJson) || !material?.isActive) throw new Error("Selected kit, style or material is unavailable");
    const source = args.sourceConceptId ? await ctx.db.get(args.sourceConceptId) : null;
    if (args.sourceConceptId && (!source || source.visibility === "private" || source.status === "draft")) throw new Error("Remix source is unavailable");
    const template = await resolvePipelineTemplate(ctx, "repaint-concept");
    const configuredPrice = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-repaint-concept")).collect()).find(p => p.isActive);
    const price = configuredPrice ? { ...configuredPrice, creditCost: prepaid ? 0 : configuredPrice.creditCost } : null;
    if (!template || !price) throw new Error("Repaint specification template or price rule is missing");
    if (account.balance < price.creditCost) throw new Error("Insufficient credits");
    const modelContext = await buildModelPromptContext(ctx, model);
    const title = `${model.name} / ${intent?.name ?? style?.name ?? "Custom Style"}${source ? " Remix" : ""}`;
    const priceRule = { actionType: price.actionType, label: price.label, creditCost: price.creditCost };
    const inputSnapshot = {
      kind: "repaint-concept", textStage: "repaint-concept", inputKey,
      systemPrompt: template.systemPrompt + "\n" + stylePlanningRules, templateName: template.name, templateVersion: template.version,
      baseModel: modelContext.snapshot, ...(style ? { stylePreset: { id: style._id, name: style.name, slug: style.slug } } : {}), styleIntent: intent,
      materialPreset: { id: material._id, name: material.name, slug: material.slug },
      weatheringLevel: args.weatheringLevel, moodTags: Array.from(new Set(args.moodTags ?? [])),
      visualPalette, palettePlan, paletteCompositionId: palette._id, sourceConceptId: source?._id, visibility: args.visibility ?? "private", priceRule,
    };
    const composedPrompt = fillCreativeTemplate(template.userPromptTemplate, {
      baseModel: modelContext.promptText, kitVariant: modelContext.promptText,
      stylePreset: JSON.stringify(intent ?? style), materialPreset: JSON.stringify(material),
      mood: inputSnapshot.moodTags.join(", ") || intent?.mood || "Style default", weatheringLevel: args.weatheringLevel,
      approvedPalette: JSON.stringify(visualPaletteForRender(visualPalette)), colorRoles: visualPalette.entries.map(e => e.roleSlug).join(", "),
      notes: notes ?? "None", remixSource: source?.title ?? "None",
    });
    const conceptId = await ctx.db.insert("concepts", {
      userStyleId: savedStyle?._id, styleRootId: savedStyle ? savedStyle.rootStyleId ?? savedStyle._id : undefined,
      userId: viewer._id, recordNumber: await nextArchiveNumber(ctx, "prototype"), title, notes,
      baseModelId: model._id, stylePresetId: style?._id, materialPresetId: material._id,
      moodTags: inputSnapshot.moodTags, weatheringLevel: args.weatheringLevel, status: "draft",
      visibility: args.visibility ?? "private", sourceConceptId: source?._id,
      paletteCompositionId: palette._id,
      visualPaletteJson: JSON.stringify(visualPalette),
      paintRecommendationSetsJson: JSON.stringify(paintRecommendations),
      palettePlanJson: JSON.stringify(palettePlan),
      styleIntentJson: intent ? JSON.stringify(intent) : undefined, styleIntentVersion: intent?.version,
      searchText: `${title} ${notes ?? ""} ${intent?.name ?? style?.name ?? "Custom Style"} ${material.name}`,
    });
    const promptCompositionId = await ctx.db.insert("promptCompositions", {
      userId: viewer._id, conceptId, promptTemplateId: template._id, promptTemplateVersionId: template.promptTemplateVersionId,
      requestKey: args.requestKey, reservedCredits: price.creditCost, status: "ready", composedPrompt,
      negativePrompt: template.negativePromptTemplate, additionalNotes: notes,
      inputSnapshotJson: JSON.stringify(inputSnapshot),
      outputSummaryJson: JSON.stringify({ template: template.name, templateVersion: template.version }),
    });
    const generationJobId = await ctx.db.insert("generationJobs", {
      userId: viewer._id, kind: "palette-plan", status: "queued", requestedCredits: price.creditCost,
      baseModelId: model._id, stylePresetId: style?._id, materialPresetId: material._id, conceptId, promptCompositionId,
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
