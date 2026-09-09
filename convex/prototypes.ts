import { v } from "convex/values";
import { internal } from "./_generated/api";
import { vConceptVisibility, vMoodTag, vWeatheringLevel } from "./domain";
import { mutation } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { buildModelPromptContext } from "./modelPromptContext";
import { nextArchiveNumber } from "./archiveNumbers";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";
import { creativeInputKey, fillCreativeTemplate } from "./creativeContracts";
import type { PaintPlan } from "./paintMappingEngine";

export const initializePrototype = mutation({
  args: {
    sourceConceptId: v.optional(v.id("concepts")),
    baseModelId: v.optional(v.id("baseModels")), kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.id("stylePresets"), materialPresetId: v.id("materialPresets"),
    moodTags: v.optional(v.array(vMoodTag)), weatheringLevel: vWeatheringLevel,
    visibility: v.optional(vConceptVisibility), notes: v.optional(v.string()),
    paletteCompositionId: v.optional(v.id("promptCompositions")), requestKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
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
    const palettePlan = paletteOutput.plan as PaintPlan;
    const modelId = args.kitVariantId ?? args.baseModelId;
    const model = modelId ? await ctx.db.get(modelId) : null;
    const style = await ctx.db.get(args.stylePresetId);
    const material = await ctx.db.get(args.materialPresetId);
    if (!model || !isPublicModelCatalogRecord(model) || !style?.isActive || !material?.isActive) throw new Error("Selected kit, style or material is unavailable");
    const source = args.sourceConceptId ? await ctx.db.get(args.sourceConceptId) : null;
    if (args.sourceConceptId && (!source || source.visibility === "private" || source.status === "draft")) throw new Error("Remix source is unavailable");
    const template = await resolvePipelineTemplate(ctx, "repaint-concept");
    const price = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-repaint-concept")).collect()).find(p => p.isActive);
    if (!template || !price) throw new Error("Repaint specification template or price rule is missing");
    if (account.balance < price.creditCost) throw new Error("Insufficient credits");
    const modelContext = await buildModelPromptContext(ctx, model);
    const title = `${model.name} / ${style.name}${source ? " Remix" : ""}`;
    const priceRule = { actionType: price.actionType, label: price.label, creditCost: price.creditCost };
    const inputSnapshot = {
      kind: "repaint-concept", textStage: "repaint-concept", inputKey,
      systemPrompt: template.systemPrompt, templateName: template.name, templateVersion: template.version,
      baseModel: modelContext.snapshot, stylePreset: { id: style._id, name: style.name, slug: style.slug },
      materialPreset: { id: material._id, name: material.name, slug: material.slug },
      weatheringLevel: args.weatheringLevel, moodTags: Array.from(new Set(args.moodTags ?? [])),
      palettePlan, paletteCompositionId: palette._id, sourceConceptId: source?._id, visibility: args.visibility ?? "private", priceRule,
    };
    const composedPrompt = fillCreativeTemplate(template.userPromptTemplate, {
      baseModel: modelContext.promptText, kitVariant: modelContext.promptText,
      stylePreset: JSON.stringify(style), materialPreset: JSON.stringify(material),
      mood: inputSnapshot.moodTags.join(", ") || "None", weatheringLevel: args.weatheringLevel,
      approvedPalette: JSON.stringify(palettePlan), colorRoles: palettePlan.entries.map(e => e.roleSlug).join(", "),
      notes: notes ?? "None", remixSource: source?.title ?? "None",
    });
    const conceptId = await ctx.db.insert("concepts", {
      userId: viewer._id, recordNumber: await nextArchiveNumber(ctx, "prototype"), title, notes,
      baseModelId: model._id, stylePresetId: style._id, materialPresetId: material._id,
      moodTags: inputSnapshot.moodTags, weatheringLevel: args.weatheringLevel, status: "draft",
      visibility: args.visibility ?? "private", sourceConceptId: source?._id,
      paletteCompositionId: palette._id, palettePlanJson: JSON.stringify(palettePlan),
      searchText: `${title} ${notes ?? ""} ${style.name} ${material.name}`,
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
      baseModelId: model._id, stylePresetId: style._id, materialPresetId: material._id, conceptId, promptCompositionId,
      inputSnapshotJson: JSON.stringify(inputSnapshot), outputSummaryJson: JSON.stringify({ phase: "queued", label: "PREPARING REPAINT SPECIFICATION" }),
    });
    await ctx.db.patch(conceptId, { generationJobId });
    await ctx.db.patch(promptCompositionId, { generationJobId });
    const balanceAfter = account.balance - price.creditCost;
    await ctx.db.patch(account._id, { balance: balanceAfter, lifetimeSpent: account.lifetimeSpent + price.creditCost, lastCreditEventAt: Date.now() });
    await ctx.db.insert("creditTransactions", { userId: viewer._id, actionType: "generate-repaint-concept", delta: -price.creditCost,
      creditAmount: price.creditCost, balanceAfter, generationJobId, conceptId, referenceTable: "promptCompositions", referenceId: promptCompositionId, description: `Queued repaint specification for ${title}` });
    await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, { generationJobId });
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.creativePipeline.failStale, { promptCompositionId });
    return { conceptId, promptCompositionId, generationJobId, balanceAfter, title, templateName: template.name, promptPreview: composedPrompt, priceRule };
  },
});
