import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

export const listViewerJobs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (viewer === null) {
      return [];
    }

    const jobs = await ctx.db
      .query("generationJobs")
      .withIndex("by_user_status", (q) => q.eq("userId", viewer._id))
      .order("desc")
      .collect();

    return jobs.map((job) => ({
      _id: job._id,
      kind: job.kind,
      renderMode: safeRenderMode(job.inputSnapshotJson, job.outputSummaryJson),
      simulationStage: safeSimulationStage(job.inputSnapshotJson, job.outputSummaryJson),
      status: job.status,
      provider: job.provider,
      conceptId: job.conceptId,
      requestedCredits: job.requestedCredits,
      errorMessage: job.errorMessage,
      outputAssetId: job.outputAssetId,
      _creationTime: job._creationTime,
    }));
  },
});

export const getViewerJobSnapshot = query({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (viewer === null) {
      return null;
    }

    const job = await ctx.db.get(generationJobId);
    if (job === null || job.userId !== viewer._id) {
      return null;
    }

    const [concept, outputAsset, promptComposition] = await Promise.all([
      job.conceptId ? ctx.db.get(job.conceptId) : null,
      job.outputAssetId ? ctx.db.get(job.outputAssetId) : null,
      job.promptCompositionId ? ctx.db.get(job.promptCompositionId) : null,
    ]);

    const outputSummary = safeOutputSummary(job.outputSummaryJson);

    return {
      _id: job._id,
      _creationTime: job._creationTime,
      kind: job.kind,
      renderMode: safeRenderMode(job.inputSnapshotJson, job.outputSummaryJson),
      simulationStage: safeSimulationStage(job.inputSnapshotJson, job.outputSummaryJson),
      status: job.status,
      provider: job.provider,
      providerJobId: job.providerJobId,
      requestedCredits: job.requestedCredits,
      errorMessage: job.errorMessage,
      outputSummary,
      concept: concept
        ? {
            _id: concept._id,
            title: concept.title,
            status: concept.status,
            notes: concept.notes,
            weatheringLevel: concept.weatheringLevel,
          }
        : null,
      promptComposition: promptComposition
        ? {
            _id: promptComposition._id,
            status: promptComposition.status,
          }
        : null,
      asset: outputAsset
        ? {
            _id: outputAsset._id,
            key: outputAsset.key,
            contentType: outputAsset.contentType,
            publicUrl: outputAsset.publicUrl,
            status: outputAsset.status,
          }
        : null,
    };
  },
});

export const getJobForExecution = internalQuery({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    const job = await ctx.db.get(generationJobId);
    if (job === null || job.promptCompositionId === undefined || job.conceptId === undefined) {
      return null;
    }

    const [prompt, concept, user] = await Promise.all([
      ctx.db.get(job.promptCompositionId),
      ctx.db.get(job.conceptId),
      ctx.db.get(job.userId),
    ]);

    if (prompt === null || concept === null || user === null) {
      return null;
    }

      return {
        generationJobId: job._id,
        kind: job.kind,
        renderMode: safeRenderMode(job.inputSnapshotJson, job.outputSummaryJson),
        simulationStage: safeSimulationStage(job.inputSnapshotJson, job.outputSummaryJson),
        status: job.status,
        concept,
      prompt: {
        _id: prompt._id,
        composedPrompt: prompt.composedPrompt,
        negativePrompt: prompt.negativePrompt,
        templateVersion: safeTemplateVersion(prompt.outputSummaryJson),
      },
      user,
    };
  },
});

export const markJobRunning = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
    kind: v.union(v.literal("palette-plan"), v.literal("hd-preview")),
    renderMode: v.optional(
      v.union(
        v.literal("hd-render"),
        v.literal("multi-angle-preview"),
        v.literal("high-fidelity-render"),
        v.literal("build-stage-visualization"),
        v.literal("weathering-simulation")
      )
    ),
    simulationStage: v.optional(
      v.union(
        v.literal("primer-pass"),
        v.literal("decal-pass"),
        v.literal("weathering-pass")
      )
    ),
  },
  handler: async (ctx, { generationJobId, kind, renderMode, simulationStage }) => {
    await ctx.db.patch(generationJobId, {
      status: "running",
      errorMessage: undefined,
      outputSummaryJson: JSON.stringify({
        phase: "running",
        generationKind: kind,
        renderMode,
        simulationStage,
        label:
          kind === "hd-preview"
            ? renderMode === "multi-angle-preview"
              ? "RENDERING MULTI-ANGLE PREVIEW"
              : renderMode === "high-fidelity-render"
                ? "RENDERING HIGH-FIDELITY PREVIEW"
                : renderMode === "build-stage-visualization"
                  ? `RENDERING ${getSimulationStageLabel(simulationStage).toUpperCase()} VISUALIZATION`
                : renderMode === "weathering-simulation"
                  ? "RENDERING WEATHERING SIMULATION"
                : "RENDERING HD PREVIEW"
            : "COMPOSING SPRAY PLAN",
      }),
    });
  },
});

export const markJobSucceeded = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
    conceptId: v.id("concepts"),
    promptCompositionId: v.id("promptCompositions"),
    provider: v.union(v.literal("internal"), v.literal("openai")),
    providerJobId: v.optional(v.string()),
    asset: v.object({
      userId: v.id("users"),
      key: v.string(),
      bucket: v.string(),
      kind: v.literal("preview"),
      contentType: v.string(),
      byteSize: v.number(),
      publicUrl: v.optional(v.string()),
      etag: v.optional(v.string()),
      status: v.literal("active"),
    }),
    outputSummaryJson: v.string(),
  },
  handler: async (
    ctx,
    { generationJobId, conceptId, promptCompositionId, provider, providerJobId, asset, outputSummaryJson }
  ) => {
    const assetId = await ctx.db.insert("assets", asset);
    await Promise.all([
      ctx.db.patch(generationJobId, {
        status: "succeeded",
        provider,
        providerJobId,
        outputAssetId: assetId,
        outputSummaryJson,
        errorMessage: undefined,
      }),
      ctx.db.patch(conceptId, {
        status: "generated",
        previewAssetId: assetId,
      }),
      ctx.db.patch(promptCompositionId, {
        status: "consumed",
      }),
    ]);
  },
});

export const markJobFailed = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
    errorMessage: v.string(),
    provider: v.union(v.literal("internal"), v.literal("openai")),
  },
  handler: async (ctx, { generationJobId, errorMessage, provider }) => {
    const job = await ctx.db.get(generationJobId);
    if (job === null) {
      return;
    }

    await ctx.db.patch(generationJobId, {
      status: "failed",
      provider,
      errorMessage,
      outputSummaryJson: JSON.stringify({
        phase: "failed",
        label: "OUTPUT UNSTABLE",
        errorMessage,
      }),
    });
  },
});

export const refundFailedJobCredits = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    const job = await ctx.db.get(generationJobId);
    if (job === null) {
      return;
    }

    const existingRefund = await ctx.db
      .query("creditTransactions")
      .withIndex("by_user_actionType", (q) =>
        q.eq("userId", job.userId).eq("actionType", "generation-refund")
      )
      .collect()
      .then((items) => items.find((item) => item.generationJobId === generationJobId));

    if (existingRefund !== undefined) {
      return;
    }

    const account = await ctx.db
      .query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", job.userId))
      .unique();
    if (account === null) {
      return;
    }

    const balanceAfter = account.balance + job.requestedCredits;
    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeSpent: Math.max(0, account.lifetimeSpent - job.requestedCredits),
      lastCreditEventAt: Date.now(),
    });
    await ctx.db.insert("creditTransactions", {
      userId: job.userId,
      actionType: "generation-refund",
      delta: job.requestedCredits,
      creditAmount: job.requestedCredits,
      balanceAfter,
      generationJobId,
      conceptId: job.conceptId,
      referenceTable: "generationJobs",
      referenceId: generationJobId,
      description: `Refunded failed generation job ${generationJobId}`,
    });
  },
});
function safeTemplateVersion(summaryJson?: string) {
  if (!summaryJson) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(summaryJson) as { templateVersion?: string };
    return parsed.templateVersion;
  } catch {
    return undefined;
  }
}

function safeOutputSummary(summaryJson?: string) {
  if (!summaryJson) {
    return null;
  }
  try {
      const parsed = JSON.parse(summaryJson) as {
        errorMessage?: string;
        generationKind?: "palette-plan" | "hd-preview";
        label?: string;
        mimeType?: string;
        phase?: string;
        provider?: "internal" | "openai";
        renderMode?:
          | "hd-render"
          | "multi-angle-preview"
          | "high-fidelity-render"
          | "build-stage-visualization"
          | "weathering-simulation";
        simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass";
        revisedPrompt?: string;
        templateVersion?: string;
      };
      return parsed;
  } catch {
    return null;
  }
}

function safeRenderMode(inputSnapshotJson?: string, outputSummaryJson?: string) {
  for (const payload of [outputSummaryJson, inputSnapshotJson]) {
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as {
        renderMode?:
          | "hd-render"
          | "multi-angle-preview"
          | "high-fidelity-render"
          | "build-stage-visualization"
          | "weathering-simulation";
      };
      if (parsed.renderMode) {
        return parsed.renderMode;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function safeSimulationStage(inputSnapshotJson?: string, outputSummaryJson?: string) {
  for (const payload of [outputSummaryJson, inputSnapshotJson]) {
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as {
        simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass";
      };
      if (parsed.simulationStage) {
        return parsed.simulationStage;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function getSimulationStageLabel(
  simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass"
) {
  if (simulationStage === "primer-pass") {
    return "Primer Pass";
  }
  if (simulationStage === "decal-pass") {
    return "Decal Pass";
  }
  if (simulationStage === "weathering-pass") {
    return "Weathering Pass";
  }
  return "Build Stage";
}
