import { ConvexError, v, type Infer } from "convex/values";
import type { MutationCtx as ViewerMutationCtx } from "./types";
import { ownedStyle } from "./userStyles";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./functions";
import { internalMutation as systemMutation, internalQuery as systemQuery, type MutationCtx } from "./_generated/server";
import { buildModelPromptContext } from "./modelPromptContext";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { resolvePipelineTemplate } from "./pipelineSettings";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import type { PaintPlan } from "./paintMappingEngine";
import {
  buildPaintRecommendationSets,
  buildVisualPalette,
  materializePrimaryPaintPlan,
  summarizePaintCatalogForPrompt,
  type PaintRecommendationSets,
  type VisualPalette,
  visualPaletteFromLegacyPlan,
} from "./paintRecommendationEngine";
import { vMoodTag, vWeatheringLevel, type MaterialSpec } from "./domain";
import { assertExactRoles, creativeInputKey, legacyCreativeInputKey, fillCreativeTemplate, paletteSchema, repaintSchema, legacyPaletteSchema, legacyRepaintSchema, creativeTemplateSeeds, styleSuggestionSchema, styleIntentSchema, stylePlanningRules, sourceNormalizationProtocolVersion, currentNormalizedUserIntentSchema, type StyleIntent } from "./creativeContracts";
import { assertExecutableIntent, effectiveStyleForExecution, paletteExecutionRules, requiredPaletteRolesForExecution, resolveCreativeIntent, resolvedIntentForExecution, validateResolvedPalette, validateResolvedSpecification, type NormalizedUserIntent, type ResolvedCreativeIntent } from "./creativeIntentResolver";
import type { Id } from "./_generated/dataModel";
import { debitCredits, findDebitByReference, refundCreditTransaction } from "./creditLedger";
import { creativeValidationMessage, validateCreativeValue, validatePaletteValue } from "./creativeValidation";
import { customKitModelContext } from "./customKits";
import { customKitPlanningRules, type CustomKitSnapshot } from "./customKitContracts";

export const creativeArgs = {
  customKitId: v.optional(v.id("customKits")), customKitVersionId: v.optional(v.id("customKitVersions")),
  userStyleId: v.optional(v.id("userStyles")),
  baseModelId: v.optional(v.id("baseModels")), kitVariantId: v.optional(v.id("baseModels")),
  stylePresetId: v.optional(v.id("stylePresets")), materialPresetId: v.optional(v.id("materialPresets")),
  moodTags: v.optional(v.array(vMoodTag)), weatheringLevel: v.optional(vWeatheringLevel),
  styleRevision: v.optional(v.string()), styleIntentJson: v.optional(v.string()), styleDescription: v.optional(v.string()), notes: v.optional(v.string()), requestKey: v.string(),
  selectionSources: v.optional(v.object({
    material: v.union(v.literal("user-selection"), v.literal("system-default")),
    weathering: v.union(v.literal("user-selection"), v.literal("system-default")),
  })),
};

export type CreativeResult = {
  inputKey: string; promptCompositionId: Id<"promptCompositions">; balanceAfter: number; promptPreview: string; templateName: string;
  priceRule: { actionType: string; label: string; creditCost: number };
  suggestions: Array<{ stylePresetId: Id<"stylePresets">; name: string; slug: string; rationale: string; confidenceLabel: string }>;
  plan: PaintPlan | null;
  visualPalette: VisualPalette | null;
  paintRecommendations: PaintRecommendationSets | null;
  resolvedIntent: ResolvedCreativeIntent | null;
};

export type CreativeSnapshot = {
  customKit?: CustomKitSnapshot;
  contractVersion?: "creation.v3";
  resolvedIntent?: ResolvedCreativeIntent;
  normalizedNotes?: NormalizedUserIntent;
  normalizationExecution?: unknown;
  lastExecutionAttempt?: {
    response?: unknown; responsePreview?: string; truncated?: boolean;
    validationError?: string;
    metadata: { model?: string; profileId?: string; providerRequestId?: string | null; usage?: unknown };
  };
  rejectedExecutionAttempt?: CreativeSnapshot["lastExecutionAttempt"];
  rawNotes?: string;
  styleDescription?: string;
  normalizationProtocolVersion?: string;
  needsSourceNormalization?: boolean;
  useNormalizedDescription?: boolean;
  selectionSources?: { material: "user-selection" | "system-default"; weathering: "user-selection" | "system-default" };
  promptValues?: Record<string, string>;
  materialSnapshot?: { id: Id<"materialPresets">; name: string; slug: string; finishType: string; promptKeywords: string[]; reflectivityLevel?: string; paintFinish?: string; sheenLevel?: string; materialSpec?: MaterialSpec };
  styleIntent?: StyleIntent;
  userStyleId?: Id<"userStyles">;
  styleRootId?: Id<"userStyles">;
  kind: "style-suggestion" | "palette-plan" | "repaint-concept";
  inputKey: string;
  systemPrompt: string;
  templateName: string;
  templateVersion: string;
  baseModel: { id?: Id<"baseModels">; name: string; customKitId?: string; version?: number };
  stylePreset?: { id: Id<"stylePresets">; name: string; slug: string };
  materialPreset?: { id: Id<"materialPresets">; name: string; slug: string };
  weatheringLevel: "clean" | "light" | "heavy";
  moodTags: Array<"command-presence" | "stealth-tension" | "industrial-hazard" | "reactor-glow" | "field-fatigue" | "ceremonial-clean">;
  allowedStyles: Array<{ _id: Id<"stylePresets">; name: string; slug: string }>;
  colorRoles: Array<{ _id: Id<"colorRoles">; slug: string; name: string; recommendedArea?: string; description?: string }>;
  priceRule: CreativeResult["priceRule"];
  palettePlan?: PaintPlan;
  visualPalette?: VisualPalette;
};
type Snapshot = CreativeSnapshot;

export function normalizedMaterialFinish(material: NonNullable<CreativeSnapshot["materialSnapshot"]>): StyleIntent["finish"] | undefined {
  const aliases: Record<string, StyleIntent["finish"]> = { flat: "matte", matt: "matte", matte: "matte", satin: "satin", gloss: "gloss", glossy: "gloss", "semi-gloss": "semi-gloss", "semi_gloss": "semi-gloss", "semigloss": "semi-gloss", low: "matte", medium: "semi-gloss", high: "gloss" };
  for (const value of [material.paintFinish, material.finishType, material.sheenLevel]) {
    const finish = value ? aliases[value.toLowerCase()] : undefined;
    if (finish) return finish;
  }
  return undefined;
}

/** Material names and descriptive defaults are provenance, not a second competing finish instruction. */
export function effectiveMaterialForExecution(material: CreativeSnapshot["materialSnapshot"], intent: ResolvedCreativeIntent) {
  const finish = intent.effectiveStyle.finish;
  const materialType = material?.finishType === "metallic" ? "metallic" : material?.finishType === "ceramic" ? "ceramic" : "painted-armor";
  return {
    id: material?.id, name: `${materialType} with ${finish} finish`, materialType,
    finishType: finish, paintFinish: finish, sheenLevel: finish,
    reflectivityLevel: finish === "matte" ? "low" : finish === "gloss" ? "high" : "medium",
    materialIntent: intent.effectiveStyle.materialIntent,
    recommendedRoleSlugs: material?.materialSpec?.allowedColorRoleSlugs ?? [],
  };
}

function resolveSnapshotIntent(snapshot: Snapshot, normalizedNotes?: NormalizedUserIntent) {
  if (!snapshot.styleIntent) throw new Error("Style Intent is required to resolve creative intent");
  const resolved = resolveCreativeIntent({
    styleIntent: snapshot.styleIntent, normalizedNotes, notes: snapshot.rawNotes,
    styleDescription: snapshot.styleDescription,
    useNormalizedDescription: snapshot.useNormalizedDescription,
    material: snapshot.materialSnapshot ? {
      id: snapshot.materialSnapshot.id, name: snapshot.materialSnapshot.name,
      finish: normalizedMaterialFinish(snapshot.materialSnapshot),
    } : undefined,
    selectionSources: snapshot.selectionSources,
    weatheringLevel: snapshot.weatheringLevel, moodTags: snapshot.moodTags,
    kit: snapshot.customKit ? { source: "custom", id: snapshot.customKit.id, version: String(snapshot.customKit.version) }
      : { source: "catalog", id: snapshot.baseModel.id!, version: JSON.stringify(snapshot.baseModel) },
    customKitParts: snapshot.customKit?.effectiveParts.flatMap(part => [part.id, part.name, part.category]),
  });
  for (const [index, edit] of (snapshot.customKit?.requestedEdits ?? []).entries()) {
    resolved.constraints.push({ id: `kit-edit:${index}`, property: "geometry", scope: { kind: "part", part: edit.partId },
      strength: "hard", status: "active", value: `${edit.action}: ${edit.description}`,
      evidence: { source: "user-explicit", inputRef: "kit.requestedEdits", quote: edit.description } });
  }
  return resolved;
}

function resolvedPalettePrompt(snapshot: Snapshot, intent: ResolvedCreativeIntent) {
  assertExecutableIntent(intent);
  const seed = creativeTemplateSeeds.find(item => item.kind === "palette-plan")!;
  const executionValues = {
    ...snapshot.promptValues,
    resolvedIntent: JSON.stringify(resolvedIntentForExecution(intent)),
    stylePreset: JSON.stringify(effectiveStyleForExecution(intent)),
    colorRoles: JSON.stringify(requiredPaletteRolesForExecution(intent, snapshot.colorRoles.map(role => role.slug))),
    materialPreset: JSON.stringify(effectiveMaterialForExecution(snapshot.materialSnapshot, intent)),
    mood: intent.effectiveStyle.mood,
    weatheringLevel: intent.effectiveStyle.weathering,
    notes: "User requirements have been resolved into the effective intent. Do not reinterpret original input.",
  };
  snapshot.promptValues = executionValues;
  return fillCreativeTemplate(seed.userPromptTemplate, executionValues);
}

function executionSystemPrompt(snapshot: Snapshot) {
  return snapshot.kind === "palette-plan" && snapshot.contractVersion
    ? `${snapshot.systemPrompt}\n${paletteExecutionRules}` : snapshot.systemPrompt;
}

const beginArgs = { ...creativeArgs, kind: v.union(v.literal("style-suggestion"), v.literal("palette-plan")) };
export const begin = internalMutation({ args: beginArgs, handler: (ctx, args) => beginCreative(ctx, args) });
export async function beginCreative(ctx: ViewerMutationCtx, args: Infer<ReturnType<typeof beginValidator>>, prepaid = false) {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new ConvexError("Account is suspended");
    if (!args.requestKey.trim() || args.requestKey.length > 120) throw new ConvexError("Invalid request key");
    const existing = await ctx.db.query("promptCompositions").withIndex("by_user_request", q => q.eq("userId", viewer._id).eq("requestKey", args.requestKey)).unique();
    if (args.userStyleId && args.stylePresetId) throw new ConvexError("Choose either a saved style or a preset");
    const savedStyle = args.userStyleId ? await ownedStyle(ctx, args.userStyleId, args.styleIntentJson) : null;
    const inputKey = creativeInputKey(args);
    if (existing) {
      const prior = JSON.parse(existing.inputSnapshotJson) as Snapshot;
      if (prior.inputKey !== (prior.contractVersion ? inputKey : legacyCreativeInputKey(args)) || prior.kind !== args.kind) throw new ConvexError("Request key belongs to different creative inputs");
      return existing._id;
    }
    if ((args.notes?.trim().length ?? 0) > 2000) throw new ConvexError("Notes must be 2000 characters or fewer");
    if ((args.styleDescription?.trim().length ?? 0) > 2000) throw new ConvexError("Style description must be 2000 characters or fewer");
    const pending = await ctx.db.query("promptCompositions").withIndex("by_userId", q => q.eq("userId", viewer._id)).collect();
    if (pending.filter(p => p.status === "ready" && p.reservedCredits !== undefined).length >= 2) throw new ConvexError("Two text generations are already active");
    const modelId = args.kitVariantId ?? args.baseModelId;
    const customKitContext = await customKitModelContext(ctx, viewer._id, args);
    const model = modelId ? await ctx.db.get(modelId) : null;
    if (!customKitContext && (!model || !isPublicModelCatalogRecord(model))) throw new ConvexError("Selected kit variant is unavailable");
    const style = args.stylePresetId ? await ctx.db.get(args.stylePresetId) : null;
    const material = args.materialPresetId ? await ctx.db.get(args.materialPresetId) : null;
    if (args.stylePresetId && args.styleIntentJson) throw new ConvexError("Choose either a preset or custom style");
    if (args.stylePresetId && !style?.isActive) throw new ConvexError("Selected style is unavailable");
    const customIntent = args.styleIntentJson ? styleIntentSchema.parse(JSON.parse(args.styleIntentJson)) : style?.styleIntentJson ? styleIntentSchema.parse(JSON.parse(style.styleIntentJson)) : null;
    if (args.kind === "palette-plan" && style && customIntent &&
      (!args.styleRevision || JSON.stringify(styleIntentSchema.parse(JSON.parse(args.styleRevision))) !== JSON.stringify(customIntent))) {
      throw new ConvexError("Style intent changed. Refresh the style catalog before generating");
    }
    if (args.kind === "palette-plan" && ((!style?.isActive && !customIntent) || !material?.isActive || !args.weatheringLevel)) throw new ConvexError("Select an active style, material and weathering level");
    const template = await resolvePipelineTemplate(ctx, args.kind);
    if (!template) throw new ConvexError("No published creative template is configured");
    const actionType = args.kind === "palette-plan" ? "generate-palette" : "generate-style-suggestion";
    const configuredPrice = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", actionType)).collect()).find(p => p.isActive);
    const priceRule = configuredPrice ? { ...configuredPrice, creditCost: prepaid ? 0 : configuredPrice.creditCost } : null;
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", viewer._id)).unique();
    if (!priceRule || !account || account.balance < priceRule.creditCost) throw new ConvexError("Insufficient credits or missing active price rule");
    const modelContext = customKitContext ?? await buildModelPromptContext(ctx, model!);
    const sourceInterpretation = savedStyle?.promptCompositionId ? await ctx.db.get(savedStyle.promptCompositionId) : null;
    if (sourceInterpretation && (sourceInterpretation.userId !== viewer._id || sourceInterpretation.status !== "consumed" || JSON.parse(sourceInterpretation.inputSnapshotJson).kind !== "style-interpreter")) {
      throw new ConvexError("Saved style source is unavailable");
    }
    const sourceDescription = sourceInterpretation ? (JSON.parse(sourceInterpretation.inputSnapshotJson) as { description?: string }).description : args.styleDescription?.trim();
    const sourceOutput = sourceInterpretation ? JSON.parse(sourceInterpretation.outputSummaryJson ?? "{}") as { intent?: unknown; sourceNormalizationProtocolVersion?: string } : null;
    const recordedIntent = sourceOutput?.intent ? styleIntentSchema.safeParse(sourceOutput.intent) : null;
    const sourceReceipt = recordedIntent?.success && JSON.stringify(recordedIntent.data) === JSON.stringify(customIntent)
      ? sourceOutput?.sourceNormalizationProtocolVersion : undefined;
    const styles = (await ctx.db.query("stylePresets").collect()).filter(s => s.isActive);
    if (args.kind === "style-suggestion" && !styles.length) throw new ConvexError("No active styles available");
    const roles = await ctx.db.query("colorRoles").withIndex("by_sortOrder").collect();
    const mappings = (await listResolvedPaintMappings(ctx)).filter(p => p.isActive && /^#[0-9a-f]{6}$/i.test(p.hexPreview ?? ""));
    if (args.kind === "palette-plan" && !mappings.length) throw new ConvexError("Paint catalog has no active color samples");
    const snapshot: Snapshot = {
      contractVersion: "creation.v3",
      customKit: customKitContext?.kitSnapshot,
      rawNotes: args.notes?.trim() || undefined, styleDescription: sourceDescription,
      normalizationProtocolVersion: sourceNormalizationProtocolVersion,
      needsSourceNormalization: !!sourceDescription && customIntent?.styleType === "custom" && sourceReceipt !== sourceNormalizationProtocolVersion,
      selectionSources: args.selectionSources,
      materialSnapshot: material ? { id: material._id, name: material.name, slug: material.slug, finishType: material.finishType, promptKeywords: material.promptKeywords,
        reflectivityLevel: material.reflectivityLevel, paintFinish: material.paintFinish, sheenLevel: material.sheenLevel, materialSpec: material.materialSpec } : undefined,
      userStyleId: savedStyle?._id, styleRootId: savedStyle ? savedStyle.rootStyleId ?? savedStyle._id : undefined,
      kind: args.kind, inputKey, styleIntent: customIntent ?? undefined,
      systemPrompt: (args.kind === "palette-plan" ? creativeTemplateSeeds.find(item => item.kind === "palette-plan")!.systemPrompt : template.systemPrompt) + "\n" + stylePlanningRules + (customKitContext ? `\n${customKitPlanningRules}` : ""),
      templateName: template.name, templateVersion: template.version, baseModel: modelContext.snapshot,
      ...(style ? { stylePreset: { id: style._id, name: style.name, slug: style.slug } } : {}),
      ...(material ? { materialPreset: { id: material._id, name: material.name, slug: material.slug } } : {}),
      moodTags: Array.from(new Set(args.moodTags ?? [])), weatheringLevel: args.weatheringLevel ?? "clean",
      allowedStyles: styles.map(s => ({ _id: s._id, name: s.name, slug: s.slug })), colorRoles: roles,
      priceRule: { actionType, label: priceRule.label, creditCost: priceRule.creditCost },
    };
    const promptValues = {
      baseModel: modelContext.promptText, kitVariant: modelContext.promptText,
      stylePreset: args.kind === "palette-plan" ? "Pending effective intent resolution" : JSON.stringify(customIntent ?? style),
      materialPreset: args.kind === "palette-plan" ? "Pending effective material resolution" : JSON.stringify(material),
      weatheringLevel: snapshot.weatheringLevel, mood: snapshot.moodTags.join(", ") || customIntent?.mood || "Style default",
      notes: args.kind === "palette-plan" ? "User preferences are retained in source inputs and will be resolved before execution." : args.notes?.trim() || "None",
      availableStyles: JSON.stringify(styles.map(s => ({ id: s._id, name: s.name, slug: s.slug, description: s.shortDescription, spec: s.styleSpec }))),
      colorRoles: args.kind === "palette-plan" ? "Pending per-color role permissions" : JSON.stringify(roles.map(r => ({ slug: r.slug, name: r.name, recommendedArea: r.recommendedArea }))),
      paintCatalog: JSON.stringify(summarizePaintCatalogForPrompt(mappings)),
      resolvedIntent: "Pending resolution",
    };
    snapshot.promptValues = promptValues;
    const needsLegacyDescriptionNormalization = snapshot.needsSourceNormalization || (!!snapshot.styleDescription && !snapshot.styleIntent?.explicitRequirements);
    if (args.kind === "palette-plan" && !snapshot.rawNotes && !needsLegacyDescriptionNormalization) snapshot.resolvedIntent = resolveSnapshotIntent(snapshot);
    const prompt = args.kind === "palette-plan"
      ? snapshot.resolvedIntent ? resolvedPalettePrompt(snapshot, snapshot.resolvedIntent) : "Resolve the user's creative requirements before planning this palette."
      : fillCreativeTemplate(template.userPromptTemplate, promptValues);
    const id = await ctx.db.insert("promptCompositions", {
      userId: viewer._id, requestKey: args.requestKey, reservedCredits: priceRule.creditCost,
      promptTemplateId: template._id, promptTemplateVersionId: template.promptTemplateVersionId,
      status: "ready", composedPrompt: prompt, negativePrompt: template.negativePromptTemplate,
      additionalNotes: args.notes?.trim(), inputSnapshotJson: JSON.stringify(snapshot),
    });
    if (!prepaid && priceRule.creditCost > 0) {
      await debitCredits(ctx, {
        userId: viewer._id,
        actionType,
        amount: priceRule.creditCost,
        metadata: {
          referenceTable: "promptCompositions",
          referenceId: id,
          description: `Reserved ${args.kind} generation`,
          sourceType: "generation-spend",
        },
      });
    }
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.creativePipeline.failStale, { promptCompositionId: id });
    return id;
}
function beginValidator() { return v.object(beginArgs); }

export const claim = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }) => {
    const composition = await ctx.db.get(promptCompositionId);
    if (!composition || composition.status !== "ready" || composition.executionStartedAt) return null;
    if (composition.creationRunId) {
      const run = await ctx.db.get(composition.creationRunId);
      if (!run || run.status !== "running" || run.attempt !== composition.creationAttempt) return null;
    }
    await ctx.db.patch(composition._id, { executionStartedAt: Date.now() });
    if (composition.generationJobId) await ctx.db.patch(composition.generationJobId, { status: "running" });
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    if (snapshot.kind === "palette-plan" && snapshot.contractVersion && snapshot.resolvedIntent) {
      composition.composedPrompt = resolvedPalettePrompt(snapshot, snapshot.resolvedIntent);
      await ctx.db.patch(composition._id, { composedPrompt: composition.composedPrompt, inputSnapshotJson: JSON.stringify(snapshot) });
    }
    const { explicitRequirements: _requirements, referenceNotes: _reference, ...normalizationStyle } = snapshot.styleIntent ?? {};
    return { composition, kind: snapshot.kind, systemPrompt: executionSystemPrompt(snapshot),
      normalization: snapshot.contractVersion && snapshot.kind === "palette-plan" && !snapshot.resolvedIntent
        ? { notes: snapshot.rawNotes ?? "", styleDescription: snapshot.needsSourceNormalization || !snapshot.styleIntent?.explicitRequirements ? snapshot.styleDescription ?? "" : "",
            kit: snapshot.customKit ? { source: "custom", parts: snapshot.customKit.effectiveParts.map(part => ({ id: part.id, name: part.name, category: part.category })) } : { source: "catalog" },
            style: normalizationStyle, material: snapshot.materialSnapshot ?? null,
            weatheringLevel: snapshot.weatheringLevel, selectionSources: snapshot.selectionSources ?? { material: "system-default", weathering: "system-default" } }
        : null };
  },
});

/** Freeze normalized requirements and compile a single authoritative execution input. */
export const resolveIntent = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), normalizedNotesJson: v.string(), executionJson: v.string() },
  returns: v.union(v.null(), v.object({ userPrompt: v.string(), systemPrompt: v.string() }), v.object({ error: v.string() })),
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.promptCompositionId);
    if (!composition || composition.status !== "ready" || !composition.executionStartedAt) return null;
    if (composition.creationRunId) {
      const run = await ctx.db.get(composition.creationRunId);
      if (!run || run.status !== "running" || run.attempt !== composition.creationAttempt) return null;
    }
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    if (snapshot.contractVersion !== "creation.v3" || snapshot.kind !== "palette-plan") throw new Error("This composition does not support intent resolution");
    if (snapshot.resolvedIntent) return { userPrompt: composition.composedPrompt, systemPrompt: executionSystemPrompt(snapshot) };
    snapshot.normalizationExecution = JSON.parse(args.executionJson);
    let userPrompt: string;
    try {
      const parsedNotes: unknown = JSON.parse(args.normalizedNotesJson);
      const normalizedNotes = snapshot.normalizationProtocolVersion === sourceNormalizationProtocolVersion
        ? currentNormalizedUserIntentSchema.parse(parsedNotes) : parsedNotes as NormalizedUserIntent;
      snapshot.useNormalizedDescription = snapshot.needsSourceNormalization === true;
      const resolvedIntent = resolveSnapshotIntent(snapshot, normalizedNotes);
      assertExecutableIntent(resolvedIntent);
      snapshot.normalizedNotes = normalizedNotes;
      snapshot.resolvedIntent = resolvedIntent;
      userPrompt = resolvedPalettePrompt(snapshot, resolvedIntent);
    } catch (error) {
      await ctx.db.patch(composition._id, { inputSnapshotJson: JSON.stringify(snapshot) });
      return { error: creativeValidationMessage(error, "Creative requirement normalization") };
    }
    await ctx.db.patch(composition._id, { inputSnapshotJson: JSON.stringify(snapshot), composedPrompt: userPrompt });
    return { userPrompt, systemPrompt: executionSystemPrompt(snapshot) };
  },
});

/** Retain the final attempt and at most one rejected attempt for private diagnostics. */
export const recordExecutionAttempt = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), responseJson: v.string(), executionJson: v.string(), validationError: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.promptCompositionId);
    if (!composition || composition.status !== "ready" || !composition.executionStartedAt) return false;
    if (composition.creationRunId) {
      const run = await ctx.db.get(composition.creationRunId);
      if (!run || run.status !== "running" || run.attempt !== composition.creationAttempt) return false;
    }
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    const execution = JSON.parse(args.executionJson) as { model?: string; profileId?: string; providerRequestId?: string | null; usage?: unknown };
    if (snapshot.lastExecutionAttempt?.validationError && !snapshot.rejectedExecutionAttempt) snapshot.rejectedExecutionAttempt = snapshot.lastExecutionAttempt;
    snapshot.lastExecutionAttempt = {
      ...(new TextEncoder().encode(args.responseJson).byteLength <= 90000 ? { response: JSON.parse(args.responseJson) as unknown }
        : { responsePreview: args.responseJson.slice(0, 20000), truncated: true }),
      metadata: { model: execution.model, profileId: execution.profileId, providerRequestId: execution.providerRequestId, usage: execution.usage },
      ...(args.validationError ? { validationError: args.validationError.slice(0, 500) } : {}),
    };
    await ctx.db.patch(composition._id, { inputSnapshotJson: JSON.stringify(snapshot) });
    return true;
  },
});

export const complete = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), responseJson: v.string(), executionJson: v.string() },
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.promptCompositionId);
    if (!composition || composition.status !== "ready") return;
    if (composition.creationRunId) {
      const run = await ctx.db.get(composition.creationRunId);
      if (!run || run.status !== "running" || run.attempt !== composition.creationAttempt) return;
    }
    const snapshot = JSON.parse(composition.inputSnapshotJson) as Snapshot;
    const raw: unknown = JSON.parse(args.responseJson);
    let suggestions: CreativeResult["suggestions"] = [];
    let plan: PaintPlan | null = null;
    let visualPalette: VisualPalette | null = null;
    let paintRecommendations: PaintRecommendationSets | null = null;
    let specification: unknown = null;
    let deviations: Array<{ constraintId: string; reason: string }> = [];
    if (snapshot.kind === "style-suggestion") {
      const result = validateCreativeValue("Style recommendation", () => styleSuggestionSchema.parse(raw));
      if (new Set(result.suggestions.map(s => s.stylePresetId)).size !== result.suggestions.length) throw new Error("Duplicate style recommendations");
      suggestions = result.suggestions.map((suggestion, index) => {
        const preset = snapshot.allowedStyles.find(s => s._id === suggestion.stylePresetId);
        if (!preset) throw new Error("Model recommended a style outside the candidate catalog");
        return { stylePresetId: preset._id, name: preset.name, slug: preset.slug, rationale: suggestion.rationale, confidenceLabel: index === 0 ? "Best fit" : "Alternative" };
      });
    } else if (snapshot.kind === "palette-plan") {
      const parsed = snapshot.contractVersion ? validatePaletteValue(() => paletteSchema.parse(raw)) : validateCreativeValue("Palette", () => legacyPaletteSchema.parse(raw));
      let result = parsed;
      if (snapshot.contractVersion) {
        if (!snapshot.resolvedIntent) throw new Error("Creative intent must be resolved before palette generation");
        const validated = validatePaletteValue(() => validateResolvedPalette(parsed, snapshot.resolvedIntent!, snapshot.colorRoles.map(r => r.slug)));
        result = validated.palette;
        deviations = validated.deviations;
      } else assertExactRoles(result.entries.map(e => e.roleSlug), snapshot.colorRoles.map(r => r.slug));
      const mappings = (await listResolvedPaintMappings(ctx)).filter(p => p.isActive);
      visualPalette = buildVisualPalette({
        version: snapshot.contractVersion ? "visual-palette.v3" : "visual-palette.v2",
        entries: result.entries,
        roles: snapshot.colorRoles,
        sprayNotes: result.sprayNotes,
      });
      paintRecommendations = buildPaintRecommendationSets(visualPalette, mappings);
      plan = materializePrimaryPaintPlan({
        palette: visualPalette,
        recommendations: paintRecommendations,
        conceptTitle: `${snapshot.baseModel.name} / ${(snapshot.styleIntent?.name ?? snapshot.stylePreset?.name)}`,
        baseModelName: snapshot.baseModel.name,
        stylePresetName: snapshot.styleIntent?.name ?? snapshot.stylePreset?.name,
        materialPresetName: snapshot.materialPreset?.name,
        weatheringLevel: snapshot.weatheringLevel,
        moodTags: snapshot.moodTags,
      }) as PaintPlan;
    } else {
      let result = validateCreativeValue("Specification", () => snapshot.contractVersion ? repaintSchema.parse(raw) : legacyRepaintSchema.parse(raw));
      const approvedVisualPalette = snapshot.visualPalette
        ?? visualPaletteFromLegacyPlan(snapshot.palettePlan ? JSON.stringify(snapshot.palettePlan) : undefined);
      if (!approvedVisualPalette || !composition.conceptId || !composition.generationJobId) throw new Error("Missing approved palette or concept");
      if (snapshot.contractVersion) {
        if (!snapshot.resolvedIntent) throw new Error("Missing frozen creative intent");
        result = validateCreativeValue("Specification", () => validateResolvedSpecification(result, approvedVisualPalette, snapshot.resolvedIntent!));
      } else assertExactRoles(result.panels.map(p => p.roleSlug), approvedVisualPalette.entries.map(e => e.roleSlug));
      if (snapshot.customKit) {
        const partIds = new Set(snapshot.customKit.effectiveParts.filter(part => part.visibility !== "not-visible" || part.source === "user-request").map(part => part.id));
        if (result.panels.some(panel => panel.areas.some(area => !partIds.has(area)))) throw new Error("Custom Kit assignments must reference approved visible or proposed part IDs");
      }
      if (result.weathering.level !== (snapshot.resolvedIntent?.effectiveStyle.weathering ?? snapshot.weatheringLevel)) throw new Error("Specification changed the approved weathering level");
      specification = { ...result, baseModel: snapshot.baseModel, colorPlan: approvedVisualPalette,
        ...(snapshot.resolvedIntent ? { resolvedIntent: resolvedIntentForExecution(snapshot.resolvedIntent), materialPreset: effectiveMaterialForExecution(snapshot.materialSnapshot, snapshot.resolvedIntent) }
          : { styleIntent: snapshot.styleIntent, stylePreset: snapshot.stylePreset, materialPreset: snapshot.materialPreset }) };
      let customPlan: PaintPlan | undefined;
      if (snapshot.customKit && snapshot.palettePlan) {
        const parts = snapshot.customKit.effectiveParts;
        customPlan = { ...snapshot.palettePlan, entries: snapshot.palettePlan.entries.map(entry => ({ ...entry,
          recommendedArea: Array.from(new Set(result.panels.filter(panel => "colorId" in panel && panel.colorId === entry.colorId).flatMap(panel => panel.areas))).map(id => parts.find(part => part.id === id)?.name ?? id).join(", "),
        })) };
      }
      await ctx.db.patch(composition.conceptId, { renderSpecificationJson: JSON.stringify(specification),
        ...(customPlan ? { palettePlanJson: JSON.stringify(customPlan) } : {}) });
      await ctx.db.patch(composition.generationJobId, { status: "succeeded", outputSummaryJson: JSON.stringify({ phase: "specification-ready", label: "REPAINT SPECIFICATION READY", specification }) });
    }
    await ctx.db.patch(composition._id, { status: "consumed", outputSummaryJson: JSON.stringify({
      tool: snapshot.kind, template: snapshot.templateName, templateVersion: snapshot.templateVersion,
      suggestions, plan, visualPalette, paintRecommendations, specification, execution: JSON.parse(args.executionJson),
      resolvedIntent: snapshot.resolvedIntent,
      deviations,
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
    const output = JSON.parse(composition.outputSummaryJson!) as {
      suggestions: CreativeResult["suggestions"];
      plan: PaintPlan | null;
      visualPalette?: VisualPalette | null;
      paintRecommendations?: PaintRecommendationSets | null;
    };
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", composition.userId)).unique();
    return { inputKey: snapshot.inputKey, promptCompositionId, balanceAfter: account?.balance ?? 0, promptPreview: composition.composedPrompt,
      templateName: snapshot.templateName, priceRule: snapshot.priceRule, suggestions: output.suggestions, plan: output.plan,
      visualPalette: output.visualPalette ?? (output.plan ? visualPaletteFromLegacyPlan(JSON.stringify(output.plan)) : null),
      paintRecommendations: output.paintRecommendations ?? null, resolvedIntent: snapshot.resolvedIntent ?? null };
  },
});

export async function failComposition(ctx: MutationCtx, id: Id<"promptCompositions">, reason: string) {
  const composition = await ctx.db.get(id);
  if (!composition || composition.status !== "ready") return;
  await ctx.db.patch(id, { status: "failed", failureReason: reason });
  if (composition.generationJobId) await ctx.db.patch(composition.generationJobId, { status: "failed", errorMessage: reason });
  const cost = composition.reservedCredits ?? 0;
  if (!cost) return;
  const debit = await findDebitByReference(ctx, "promptCompositions", id);
  if (!debit) return;
  await refundCreditTransaction(ctx, {
    debitTransactionId: debit._id,
    actionType: "generation-refund",
    metadata: {
      generationJobId: composition.generationJobId,
      conceptId: composition.conceptId,
      referenceTable: "promptCompositions",
      referenceId: id,
      description: `Refunded failed text generation: ${reason.slice(0,200)}`,
    },
  });
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
    const output = JSON.parse(composition.outputSummaryJson) as {
      suggestions: CreativeResult["suggestions"];
      plan: PaintPlan | null;
      visualPalette?: VisualPalette | null;
      paintRecommendations?: PaintRecommendationSets | null;
    };
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", composition.userId)).unique();
    return { inputKey: snapshot.inputKey, promptCompositionId: composition._id, balanceAfter: account?.balance ?? 0, promptPreview: composition.composedPrompt,
      templateName: snapshot.templateName, priceRule: snapshot.priceRule, suggestions: output.suggestions, plan: output.plan,
      visualPalette: output.visualPalette ?? (output.plan ? visualPaletteFromLegacyPlan(JSON.stringify(output.plan)) : null),
      paintRecommendations: output.paintRecommendations ?? null, resolvedIntent: snapshot.resolvedIntent ?? null };
  },
});
