import { v, type Infer } from "convex/values";
import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { mutation, query } from "./functions";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { prototypeArgs, initializeConcept } from "./prototypes";
import { beginCreative } from "./creativePipeline";
import { queueConceptRender } from "./prototypeTools";
import { creativeInputKey } from "./creativeContracts";
import type { Id } from "./_generated/dataModel";
import { portraitUrl } from "./kitPicker";
import { creationWorkflowManager } from "./workflowManager";
import { debitCredits, findDebitByReference, refundCreditTransaction } from "./creditLedger";

const { paletteCompositionId: _palette, visibility: _visibility, requestKey: _key, ...inputArgs } = prototypeArgs;
const inputValidator = v.object(inputArgs);
type RunInput = Infer<typeof inputValidator>;

export const quote = query({ args: {}, handler: async ctx => {
  const rules = await ctx.db.query("creditPriceRules").collect();
  const costs = ["generate-palette", "generate-repaint-concept", "generate-hd-render"].map(action => rules.find(rule => rule.actionType === action && rule.isActive)?.creditCost);
  if (costs.some(cost => cost === undefined || cost < 0)) return null;
  return { cost: costs.reduce<number>((total, cost) => total + cost!, 0) };
} });

async function reserve(ctx: MutationCtx, userId: Id<"users">, runId: Id<"creationRuns">, cost: number) {
  return await debitCredits(ctx, {
    userId,
    actionType: "generate-repaint-concept",
    amount: cost,
    insufficientMessage: `This preview requires ${cost} credits`,
    metadata: {
      referenceTable: "creationRuns",
      referenceId: runId,
      description: "Preview image + paint plan",
      sourceType: "generation-spend",
    },
  });
}

async function viewerContext(ctx: MutationCtx, userId: Id<"users">) {
  const viewer = await ctx.db.get(userId);
  if (!viewer || viewer.accountStatus === "suspended") throw new Error("Account unavailable");
  return { ...ctx, viewer, viewerX: () => viewer };
}

export const start = mutation({
  args: { input: inputValidator, requestKey: v.string(), expectedCost: v.number() },
  handler: async (ctx, args) => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account unavailable");
    if (!args.requestKey || args.requestKey.length > 120) throw new Error("Invalid request key");
    const inputKey = creativeInputKey(args.input) + JSON.stringify({ sourceConceptId: args.input.sourceConceptId });
    const prior = await ctx.db.query("creationRuns").withIndex("by_user_request", q => q.eq("userId", viewer._id).eq("requestKey", args.requestKey)).unique();
    if (prior) {
      if (prior.inputKey !== inputKey) throw new Error("Request key already used for another preview");
      return prior._id;
    }
    const runs = await ctx.db.query("creationRuns").withIndex("by_user", q => q.eq("userId", viewer._id)).collect();
    if (runs.some(run => run.status === "queued" || run.status === "running")) throw new Error("A preview is already in progress");
    const rules = await ctx.db.query("creditPriceRules").collect();
    let cost = 0;
    for (const action of ["generate-palette", "generate-repaint-concept", "generate-hd-render"]) {
      const rule = rules.find(row => row.actionType === action && row.isActive);
      if (!rule || rule.creditCost < 0) throw new Error("Preview pricing unavailable");
      cost += rule.creditCost;
    }
    if (cost !== args.expectedCost) throw new Error("Preview price changed. Review the updated total and try again");
    if (args.input.sourceConceptId) {
      const source = await ctx.db.get(args.input.sourceConceptId);
      if (!source || source.visibility === "private" || source.status === "draft") throw new Error("Remix source unavailable");
    }
    const now = Date.now();
    const id = await ctx.db.insert("creationRuns", { userId: viewer._id, requestKey: args.requestKey, inputJson: JSON.stringify(args.input), inputKey,
      status: "queued", stage: "palette", cost, attempt: 1, refunded: false, queuedAt: now, updatedAt: now });
    const debit = await reserve(ctx, viewer._id, id, cost);
    await ctx.db.patch(id, { creditTransactionId: debit.transactionId });
    const paletteId = await beginCreative(ctx, { ...args.input, kind: "palette-plan", requestKey: `run:${id}:palette:1` }, true);
    await ctx.db.patch(paletteId, { creationRunId: id, creationAttempt: 1 });
    await ctx.db.patch(id, { paletteId });
    const workflowId = await creationWorkflowManager.start(
      ctx,
      internal.creationWorkflow.execute,
      { runId: id, attempt: 1 },
      {
        startAsync: true,
        onComplete: internal.creationRuns.completeWorkflow,
        context: { runId: id, attempt: 1 },
      }
    );
    await ctx.db.patch(id, { workflowId });
    await ctx.scheduler.runAfter(25 * 60 * 1000, internal.creationRuns.expire, { runId: id, attempt: 1 });
    return id;
  },
});

export const latest = query({ args: {}, handler: async ctx => {
  if (!ctx.viewer) return null;
  const run = await ctx.db.query("creationRuns").withIndex("by_user", q => q.eq("userId", ctx.viewer!._id)).order("desc").first();
  if (!run) return null;
  const concept = run.conceptId ? await ctx.db.get(run.conceptId) : null;
  const previewAsset = concept?.previewAssetId ? await ctx.db.get(concept.previewAssetId) : null;

  let input: any = null;
  try {
    input = JSON.parse(run.inputJson);
  } catch {
    input = null;
  }

  const rawKitId = input?.kitVariantId ?? input?.baseModelId;
  const kitId = typeof rawKitId === "string" ? ctx.db.normalizeId("baseModels", rawKitId) : null;
  const kit = kitId ? await ctx.db.get(kitId) : null;
  const stylePresetId = typeof input?.stylePresetId === "string" ? ctx.db.normalizeId("stylePresets", input.stylePresetId) : null;
  const stylePreset = stylePresetId ? await ctx.db.get(stylePresetId) : null;
  const userStyleId = typeof input?.userStyleId === "string" ? ctx.db.normalizeId("userStyles", input.userStyleId) : null;
  const userStyle = userStyleId ? await ctx.db.get(userStyleId) : null;
  let styleIntent: any = null;
  if (input?.styleIntentJson) {
    try {
      styleIntent = JSON.parse(input.styleIntentJson);
    } catch {
      styleIntent = null;
    }
  }
  const styleName = stylePreset?.name ?? userStyle?.name ?? styleIntent?.name ?? "Custom Style";
  const styleSlug = stylePreset?.slug;

  let visualPalette: { primary?: string; secondary?: string; accent?: string; frame?: string; detail?: string } | null = null;
  if (concept?.visualPaletteJson) {
    try {
      const parsed = JSON.parse(concept.visualPaletteJson);
      visualPalette = {
        primary: parsed.primary,
        secondary: parsed.secondary,
        accent: parsed.accent,
        frame: parsed.frame,
        detail: parsed.detail,
      };
    } catch {
      visualPalette = null;
    }
  } else if (run.paletteId) {
    const paletteComp = await ctx.db.get(run.paletteId);
    if (paletteComp?.outputSummaryJson) {
      try {
        const output = JSON.parse(paletteComp.outputSummaryJson);
        if (output?.visualPalette) {
          visualPalette = {
            primary: output.visualPalette.primary,
            secondary: output.visualPalette.secondary,
            accent: output.visualPalette.accent,
            frame: output.visualPalette.frame,
            detail: output.visualPalette.detail,
          };
        }
      } catch {
        visualPalette = null;
      }
    }
  }

  const rawJobNum = concept?.recordNumber ? String(concept.recordNumber).padStart(4, "0") : run._id.slice(-4).toUpperCase();
  const jobId = `NPL-${rawJobNum}`;

  return {
    id: run._id,
    jobId,
    status: run.status,
    stage: run.stage,
    cost: run.cost,
    refunded: run.refunded,
    error: run.error,
    conceptId: run.conceptId,
    title: concept?.title ?? (kit ? `${kit.name} × ${styleName}` : "Repaint Preview"),
    kit: kit ? {
      id: kit._id,
      name: kit.name,
      grade: kit.grade ?? "",
      scale: kit.scale ?? "",
      portrait: portraitUrl(kit.thumbnailAssetKey),
      fullBody: portraitUrl(kit.fullBodyAssetKey) ?? portraitUrl(kit.thumbnailAssetKey),
    } : null,
    styleName,
    styleSlug,
    visualPalette,
    previewAsset: previewAsset ? {
      publicUrl: previewAsset.publicUrl,
      storageObjectId: previewAsset.storageObjectId,
    } : null,
    updatedAt: run.updatedAt,
  };
} });

export const claim = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number() }, handler: async (ctx, args) => {
  const run = await ctx.db.get(args.runId);
  if (!run || run.attempt !== args.attempt || run.status !== "queued") return null;
  const now = Date.now();
  await ctx.db.patch(run._id, { status: "running", startedAt: run.startedAt ?? now, updatedAt: now });
  return run;
} });

export const claimWorkflowStage = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number() }, handler: async (ctx, args) => {
  const run = await ctx.db.get(args.runId);
  if (!run || run.attempt !== args.attempt || run.status !== "queued") return null;
  const now = Date.now();
  await ctx.db.patch(run._id, { status: "running", startedAt: run.startedAt ?? now, updatedAt: now });
  if (run.stage === "render") {
    if (!run.renderJobId) throw new Error("Render task missing");
    return { kind: "render" as const, generationJobId: run.renderJobId };
  }
  const promptCompositionId = run.stage === "palette" ? run.paletteId : run.specificationId;
  if (!promptCompositionId) throw new Error("Planning task missing");
  return { kind: run.stage, promptCompositionId };
} });

async function advanceRun(ctx: MutationCtx, args: { runId: Id<"creationRuns">; attempt: number }, scheduleLegacyStep: boolean) {
  const run = await ctx.db.get(args.runId);
  if (!run || run.attempt !== args.attempt || run.status !== "running") return "ignored" as const;
  const input = JSON.parse(run.inputJson) as RunInput;
  const viewerCtx = await viewerContext(ctx, run.userId);
  if (run.stage === "palette") {
    const palette = run.paletteId ? await ctx.db.get(run.paletteId) : null;
    if (palette?.status !== "consumed") throw new Error("Color planning did not finish");
    const result = await initializeConcept(viewerCtx, { ...input, paletteCompositionId: palette._id, visibility: "private", requestKey: `run:${run._id}:spec:${run.attempt}` }, true);
    await ctx.db.patch(result.promptCompositionId, { creationRunId: run._id, creationAttempt: run.attempt });
    await ctx.db.patch(result.generationJobId, { creationRunId: run._id, creationAttempt: run.attempt });
    await ctx.db.patch(run._id, { conceptId: result.conceptId, specificationId: result.promptCompositionId, stage: "specification", status: "queued", updatedAt: Date.now() });
  } else if (run.stage === "specification") {
    const spec = run.specificationId ? await ctx.db.get(run.specificationId) : null;
    if (spec?.status !== "consumed" || !run.conceptId) throw new Error("Build planning did not finish");
    const result = await queueConceptRender(viewerCtx, run.conceptId, "hd-render", undefined, true);
    await ctx.db.patch(result.generationJobId, { creationRunId: run._id, creationAttempt: run.attempt });
    await ctx.db.patch(run._id, { renderJobId: result.generationJobId, stage: "render", status: "queued", updatedAt: Date.now() });
  } else {
    const job = run.renderJobId ? await ctx.db.get(run.renderJobId) : null;
    if (job?.status !== "succeeded") throw new Error(job?.errorMessage ?? "Image generation did not finish");
    const now = Date.now();
    await ctx.db.patch(run._id, { status: "succeeded", completedAt: now, updatedAt: now });
    return "succeeded" as const;
  }
  if (scheduleLegacyStep) await ctx.scheduler.runAfter(0, internal.creationRunsNode.execute, args);
  return "queued" as const;
}

export const advance = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number() }, handler: (ctx, args) => {
  return advanceRun(ctx, args, true);
} });

export const advanceWorkflow = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number() }, handler: (ctx, args) => {
  return advanceRun(ctx, args, false);
} });

async function failRun(ctx: MutationCtx, runId: Id<"creationRuns">, attempt: number, reason: string) {
  const run = await ctx.db.get(runId);
  if (!run || run.attempt !== attempt || run.status === "succeeded" || run.refunded) return;
  if (run.renderJobId && (await ctx.db.get(run.renderJobId))?.status === "succeeded") {
    const now = Date.now();
    await ctx.db.patch(runId, { status: "succeeded", completedAt: now, updatedAt: now });
    return;
  }
  const debit = run.creditTransactionId
    ? await ctx.db.get(run.creditTransactionId)
    : await findDebitByReference(ctx, "creationRuns", runId);
  if (!debit) throw new Error("Credit debit transaction missing");
  await refundCreditTransaction(ctx, {
    debitTransactionId: debit._id,
    actionType: "generation-refund",
    metadata: {
      referenceTable: "creationRuns",
      referenceId: runId,
      description: "Full preview refund",
    },
  });
  const now = Date.now();
  await ctx.db.patch(runId, { status: "failed", refunded: true, error: reason.slice(0, 500), completedAt: now, updatedAt: now });
  for (const id of [run.paletteId, run.specificationId]) {
    if (!id) continue;
    const composition = await ctx.db.get(id);
    if (composition?.status === "ready") await ctx.db.patch(id, { status: "failed", failureReason: reason });
    if (composition?.generationJobId && composition.status !== "consumed") await ctx.db.patch(composition.generationJobId, { status: "failed", errorMessage: reason });
  }
  if (run.renderJobId) {
    const job = await ctx.db.get(run.renderJobId);
    if (job && job.status !== "succeeded") await ctx.db.patch(job._id, { status: "failed", errorMessage: reason });
    await ctx.scheduler.runAfter(0, internal.storageAccounting.releaseGenerationStorageReservation, { generationJobId: run.renderJobId });
  }
}
export const fail = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number(), reason: v.string() }, handler: (ctx, args) => failRun(ctx, args.runId, args.attempt, args.reason) });
export const expire = internalMutation({ args: { runId: v.id("creationRuns"), attempt: v.number() }, handler: (ctx, args) => failRun(ctx, args.runId, args.attempt, "Preview timed out. Your credits were returned") });

export const completeWorkflow = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ runId: v.id("creationRuns"), attempt: v.number() }),
  },
  handler: async (ctx, { workflowId, result, context }) => {
    const run = await ctx.db.get(context.runId);
    if (run && run.attempt === context.attempt && run.workflowId === workflowId) {
      if (result.kind === "failed") {
        await failRun(ctx, context.runId, context.attempt, result.error);
      } else if (result.kind === "canceled") {
        await failRun(ctx, context.runId, context.attempt, "Preview generation was canceled");
      } else if (run.status !== "succeeded" && run.status !== "failed") {
        await failRun(ctx, context.runId, context.attempt, "Preview workflow stopped before completion");
      }
    }
    await creationWorkflowManager.cleanup(ctx, workflowId);
  },
});

export const retry = mutation({ args: { runId: v.id("creationRuns") }, handler: async (ctx, { runId }) => {
  const viewer = ctx.viewerX();
  const run = await ctx.db.get(runId);
  if (!run || run.userId !== viewer._id || viewer.accountStatus === "suspended") throw new Error("Preview unavailable");
  if (run.status !== "failed" || !run.refunded) return runId;
  const runs = await ctx.db.query("creationRuns").withIndex("by_user", q => q.eq("userId", viewer._id)).collect();
  if (runs.some(row => row.status === "queued" || row.status === "running")) throw new Error("A preview is already in progress");
  const input = JSON.parse(run.inputJson) as RunInput;
  const palette = run.paletteId ? await ctx.db.get(run.paletteId) : null;
  const specification = run.specificationId ? await ctx.db.get(run.specificationId) : null;
  await reserve(ctx, viewer._id, runId, run.cost);
  const attempt = run.attempt + 1;
  if (palette?.status !== "consumed") {
    const paletteId = await beginCreative(ctx, { ...input, kind: "palette-plan", requestKey: `run:${runId}:palette:${attempt}` }, true);
    await ctx.db.patch(paletteId, { creationRunId: runId, creationAttempt: attempt });
    await ctx.db.patch(runId, { paletteId, stage: "palette" });
  } else if (specification?.status !== "consumed") {
    // Advance from the saved palette. Reuse the existing concept if a spec job exists.
    if (specification) {
      const { _id: _id, _creationTime: _time, ...fields } = specification;
      const specificationId = await ctx.db.insert("promptCompositions", { ...fields, status: "ready", executionStartedAt: undefined, failureReason: undefined,
        creationAttempt: attempt, requestKey: `run:${runId}:spec:${attempt}` });
      if (fields.generationJobId) await ctx.db.patch(fields.generationJobId, { promptCompositionId: specificationId, status: "queued", errorMessage: undefined, creationAttempt: attempt });
      await ctx.db.patch(runId, { stage: "specification", specificationId });
    } else await ctx.db.patch(runId, { stage: "palette" });
  } else {
    const render = await queueConceptRender(ctx, run.conceptId!, "hd-render", undefined, true);
    await ctx.db.patch(render.generationJobId, { creationRunId: runId, creationAttempt: attempt });
    await ctx.db.patch(runId, { stage: "render", renderJobId: render.generationJobId });
  }
  const now = Date.now();
  await ctx.db.patch(runId, { attempt, status: "queued", refunded: false, error: undefined,
    workflowId: undefined, queuedAt: now, startedAt: undefined, completedAt: undefined, updatedAt: now });
  const workflowId = await creationWorkflowManager.start(
    ctx,
    internal.creationWorkflow.execute,
    { runId, attempt },
    {
      startAsync: true,
      onComplete: internal.creationRuns.completeWorkflow,
      context: { runId, attempt },
    }
  );
  await ctx.db.patch(runId, { workflowId });
  await ctx.scheduler.runAfter(25 * 60 * 1000, internal.creationRuns.expire, { runId, attempt });
  return runId;
} });

export const jobIsRunnable = internalQuery({ args: { generationJobId: v.id("generationJobs") }, handler: async (ctx, { generationJobId }) => {
  const job = await ctx.db.get(generationJobId);
  if (!job) return false;
  if (!job.creationRunId) return true;
  const run = await ctx.db.get(job.creationRunId);
  return Boolean(run && run.status === "running" && run.attempt === job.creationAttempt);
} });
