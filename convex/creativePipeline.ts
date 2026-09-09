import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./functions";
import { internalMutation as systemMutation, internalQuery as systemQuery, type MutationCtx } from "./_generated/server";
import { buildModelPromptContext } from "./modelPromptContext";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { resolvePipelineTemplate } from "./pipelineSettings";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { buildPaintPlan, serializePaint, type PaintPlan } from "./paintMappingEngine";
import { deltaE2000, hexToLabD65 } from "./paintColor";
import { vMoodTag, vWeatheringLevel } from "./domain";
import { assertExactRoles, creativeInputKey, fillCreativeTemplate, paletteSchema, repaintSchema, styleSuggestionSchema } from "./creativeContracts";
import type { Id } from "./_generated/dataModel";

export const creativeArgs = {
  baseModelId: v.optional(v.id("baseModels")), kitVariantId: v.optional(v.id("baseModels")),
  stylePresetId: v.optional(v.id("stylePresets")), materialPresetId: v.optional(v.id("materialPresets")),
  moodTags: v.optional(v.array(vMoodTag)), weatheringLevel: v.optional(vWeatheringLevel),
  notes: v.optional(v.string()), requestKey: v.string(),
};

export type CreativeResult = {
  inputKey: string; promptCompositionId: Id<"promptCompositions">; balanceAfter: number; promptPreview: string; templateName: string;
  priceRule: { actionType: string; label: string; creditCost: number };
  suggestions: Array<{ stylePresetId: Id<"stylePresets">; name: string; slug: string; rationale: string; confidenceLabel: string }>;
  plan: PaintPlan | null;
};

type Snapshot = {
  kind: "style-suggestion" | "palette-plan" | "repaint-concept";
  inputKey: string;
  systemPrompt: string;
  templateName: string;
  templateVersion: string;
  baseModel: { id: Id<"baseModels">; name: string };
  stylePreset?: { id: Id<"stylePresets">; name: string; slug: string };
  materialPreset?: { id: Id<"materialPresets">; name: string; slug: string };
  weatheringLevel: "clean" | "light" | "heavy";
  moodTags: Array<"command-presence" | "stealth-tension" | "industrial-hazard" | "reactor-glow" | "field-fatigue" | "ceremonial-clean">;
  allowedStyles: Array<{ _id: Id<"stylePresets">; name: string; slug: string }>;
  colorRoles: Array<{ _id: Id<"colorRoles">; slug: string; name: string; recommendedArea?: string; description?: string }>;
  priceRule: CreativeResult["priceRule"];
  palettePlan?: PaintPlan;
};

export const begin = internalMutation({
  args: { ...creativeArgs, kind: v.union(v.literal("style-suggestion"), v.literal("palette-plan")) },
  handler: async (ctx, args) => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
    if (!args.requestKey.trim() || args.requestKey.length > 120) throw new Error("Invalid request key");
    const existing = await ctx.db.query("promptCompositions").withIndex("by_user_request", q => q.eq("userId", viewer._id).eq("requestKey", args.requestKey)).unique();
    const inputKey = creativeInputKey(args);
    if (existing) {
      const prior = JSON.parse(existing.inputSnapshotJson) as Snapshot;
      if (prior.inputKey !== inputKey || prior.kind !== args.kind) throw new Error("Request key belongs to different creative inputs");
      return existing._id;
    }
    if ((args.notes?.trim().length ?? 0) > 100) throw new Error("Notes must be 100 characters or fewer");
    const pending = await ctx.db.query("promptCompositions").withIndex("by_userId", q => q.eq("userId", viewer._id)).collect();
    if (pending.filter(p => p.status === "ready" && p.reservedCredits !== undefined).length >= 2) throw new Error("Two text generations are already active");
    const modelId = args.kitVariantId ?? args.baseModelId;
    const model = modelId ? await ctx.db.get(modelId) : null;
    if (!model || !isPublicModelCatalogRecord(model)) throw new Error("Selected kit variant is unavailable");
    const style = args.stylePresetId ? await ctx.db.get(args.stylePresetId) : null;
    const material = args.materialPresetId ? await ctx.db.get(args.materialPresetId) : null;
    if (args.kind === "palette-plan" && (!style?.isActive || !material?.isActive || !args.weatheringLevel)) throw new Error("Select an active style, material and weathering level");
    const template = await resolvePipelineTemplate(ctx, args.kind);
    if (!template) throw new Error("No published creative template is configured");
    const actionType = args.kind === "palette-plan" ? "generate-palette" : "generate-style-suggestion";
    const priceRule = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", actionType)).collect()).find(p => p.isActive);
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", viewer._id)).unique();
    if (!priceRule || !account || account.balance < priceRule.creditCost) throw new Error("Insufficient credits or missing active price rule");
    const modelContext = await buildModelPromptContext(ctx, model);
    const styles = (await ctx.db.query("stylePresets").collect()).filter(s => s.isActive);
    if (!styles.length) throw new Error("No active styles available");
    const roles = await ctx.db.query("colorRoles").withIndex("by_sortOrder").collect();
    const mappings = (await listResolvedPaintMappings(ctx)).filter(p => p.isActive && /^#[0-9a-f]{6}$/i.test(p.hexPreview ?? ""));
    const effects = Array.from(new Set(mappings.map(p => p.opacity === "transparent" ? "transparent" : p.effects.includes("metallic") ? "metallic" : "solid")));
    if (args.kind === "palette-plan" && !mappings.length) throw new Error("Paint catalog has no active color samples");
    const snapshot: Snapshot = {
      kind: args.kind, inputKey, systemPrompt: template.systemPrompt,
      templateName: template.name, templateVersion: template.version, baseModel: modelContext.snapshot,
      ...(style ? { stylePreset: { id: style._id, name: style.name, slug: style.slug } } : {}),
      ...(material ? { materialPreset: { id: material._id, name: material.name, slug: material.slug } } : {}),
      moodTags: Array.from(new Set(args.moodTags ?? [])), weatheringLevel: args.weatheringLevel ?? "clean",
      allowedStyles: styles.map(s => ({ _id: s._id, name: s.name, slug: s.slug })), colorRoles: roles,
      priceRule: { actionType, label: priceRule.label, creditCost: priceRule.creditCost },
    };
    const prompt = fillCreativeTemplate(template.userPromptTemplate, {
      baseModel: modelContext.promptText, kitVariant: modelContext.promptText,
      stylePreset: JSON.stringify(style), materialPreset: JSON.stringify(material),
      weatheringLevel: snapshot.weatheringLevel, mood: snapshot.moodTags.join(", ") || "None",
      notes: args.notes?.trim() || "None",
      availableStyles: JSON.stringify(styles.map(s => ({ id: s._id, name: s.name, slug: s.slug, description: s.shortDescription, spec: s.styleSpec }))),
      colorRoles: JSON.stringify(roles.map(r => ({ slug: r.slug, name: r.name, recommendedArea: r.recommendedArea }))),
      paintCatalog: JSON.stringify({ availableEffects: effects, activeColorSamples: mappings.length }),
    });
    const id = await ctx.db.insert("promptCompositions", {
      userId: viewer._id, requestKey: args.requestKey, reservedCredits: priceRule.creditCost,
      promptTemplateId: template._id, promptTemplateVersionId: template.promptTemplateVersionId,
      status: "ready", composedPrompt: prompt, negativePrompt: template.negativePromptTemplate,
      additionalNotes: args.notes?.trim(), inputSnapshotJson: JSON.stringify(snapshot),
    });
    const balance = account.balance - priceRule.creditCost;
    await ctx.db.patch(account._id, { balance, lifetimeSpent: account.lifetimeSpent + priceRule.creditCost, lastCreditEventAt: Date.now() });
    await ctx.db.insert("creditTransactions", { userId: viewer._id, actionType, delta: -priceRule.creditCost, creditAmount: priceRule.creditCost,
      balanceAfter: balance, referenceTable: "promptCompositions", referenceId: id, description: `Reserved ${args.kind} generation` });
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.creativePipeline.failStale, { promptCompositionId: id });
    return id;
  },
});

export const claim = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }) => {
    const composition = await ctx.db.get(promptCompositionId);
    if (!composition || composition.status !== "ready" || composition.executionStartedAt) return null;
    await ctx.db.patch(composition._id, { executionStartedAt: Date.now() });
    if (composition.generationJobId) await ctx.db.patch(composition.generationJobId, { status: "running" });
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    return { composition, kind: snapshot.kind, systemPrompt: snapshot.systemPrompt };
  },
});

export const complete = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), responseJson: v.string(), executionJson: v.string() },
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.promptCompositionId);
    if (!composition || composition.status !== "ready") return;
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    const raw: unknown = JSON.parse(args.responseJson);
    let suggestions: CreativeResult["suggestions"] = [];
    let plan: PaintPlan | null = null;
    let specification: unknown = null;
    if (snapshot.kind === "style-suggestion") {
      const result = styleSuggestionSchema.parse(raw);
      if (new Set(result.suggestions.map(s => s.stylePresetId)).size !== result.suggestions.length) throw new Error("Duplicate style recommendations");
      suggestions = result.suggestions.map((suggestion, index) => {
        const preset = snapshot.allowedStyles.find(s => s._id === suggestion.stylePresetId);
        if (!preset) throw new Error("Model recommended a style outside the candidate catalog");
        return { stylePresetId: preset._id, name: preset.name, slug: preset.slug, rationale: suggestion.rationale, confidenceLabel: index === 0 ? "Best fit" : "Alternative" };
      });
    } else if (snapshot.kind === "palette-plan") {
      const result = paletteSchema.parse(raw);
      assertExactRoles(result.entries.map(e => e.roleSlug), snapshot.colorRoles.map(r => r.slug));
      const mappings = (await listResolvedPaintMappings(ctx)).filter(p => p.isActive && /^#[0-9a-f]{6}$/i.test(p.hexPreview ?? ""));
      plan = buildPaintPlan({ conceptTitle: `${snapshot.baseModel.name} / ${snapshot.stylePreset?.name}`, baseModelName: snapshot.baseModel.name,
        stylePresetName: snapshot.stylePreset?.name, materialPresetName: snapshot.materialPreset?.name,
        weatheringLevel: snapshot.weatheringLevel, moodTags: snapshot.moodTags, colorRoles: snapshot.colorRoles, paintMappings: mappings });
      plan.sprayNotes = result.sprayNotes;
      plan.entries = plan.entries.map(entry => {
        const target = result.entries.find(r => r.roleSlug === entry.roleSlug)!;
        const candidates = mappings.filter(p => target.paintEffect === "transparent" ? p.opacity === "transparent"
          : target.paintEffect === "metallic" ? p.effects.includes("metallic") && p.opacity !== "transparent"
          : !p.effects.includes("metallic") && p.opacity !== "transparent");
        const targetLab = hexToLabD65(target.targetHex);
        const nearest = candidates.map(p => ({ paint: p, delta: deltaE2000(targetLab, hexToLabD65(p.hexPreview!)) })).sort((a,b) => a.delta - b.delta).at(0);
        if (!nearest) throw new Error(`No catalog paint available for ${entry.roleSlug} (${target.paintEffect})`);
        return { ...entry, rationale: `${target.rationale} Target ${target.targetHex}; closest catalog sample ΔE00 ${nearest.delta.toFixed(1)}.`,
          suggestedPaint: serializePaint(nearest.paint), alternatePaint: null };
      });
    } else {
      const result = repaintSchema.parse(raw);
      if (!snapshot.palettePlan || !composition.conceptId || !composition.generationJobId) throw new Error("Missing approved palette or concept");
      assertExactRoles(result.panels.map(p => p.roleSlug), snapshot.palettePlan.entries.map(e => e.roleSlug));
      if (result.weathering.level !== snapshot.weatheringLevel) throw new Error("Specification changed the approved weathering level");
      specification = { ...result, baseModel: snapshot.baseModel, colorPlan: snapshot.palettePlan,
        stylePreset: snapshot.stylePreset, materialPreset: snapshot.materialPreset };
      await ctx.db.patch(composition.conceptId, { renderSpecificationJson: JSON.stringify(specification) });
      await ctx.db.patch(composition.generationJobId, { status: "succeeded", outputSummaryJson: JSON.stringify({ phase: "specification-ready", label: "REPAINT SPECIFICATION READY", specification }) });
    }
    await ctx.db.patch(composition._id, { status: "consumed", outputSummaryJson: JSON.stringify({
      tool: snapshot.kind, template: snapshot.templateName, templateVersion: snapshot.templateVersion,
      suggestions, plan, specification, execution: JSON.parse(args.executionJson),
    }) });
  },
});

export const result = internalQuery({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }): Promise<CreativeResult> => {
    const composition = await ctx.db.get(promptCompositionId);
    if (!composition || composition.userId !== ctx.viewerX()._id) throw new Error("Creative result not found");
    if (composition.status !== "consumed") throw new Error(composition.failureReason ?? "Generation is already running; retry with the same request key after it finishes");
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    const output = JSON.parse(composition.outputSummaryJson!) as { suggestions: CreativeResult["suggestions"]; plan: PaintPlan | null };
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", composition.userId)).unique();
    return { inputKey: snapshot.inputKey, promptCompositionId, balanceAfter: account?.balance ?? 0, promptPreview: composition.composedPrompt,
      templateName: snapshot.templateName, priceRule: snapshot.priceRule, suggestions: output.suggestions, plan: output.plan };
  },
});

async function failComposition(ctx: MutationCtx, id: Id<"promptCompositions">, reason: string) {
  const composition = await ctx.db.get(id);
  if (!composition || composition.status !== "ready") return;
  await ctx.db.patch(id, { status: "failed", failureReason: reason });
  if (composition.generationJobId) await ctx.db.patch(composition.generationJobId, { status: "failed", errorMessage: reason });
  const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", composition.userId)).unique();
  const cost = composition.reservedCredits ?? 0;
  if (!account || !cost) return;
  const balance = account.balance + cost;
  await ctx.db.patch(account._id, { balance, lifetimeSpent: Math.max(0, account.lifetimeSpent - cost), lastCreditEventAt: Date.now() });
  await ctx.db.insert("creditTransactions", { userId: composition.userId, actionType: "generation-refund", delta: cost, creditAmount: cost, balanceAfter: balance,
    generationJobId: composition.generationJobId, conceptId: composition.conceptId, referenceTable: "promptCompositions", referenceId: id, description: `Refunded failed text generation: ${reason.slice(0,200)}` });
}
export const fail = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), reason: v.string() },
  handler: async (ctx, args) => failComposition(ctx, args.promptCompositionId, args.reason),
});
export const failStale = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, args) => failComposition(ctx, args.promptCompositionId, "Text generation exceeded its 15-minute deadline"),
});

export const getRepaintComposition = systemQuery({
  args: { generationJobId: v.id("generationJobs") },
  handler: async (ctx, { generationJobId }) => {
    const job = await ctx.db.get(generationJobId);
    if (!job?.inputSnapshotJson || !job.promptCompositionId) return null;
    const input = JSON.parse(job.inputSnapshotJson) as { textStage?: string };
    return input.textStage === "repaint-concept" ? job.promptCompositionId : null;
  },
});

export const latest = query({
  args: { kind: v.union(v.literal("style-suggestion"), v.literal("palette-plan")), inputKey: v.string() },
  handler: async (ctx, { kind, inputKey }): Promise<CreativeResult | null> => {
    if (!ctx.viewer) return null;
    const recent = await ctx.db.query("promptCompositions").withIndex("by_userId", q => q.eq("userId", ctx.viewer!._id)).order("desc").take(50);
    const composition = recent.find(row => {
      if (row.status !== "consumed") return false;
      const snapshot = JSON.parse(row.inputSnapshotJson) as Snapshot;
      return snapshot.kind === kind && snapshot.inputKey === inputKey;
    });
    if (!composition?.outputSummaryJson) return null;
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    const output = JSON.parse(composition.outputSummaryJson) as { suggestions: CreativeResult["suggestions"]; plan: PaintPlan | null };
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", composition.userId)).unique();
    return { inputKey: snapshot.inputKey, promptCompositionId: composition._id, balanceAfter: account?.balance ?? 0, promptPreview: composition.composedPrompt,
      templateName: snapshot.templateName, priceRule: snapshot.priceRule, suggestions: output.suggestions, plan: output.plan };
  },
});
