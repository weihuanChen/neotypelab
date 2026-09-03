import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { vGenerationProvider } from "./domain";
import type { GenerationProvider } from "./domain";
import { canManagePlatform } from "./adminAccess";

export const getLlmProfileForConnectionTest = internalQuery({
  args: {
    profileId: v.id("llmProfiles"),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, { profileId, tokenIdentifier }) => {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    if (viewer === null || !canManagePlatform(viewer)) {
      throw new Error("Platform administrator access is required");
    }
    return await ctx.db.get(profileId);
  },
});

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

    const renderMode = safeRenderMode(job.inputSnapshotJson, job.outputSummaryJson);
    const simulationStage = safeSimulationStage(job.inputSnapshotJson, job.outputSummaryJson);
    const [prompt, concept, user] = await Promise.all([
      ctx.db.get(job.promptCompositionId),
      ctx.db.get(job.conceptId),
      ctx.db.get(job.userId),
    ]);

    if (prompt === null || concept === null || user === null) {
      return null;
    }

    const template = prompt.promptTemplateId ? await ctx.db.get(prompt.promptTemplateId) : null;
    const llmRoute = await selectImageLlmRoute(ctx, {
      generationKind: job.kind,
      promptTemplateId: prompt.promptTemplateId,
      renderMode,
      templateKind: template?.kind,
    });
    const generationPolicy = await readGenerationPolicy(ctx);

    return {
      generationJobId: job._id,
      kind: job.kind,
      renderMode,
      materialComparisonVariants: safeMaterialComparisonVariants(
        job.inputSnapshotJson,
        prompt.inputSnapshotJson
      ),
      simulationStage,
      status: job.status,
      concept,
      prompt: {
        _id: prompt._id,
        composedPrompt: prompt.composedPrompt,
        negativePrompt: prompt.negativePrompt,
        promptTemplateId: prompt.promptTemplateId,
        templateKind: template?.kind,
        templateName: template?.name,
        templateVersion: safeTemplateVersion(prompt.outputSummaryJson),
      },
      llmRoute,
      generationPolicy,
      user,
    };
  },
});

async function selectImageLlmRoute(
  ctx: QueryCtx,
  input: {
    generationKind: "palette-plan" | "hd-preview";
    promptTemplateId?: Id<"promptTemplates">;
    renderMode?:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison";
    templateKind?: "palette-plan" | "style-suggestion" | "repaint-concept" | "hd-render";
  }
) {
  const action = input.templateKind ??
    (input.generationKind === "hd-preview" ? "hd-render" : "palette-plan");
  const configuredRoutes = await ctx.db
    .query("generationProviderRoutes")
    .withIndex("by_action", (q) => q.eq("action", action))
    .collect();
  const configuredRoute = configuredRoutes.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (configuredRoute) {
    const [primary, fallback] = await Promise.all([
      ctx.db.get(configuredRoute.primaryProfileId),
      configuredRoute.fallbackProfileId
        ? ctx.db.get(configuredRoute.fallbackProfileId)
        : null,
    ]);
    const eligiblePrimary =
      primary !== null && primary.isActive && primary.capability === "image"
        ? primary
        : null;
    const eligibleFallback =
      fallback !== null && fallback.isActive && fallback.capability === "image"
        ? fallback
        : null;
    if (eligiblePrimary || eligibleFallback) {
      return {
        primary: serializeLlmRoute(eligiblePrimary ?? eligibleFallback!, null),
        fallback:
          eligiblePrimary && eligibleFallback
            ? serializeLlmRoute(eligibleFallback, null)
            : null,
      };
    }
  }

  if (input.promptTemplateId !== undefined) {
    const bindings = await ctx.db
      .query("promptTemplateBindings")
      .withIndex("by_template", (q) => q.eq("promptTemplateId", input.promptTemplateId!))
      .collect();
    const candidates = (
      await Promise.all(
        bindings
          .filter((binding) => isBindingEligible(binding, input))
          .map(async (binding) => {
            const profile = await ctx.db.get(binding.llmProfileId);
            if (profile === null || !profile.isActive || profile.capability !== "image") {
              return null;
            }
            return { binding, profile };
          })
      )
    ).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    const selected = candidates.sort((a, b) => {
      const scoreDelta = bindingScore(b.binding) - bindingScore(a.binding);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const priorityDelta = b.binding.priority - a.binding.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return b.profile.priority - a.profile.priority;
    })[0];

    if (selected) {
      return { primary: serializeLlmRoute(selected.profile, selected.binding), fallback: null };
    }
  }

  const fallbackProfile = (
    await ctx.db
      .query("llmProfiles")
      .withIndex("by_capability", (q) => q.eq("capability", "image"))
      .collect()
  )
    .filter((profile) => profile.isActive)
    .sort((a, b) => b.priority - a.priority)[0];

  return fallbackProfile
    ? { primary: serializeLlmRoute(fallbackProfile, null), fallback: null }
    : null;
}

async function readGenerationPolicy(ctx: QueryCtx): Promise<{
  fallbackBehavior: "secondary-provider" | "retry-primary" | "fail-job";
  maxRetryCount: number;
  timeoutMs: number;
  failureCreditPolicy: "auto-refund" | "manual-review" | "no-refund";
}> {
  const records = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", "generation"))
    .collect();
  const current = records.sort(
    (a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt
  )[0];
  let parsed: Record<string, unknown> = {};
  if (current) {
    try {
      const candidate = JSON.parse(current.valueJson) as unknown;
      if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }
  return {
    fallbackBehavior:
      parsed.fallbackBehavior === "retry-primary" ||
      parsed.fallbackBehavior === "fail-job"
        ? parsed.fallbackBehavior
        : "secondary-provider" as const,
    maxRetryCount: boundedPolicyNumber(parsed.maxRetryCount, 0, 3, 1),
    timeoutMs: boundedPolicyNumber(parsed.timeoutSeconds, 15, 300, 90) * 1000,
    failureCreditPolicy:
      parsed.failureCreditPolicy === "manual-review" ||
      parsed.failureCreditPolicy === "no-refund"
        ? parsed.failureCreditPolicy
        : "auto-refund" as const,
  };
}

function boundedPolicyNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isBindingEligible(
  binding: {
    generationKind?: "palette-plan" | "hd-preview";
    isActive: boolean;
    renderMode?:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison";
    templateKind: "palette-plan" | "style-suggestion" | "repaint-concept" | "hd-render";
  },
  input: {
    generationKind: "palette-plan" | "hd-preview";
    renderMode?:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison";
    templateKind?: "palette-plan" | "style-suggestion" | "repaint-concept" | "hd-render";
  }
) {
  if (!binding.isActive) {
    return false;
  }
  if (input.templateKind !== undefined && binding.templateKind !== input.templateKind) {
    return false;
  }
  if (binding.generationKind !== undefined && binding.generationKind !== input.generationKind) {
    return false;
  }
  return binding.renderMode === undefined || binding.renderMode === input.renderMode;
}

function bindingScore(binding: {
  generationKind?: "palette-plan" | "hd-preview";
  isDefault: boolean;
  renderMode?:
    | "hd-render"
    | "multi-angle-preview"
    | "high-fidelity-render"
    | "build-stage-visualization"
    | "weathering-simulation"
    | "weathering-split-preview"
    | "material-finish-comparison";
}) {
  return (
    (binding.isDefault ? 8 : 0) +
    (binding.renderMode !== undefined ? 4 : 0) +
    (binding.generationKind !== undefined ? 2 : 0)
  );
}

function serializeLlmRoute(
  profile: {
    _id: Id<"llmProfiles">;
    apiFormat: "openai-compatible";
    baseUrl: string;
    headersJson?: string;
    keyEnvName: string;
    modelId: string;
    name: string;
    provider:
      | "openai"
      | "openrouter"
      | "portkey"
      | "litellm"
      | "vercel-ai-gateway"
      | "custom-openai-compatible";
    requestDefaultsJson?: string;
    slug: string;
    timeoutMs?: number;
  },
  binding: {
    _id: Id<"promptTemplateBindings">;
    parameterOverridesJson?: string;
    priority: number;
  } | null
) {
  return {
    profile: {
      _id: profile._id,
      apiFormat: profile.apiFormat,
      baseUrl: profile.baseUrl,
      headersJson: profile.headersJson,
      keyEnvName: profile.keyEnvName,
      modelId: profile.modelId,
      name: profile.name,
      provider: profile.provider,
      requestDefaultsJson: profile.requestDefaultsJson,
      slug: profile.slug,
      timeoutMs: profile.timeoutMs,
    },
    binding: binding
      ? {
          _id: binding._id,
          parameterOverridesJson: binding.parameterOverridesJson,
          priority: binding.priority,
        }
      : null,
  };
}

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
        v.literal("weathering-simulation"),
        v.literal("weathering-split-preview"),
        v.literal("material-finish-comparison")
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
              ? "RENDERING MULTI-ANGLE CONTACT SHEET"
              : renderMode === "high-fidelity-render"
                ? "RENDERING HIGH-FIDELITY PREVIEW"
                : renderMode === "build-stage-visualization"
                  ? `RENDERING ${getSimulationStageLabel(simulationStage).toUpperCase()} VISUALIZATION`
                : renderMode === "weathering-simulation"
                  ? "RENDERING WEATHERING SIMULATION"
                : renderMode === "weathering-split-preview"
                  ? "RENDERING BEFORE / AFTER WEATHERING SPLIT"
                : renderMode === "material-finish-comparison"
                  ? "RENDERING MATERIAL FINISH COMPARISON"
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
    provider: vGenerationProvider,
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
    const job = await ctx.db.get(generationJobId);
    const assetId = await ctx.db.insert("assets", asset);

    const renderMode = safeRenderMode(job?.inputSnapshotJson, outputSummaryJson);
    const simulationStage = safeSimulationStage(job?.inputSnapshotJson, outputSummaryJson);
    const outputSummary = safeOutputSummary(outputSummaryJson);
    const shouldRecordRenderOutput = job?.kind === "hd-preview" && renderMode !== undefined;
    const shouldUpdateConceptPreview =
      job?.kind !== "hd-preview" || renderMode === undefined || renderMode === "hd-render";

    const existingRenderOutput =
      shouldRecordRenderOutput
        ? await ctx.db
            .query("renderOutputs")
            .withIndex("by_generationJobId", (q) => q.eq("generationJobId", generationJobId))
            .unique()
        : null;

    await Promise.all([
      ctx.db.patch(generationJobId, {
        status: "succeeded",
        provider,
        providerJobId,
        outputAssetId: assetId,
        outputSummaryJson,
        errorMessage: undefined,
      }),
      ctx.db.patch(
        conceptId,
        shouldUpdateConceptPreview
          ? {
              status: "generated",
              previewAssetId: assetId,
            }
          : {
              status: "generated",
            }
      ),
      ctx.db.patch(promptCompositionId, {
        status: "consumed",
      }),
      shouldRecordRenderOutput && existingRenderOutput === null
        ? ctx.db.insert("renderOutputs", {
            userId: asset.userId,
            conceptId,
            generationJobId,
            assetId,
            renderMode,
            simulationStage,
            label: buildRenderOutputLabel(renderMode, simulationStage, outputSummary?.label),
            status: "available",
            summaryJson: outputSummaryJson,
          })
        : Promise.resolve(),
    ]);
  },
});

export const markJobFailed = internalMutation({
  args: {
    generationJobId: v.id("generationJobs"),
    errorMessage: v.string(),
    provider: vGenerationProvider,
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
      layoutSpec?: string;
      materialComparisonVariants?: Array<{
        name: string;
        slug: string;
        finishType: string;
        reflectivityLevel?: string;
        paintFinish?: string;
        difficultyLevel?: string;
        sheenLevel?: string;
        role?: "current" | "comparison";
      }>;
      mimeType?: string;
      phase?: string;
      provider?: GenerationProvider;
      renderMode?:
        | "hd-render"
        | "multi-angle-preview"
        | "high-fidelity-render"
        | "build-stage-visualization"
        | "weathering-simulation"
        | "weathering-split-preview"
        | "material-finish-comparison";
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
          | "weathering-simulation"
          | "weathering-split-preview"
          | "material-finish-comparison";
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

function safeMaterialComparisonVariants(inputSnapshotJson?: string, promptSnapshotJson?: string) {
  for (const payload of [inputSnapshotJson, promptSnapshotJson]) {
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as {
        materialComparisonVariants?: Array<{
          name: string;
          slug: string;
          finishType: string;
          reflectivityLevel?: string;
          paintFinish?: string;
          difficultyLevel?: string;
          sheenLevel?: string;
          role?: "current" | "comparison";
        }>;
      };
      if (parsed.materialComparisonVariants) {
        return parsed.materialComparisonVariants;
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

function buildRenderOutputLabel(
  renderMode:
    | "hd-render"
    | "multi-angle-preview"
    | "high-fidelity-render"
    | "build-stage-visualization"
    | "weathering-simulation"
    | "weathering-split-preview"
    | "material-finish-comparison",
  simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass",
  summaryLabel?: string
) {
  if (renderMode === "build-stage-visualization") {
    return `${getSimulationStageLabel(simulationStage)} Visualization`;
  }
  if (renderMode === "multi-angle-preview") {
    return "Multi-angle Contact Sheet";
  }
  if (renderMode === "high-fidelity-render") {
    return "High-fidelity Render";
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
  if (summaryLabel) {
    return summaryLabel
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
  return "HD Render";
}
