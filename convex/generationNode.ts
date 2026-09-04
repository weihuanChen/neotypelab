"use node";

import { randomUUID } from "crypto";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { GenerationProvider } from "./domain";
import { getPublicR2ObjectUrl } from "./r2Config";
import {
  checkR2StorageConnectivity,
  uploadR2Object,
} from "./r2Storage";

const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_IMAGE_TIMEOUT_MS = 120000;

type StabilizeConceptPreviewResult =
  | {
      status: "already-configured";
      conceptId: string;
      conceptTitle: string;
      publicUrl: string;
    }
  | {
      status: "configured";
      conceptId: string;
      conceptTitle: string;
      publicUrl: string;
    };

type ViewerConceptPreviewAsset = {
  conceptId: string;
  conceptTitle: string;
  assetId: Id<"assets">;
  key: string;
  publicUrl?: string;
  visibility: "private" | "unlisted" | "public";
  status: "draft" | "generated" | "archived";
};

type MaterialComparisonVariant = {
  name: string;
  slug: string;
  finishType: string;
  reflectivityLevel?: string;
  paintFinish?: string;
  difficultyLevel?: string;
  sheenLevel?: string;
  role?: "current" | "comparison";
};

type GenerationKind = "palette-plan" | "hd-preview";

type RenderMode =
  | "hd-render"
  | "multi-angle-preview"
  | "high-fidelity-render"
  | "build-stage-visualization"
  | "weathering-simulation"
  | "weathering-split-preview"
  | "material-finish-comparison";

type SimulationStage = "primer-pass" | "decal-pass" | "weathering-pass";

type OpenAICompatibleProvider =
  | "openai"
  | "openrouter"
  | "portkey"
  | "litellm"
  | "vercel-ai-gateway"
  | "custom-openai-compatible";

type LlmRoute = {
  profile: {
    _id: Id<"llmProfiles">;
    apiFormat: "openai-compatible";
    baseUrl: string;
    headersJson?: string;
    keyEnvName: string;
    modelId: string;
    name: string;
    provider: OpenAICompatibleProvider;
    requestDefaultsJson?: string;
    slug: string;
    timeoutMs?: number;
  };
  binding: {
    _id: Id<"promptTemplateBindings">;
    parameterOverridesJson?: string;
    priority: number;
  } | null;
};

type LlmRoutePlan = {
  primary: LlmRoute;
  fallback?: LlmRoute | null;
};

type ExternalRouteProfile = Omit<LlmRoute["profile"], "_id"> & {
  _id?: Id<"llmProfiles">;
};

type ExternalImageRoute = {
  mode: "openai-compatible";
  provider: OpenAICompatibleProvider;
  profile: ExternalRouteProfile;
  binding: LlmRoute["binding"];
};

type ImageGenerationRoute =
  | {
      mode: "internal";
      provider: "internal";
    }
  | ExternalImageRoute;

type RouteSummary = {
  baseUrl: string;
  bindingId?: Id<"promptTemplateBindings">;
  bindingPriority?: number;
  modelId: string;
  profileId?: Id<"llmProfiles">;
  profileName: string;
  profileSlug: string;
  provider: OpenAICompatibleProvider;
};

export const rerunJob = action({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    await ctx.runAction(internal.generationNode.executeQueuedJob, { generationJobId });
  },
});

export const testLlmProfileConnection = action({
  args: {
    profileId: v.id("llmProfiles"),
  },
  handler: async (ctx, { profileId }): Promise<{
    ok: boolean;
    status?: number;
    latencyMs: number;
    message: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Authentication is required");
    const profile = await ctx.runQuery(internal.generation.getLlmProfileForConnectionTest, {
      profileId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (profile === null) throw new Error("Provider profile not found");
    const apiKey = process.env[profile.keyEnvName];
    if (!apiKey) {
      return {
        ok: false,
        latencyMs: 0,
        message: `${profile.keyEnvName} is not configured`,
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const startedAt = Date.now();
    try {
      const customHeaders = parseJsonObjectOrEmpty(profile.headersJson, "Provider headers");
      const response = await fetch(`${profile.baseUrl.replace(/\/+$/, "")}/models`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...Object.fromEntries(
            Object.entries(customHeaders).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          ),
        },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      return {
        ok: response.ok,
        status: response.status,
        latencyMs,
        message: response.ok
          ? `Connected to ${profile.name}`
          : `${profile.name} returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error && error.name === "AbortError"
            ? "Connection test timed out after 10 seconds"
            : error instanceof Error
              ? error.message
              : "Connection test failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});

export const testR2Connection = action({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
    buckets: Array<{
      role: "public" | "private";
      bucket: string;
      ok: boolean;
      latencyMs: number;
      message: string;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Authentication is required");
    await ctx.runQuery(internal.generation.assertPlatformAdminForConnectionTest, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    const buckets = await checkR2StorageConnectivity();
    const ok = buckets.every((bucket) => bucket.ok);
    return {
      ok,
      latencyMs: Math.max(...buckets.map((bucket) => bucket.latencyMs)),
      message: ok ? "Both R2 buckets passed all checks" : "One or more R2 checks failed",
      buckets,
    };
  },
});

export const stabilizeConceptPreviewAsset = action({
  args: {
    conceptId: v.id("concepts"),
  },
  handler: async (ctx, { conceptId }): Promise<StabilizeConceptPreviewResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Expected authenticated viewer");
    }

    const preview: ViewerConceptPreviewAsset | null = await ctx.runQuery(
      internal.concepts.getViewerConceptPreviewAsset,
      {
        conceptId,
        tokenIdentifier: identity.tokenIdentifier,
      }
    );

    if (preview === null) {
      throw new Error("Preview asset not found for this concept");
    }

    if (preview.publicUrl) {
      return {
        status: "already-configured" as const,
        conceptId: preview.conceptId,
        conceptTitle: preview.conceptTitle,
        publicUrl: preview.publicUrl,
      };
    }

    const publicUrl = getPublicR2ObjectUrl(preview.key);
    if (!publicUrl) {
      throw new Error(
        "No public asset delivery URL is configured. Set R2_PUBLIC_BASE_URL."
      );
    }

    await ctx.runMutation(internal.assets.setPublicUrl, {
      assetId: preview.assetId,
      publicUrl,
    });

    return {
      status: "configured" as const,
      conceptId: preview.conceptId,
      conceptTitle: preview.conceptTitle,
      publicUrl,
    };
  },
});

export const executeQueuedJob = internalAction({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    const job = await ctx.runQuery(internal.generation.getJobForExecution, {
      generationJobId,
    });
    if (job === null) {
      throw new Error("Generation job not found");
    }
    if (job.status !== "queued" && job.status !== "failed") {
      return;
    }

    await ctx.runMutation(internal.generation.markJobRunning, {
      generationJobId,
      kind: job.kind,
      renderMode: job.renderMode,
      simulationStage: job.simulationStage,
    });

    const routes = resolveImageGenerationRoutes(
      job.llmRoute,
      job.generationPolicy.timeoutMs
    );
    let attemptedProvider: GenerationProvider = routes[0].provider;

    try {
      const generated = await generateWithPolicy({
        routes,
        fallbackBehavior: job.generationPolicy.fallbackBehavior,
        maxRetryCount: job.generationPolicy.maxRetryCount,
        onAttempt: (provider) => {
          attemptedProvider = provider;
        },
        input: {
          kind: job.kind,
          renderMode: job.renderMode,
          simulationStage: job.simulationStage,
          materialComparisonVariants: job.materialComparisonVariants,
          prompt: job.prompt.composedPrompt,
          negativePrompt: job.prompt.negativePrompt,
          title: job.concept.title,
        },
      });
      attemptedProvider = generated.provider;

      const uploaded = await uploadR2Object("public", {
        buffer: generated.buffer,
        contentType: generated.contentType,
        key: buildAssetKey(job.user.handle, job.generationJobId, generated.contentType),
      });

      await ctx.runMutation(internal.generation.markJobSucceeded, {
        generationJobId,
        conceptId: job.concept._id,
        promptCompositionId: job.prompt._id,
        provider: generated.provider,
        providerJobId: generated.providerJobId,
        asset: {
          userId: job.user._id,
          key: uploaded.key,
          bucket: uploaded.bucket,
          kind: "preview",
          contentType: generated.contentType,
          byteSize: generated.buffer.byteLength,
          publicUrl: uploaded.publicUrl,
          etag: uploaded.etag,
          status: "active",
        },
        outputSummaryJson: JSON.stringify({
          phase: "succeeded",
          generationKind: job.kind,
          renderMode: job.renderMode,
          simulationStage: job.simulationStage,
          materialComparisonVariants: job.materialComparisonVariants,
          layoutSpec: getRenderLayoutSpec(job.renderMode),
          label:
            job.kind === "hd-preview"
              ? job.renderMode === "multi-angle-preview"
                ? "MULTI-ANGLE CONTACT SHEET STABILIZED"
                : job.renderMode === "high-fidelity-render"
                  ? "HIGH-FIDELITY RENDER STABILIZED"
                  : job.renderMode === "build-stage-visualization"
                    ? `${getSimulationStageLabel(job.simulationStage).toUpperCase()} VISUALIZATION STABILIZED`
                    : job.renderMode === "weathering-simulation"
                      ? "WEATHERING SIMULATION STABILIZED"
                    : job.renderMode === "weathering-split-preview"
                      ? "BEFORE / AFTER WEATHERING SPLIT STABILIZED"
                      : job.renderMode === "material-finish-comparison"
                        ? "MATERIAL FINISH COMPARISON STABILIZED"
                        : "HD RENDER STABILIZED"
                      : "OUTPUT STABILIZED",
          provider: generated.provider,
          llmRoute: generated.routeSummary,
          promptTemplateId: job.prompt.promptTemplateId,
          promptTemplateKind: job.prompt.templateKind,
          promptTemplateName: job.prompt.templateName,
          templateVersion: job.prompt.templateVersion,
          revisedPrompt: generated.revisedPrompt,
          mimeType: generated.contentType,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation failure";
      await ctx.runMutation(internal.generation.markJobFailed, {
        generationJobId,
        errorMessage: message,
        provider: attemptedProvider,
      });
      if (job.generationPolicy.failureCreditPolicy === "auto-refund") {
        await ctx.runMutation(internal.generation.refundFailedJobCredits, {
          generationJobId,
        });
      }
    }
  },
});

async function generateWithPolicy({
  fallbackBehavior,
  input,
  maxRetryCount,
  onAttempt,
  routes,
}: {
  fallbackBehavior: "secondary-provider" | "retry-primary" | "fail-job";
  input: Omit<Parameters<typeof generateImage>[0], "route">;
  maxRetryCount: number;
  onAttempt: (provider: GenerationProvider) => void;
  routes: ImageGenerationRoute[];
}) {
  const candidates = fallbackBehavior === "secondary-provider" ? routes : routes.slice(0, 1);
  const retryCount = fallbackBehavior === "fail-job" ? 0 : maxRetryCount;
  let lastError: unknown;
  for (const route of candidates) {
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      onAttempt(route.provider);
      try {
        return await generateImage({ ...input, route });
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Generation failed");
}

async function generateImage({
  kind,
  renderMode,
  simulationStage,
  materialComparisonVariants,
  route,
  prompt,
  negativePrompt,
  title,
}: {
  kind: GenerationKind;
  renderMode?: RenderMode;
  simulationStage?: SimulationStage;
  materialComparisonVariants?: MaterialComparisonVariant[];
  route: ImageGenerationRoute;
  prompt: string;
  negativePrompt?: string | null;
  title: string;
}) {
  if (route.mode === "openai-compatible") {
    return await generateWithOpenAICompatibleImage({
      prompt,
      negativePrompt,
      renderMode,
      simulationStage,
      route,
    });
  }

  const generated = generateInternalPreview({
    kind,
    renderMode,
    simulationStage,
    materialComparisonVariants,
    prompt,
    title,
  });
  return {
    ...generated,
    provider: "internal" as const,
    routeSummary: undefined,
  };
}

async function generateWithOpenAICompatibleImage({
  prompt,
  negativePrompt,
  renderMode,
  simulationStage,
  route,
}: {
  prompt: string;
  negativePrompt?: string | null;
  renderMode?: RenderMode;
  simulationStage?: SimulationStage;
  route: ExternalImageRoute;
}) {
  const apiKey = process.env[route.profile.keyEnvName];
  if (!apiKey) {
    throw new Error(
      `LLM profile "${route.profile.name}" requires ${route.profile.keyEnvName}, but it is not configured`
    );
  }

  const timeoutMs = route.profile.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(buildOpenAICompatibleImageUrl(route.profile.baseUrl), {
      method: "POST",
      headers: buildOpenAICompatibleHeaders(route, apiKey),
      body: JSON.stringify(
        buildOpenAICompatibleImageBody({
          negativePrompt,
          prompt,
          renderMode,
          route,
          simulationStage,
        })
      ),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`LLM image generation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${route.profile.name} image generation failed: ${response.status} ${truncateErrorBody(
        body
      )}`
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
    id?: string;
  };
  const image = payload.data?.[0];
  if (!image) {
    throw new Error(`${route.profile.name} image generation returned no image payload`);
  }

  if (image.b64_json) {
    return {
      provider: route.provider,
      routeSummary: summarizeRoute(route),
      providerJobId: getProviderRequestId(response, payload.id),
      revisedPrompt: image.revised_prompt,
      contentType: "image/png",
      buffer: Buffer.from(image.b64_json, "base64"),
    };
  }

  if (image.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      const body = await imageResponse.text();
      throw new Error(
        `${route.profile.name} image download failed: ${imageResponse.status} ${truncateErrorBody(
          body
        )}`
      );
    }

    return {
      provider: route.provider,
      routeSummary: summarizeRoute(route),
      providerJobId: getProviderRequestId(response, payload.id),
      revisedPrompt: image.revised_prompt,
      contentType: imageResponse.headers.get("content-type") ?? "image/png",
      buffer: Buffer.from(await imageResponse.arrayBuffer()),
    };
  }

  throw new Error(`${route.profile.name} image generation returned no usable image payload`);
}

function resolveImageGenerationRoutes(
  llmRoutePlan: LlmRoutePlan | null | undefined,
  defaultTimeoutMs: number
): ImageGenerationRoute[] {
  if (llmRoutePlan !== undefined && llmRoutePlan !== null) {
    return [llmRoutePlan.primary, llmRoutePlan.fallback]
      .filter((route): route is LlmRoute => route !== undefined && route !== null)
      .map((route) => ({
        mode: "openai-compatible" as const,
        provider: route.profile.provider,
        profile: {
          ...route.profile,
          timeoutMs: route.profile.timeoutMs ?? defaultTimeoutMs,
        },
        binding: route.binding,
      }));
  }

  if (process.env.OPENAI_API_KEY) {
    return [{
      mode: "openai-compatible",
      provider: "openai",
      profile: {
        apiFormat: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        keyEnvName: "OPENAI_API_KEY",
        modelId: process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
        name: "OpenAI env fallback",
        provider: "openai",
        slug: "openai-env-fallback",
        timeoutMs: defaultTimeoutMs,
      },
      binding: null,
    }];
  }

  return [{
    mode: "internal",
    provider: "internal",
  }];
}

function buildOpenAICompatibleImageUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/images/generations`;
}

function buildOpenAICompatibleHeaders(route: ExternalImageRoute, apiKey: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const customHeaders = parseJsonObjectOrEmpty(route.profile.headersJson, "LLM profile headers");
  for (const [key, value] of Object.entries(customHeaders)) {
    if (typeof value !== "string") {
      throw new Error(`LLM profile header "${key}" must be a string`);
    }
    headers[key] = interpolateTemplateString(value, {
      apiKey,
      modelId: route.profile.modelId,
    });
  }
  return headers;
}

function buildOpenAICompatibleImageBody({
  negativePrompt,
  prompt,
  renderMode,
  route,
  simulationStage,
}: {
  negativePrompt?: string | null;
  prompt: string;
  renderMode?: RenderMode;
  route: ExternalImageRoute;
  simulationStage?: SimulationStage;
}) {
  const defaultBody: Record<string, unknown> = {
    model: route.profile.modelId,
    prompt,
    size: "1024x1024",
    quality: getDefaultImageQuality(renderMode),
    output_format: "png",
    background: "opaque",
  };
  const profileDefaults = parseJsonObjectOrEmpty(
    route.profile.requestDefaultsJson,
    "LLM profile request defaults"
  );
  const bindingOverrides = parseJsonObjectOrEmpty(
    route.binding?.parameterOverridesJson,
    "Prompt template binding overrides"
  );
  const body = interpolateJsonValue(
    mergeJsonObjects(defaultBody, profileDefaults, bindingOverrides),
    {
      modelId: route.profile.modelId,
      negativePrompt: negativePrompt ?? "",
      prompt,
      renderMode: renderMode ?? "",
      simulationStage: simulationStage ?? "",
    }
  );

  if (!isPlainObject(body)) {
    throw new Error("LLM image request body must be a JSON object");
  }

  body.prompt = prompt;
  return body;
}

function getDefaultImageQuality(renderMode?: RenderMode) {
  return renderMode === "high-fidelity-render" ||
    renderMode === "build-stage-visualization" ||
    renderMode === "weathering-simulation" ||
    renderMode === "weathering-split-preview" ||
    renderMode === "material-finish-comparison"
    ? "high"
    : "medium";
}

function parseJsonObjectOrEmpty(value: string | undefined, label: string) {
  if (value === undefined || value.trim().length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function mergeJsonObjects(...objects: Array<Record<string, unknown>>) {
  const output: Record<string, unknown> = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      const existing = output[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        output[key] = mergeJsonObjects(existing, value);
      } else {
        output[key] = value;
      }
    }
  }
  return output;
}

function interpolateJsonValue(
  value: unknown,
  values: Record<string, string>
): unknown {
  if (typeof value === "string") {
    return interpolateTemplateString(value, values);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateJsonValue(item, values));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateJsonValue(item, values)])
    );
  }
  return value;
}

function interpolateTemplateString(value: string, values: Record<string, string>) {
  return value
    .replace(/\{\{env:([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name: string) => process.env[name] ?? "")
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeRoute(route: ExternalImageRoute): RouteSummary {
  return {
    baseUrl: route.profile.baseUrl,
    bindingId: route.binding?._id,
    bindingPriority: route.binding?.priority,
    modelId: route.profile.modelId,
    profileId: route.profile._id,
    profileName: route.profile.name,
    profileSlug: route.profile.slug,
    provider: route.provider,
  };
}

function getProviderRequestId(response: Response, payloadId?: string) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("x-openai-request-id") ??
    response.headers.get("x-portkey-request-id") ??
    response.headers.get("x-litellm-call-id") ??
    payloadId ??
    undefined
  );
}

function truncateErrorBody(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 1000 ? `${trimmed.slice(0, 1000)}...` : trimmed;
}

function generateInternalPreview({
  kind,
  renderMode,
  simulationStage,
  materialComparisonVariants,
  prompt,
  title,
}: {
  kind: GenerationKind;
  renderMode?: RenderMode;
  simulationStage?: SimulationStage;
  materialComparisonVariants?: MaterialComparisonVariant[];
  prompt: string;
  title: string;
}) {
  const renderLabel =
    kind === "hd-preview"
      ? renderMode === "multi-angle-preview"
        ? "MULTI-ANGLE CONTACT SHEET / INTERNAL RENDERER"
        : renderMode === "high-fidelity-render"
          ? "HIGH-FIDELITY RENDER / INTERNAL RENDERER"
          : renderMode === "build-stage-visualization"
            ? `${getSimulationStageLabel(simulationStage).toUpperCase()} / INTERNAL RENDERER`
            : renderMode === "weathering-simulation"
              ? "WEATHERING SIMULATION / INTERNAL RENDERER"
            : renderMode === "weathering-split-preview"
              ? "BEFORE / AFTER WEATHERING SPLIT / INTERNAL RENDERER"
              : renderMode === "material-finish-comparison"
                ? "MATERIAL FINISH COMPARISON / INTERNAL RENDERER"
                : "HD RENDER / INTERNAL RENDERER"
      : "PROTOTYPE PREVIEW / INTERNAL RENDERER";
  const statusLabel =
    kind === "hd-preview"
      ? renderMode === "multi-angle-preview"
        ? "SIMULATION STATUS: CONTACT SHEET STABILIZED"
        : renderMode === "high-fidelity-render"
          ? "SIMULATION STATUS: HIGH-FIDELITY RENDER STABILIZED"
          : renderMode === "build-stage-visualization"
            ? `SIMULATION STATUS: ${getSimulationStageLabel(simulationStage).toUpperCase()} VISUALIZATION STABILIZED`
            : renderMode === "weathering-simulation"
              ? "SIMULATION STATUS: WEATHERING SIMULATION STABILIZED"
            : renderMode === "weathering-split-preview"
              ? "SIMULATION STATUS: WEATHERING SPLIT STABILIZED"
              : renderMode === "material-finish-comparison"
                ? "SIMULATION STATUS: MATERIAL FINISH COMPARISON STABILIZED"
                : "SIMULATION STATUS: HD RENDER STABILIZED"
      : "SIMULATION STATUS: OUTPUT STABILIZED";

  if (kind === "hd-preview" && renderMode === "multi-angle-preview") {
    return {
      providerJobId: undefined,
      revisedPrompt: undefined,
      contentType: "image/svg+xml",
      buffer: Buffer.from(
        buildInternalContactSheetSvg({
          title,
          renderLabel,
          statusLabel,
          prompt,
        }),
        "utf8"
      ),
    };
  }

  if (kind === "hd-preview" && renderMode === "weathering-split-preview") {
    return {
      providerJobId: undefined,
      revisedPrompt: undefined,
      contentType: "image/svg+xml",
      buffer: Buffer.from(
        buildInternalWeatheringSplitSvg({
          title,
          renderLabel,
          statusLabel,
          prompt,
        }),
        "utf8"
      ),
    };
  }

  if (kind === "hd-preview" && renderMode === "material-finish-comparison") {
    return {
      providerJobId: undefined,
      revisedPrompt: undefined,
      contentType: "image/svg+xml",
      buffer: Buffer.from(
        buildInternalMaterialFinishComparisonSvg({
          title,
          renderLabel,
          statusLabel,
          prompt,
          variants: materialComparisonVariants,
        }),
        "utf8"
      ),
    };
  }

  const lines = wrapText(prompt, 68).slice(0, 9);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0D1117"/>
  <rect x="48" y="48" width="928" height="928" rx="32" fill="#11161D" stroke="#2B3440"/>
  <rect x="84" y="84" width="856" height="856" rx="24" fill="#161B22" stroke="rgba(255,255,255,0.08)"/>
  <text x="112" y="156" fill="#3DD9FF" font-size="22" font-family="monospace" letter-spacing="6">${escapeXml(renderLabel)}</text>
  <text x="112" y="228" fill="#E6EDF3" font-size="44" font-family="Arial">${escapeXml(title)}</text>
  <text x="112" y="286" fill="#58FFB2" font-size="18" font-family="monospace">${escapeXml(statusLabel)}</text>
  <rect x="112" y="332" width="800" height="2" fill="#2B3440"/>
  <text x="112" y="392" fill="#9BA7B4" font-size="20" font-family="monospace">COMPOSED PROMPT</text>
  ${lines
    .map(
      (line, index) =>
        `<text x="112" y="${440 + index * 40}" fill="#E6EDF3" font-size="24" font-family="monospace">${escapeXml(
          line
        )}</text>`
    )
    .join("\n")}
  <rect x="112" y="812" width="800" height="96" rx="18" fill="#0D1117" stroke="#3A4654"/>
  <text x="144" y="868" fill="#FFB84D" font-size="20" font-family="monospace">No external image route configured. Internal renderer used for execution.</text>
</svg>`;

  return {
    providerJobId: undefined,
    revisedPrompt: undefined,
    contentType: "image/svg+xml",
    buffer: Buffer.from(svg, "utf8"),
  };
}

function buildInternalContactSheetSvg({
  title,
  renderLabel,
  statusLabel,
  prompt,
}: {
  title: string;
  renderLabel: string;
  statusLabel: string;
  prompt: string;
}) {
  const promptLines = wrapText(prompt, 74).slice(0, 3);
  const panels = [
    {
      label: "FRONT",
      x: 92,
      y: 252,
      silhouette: "front",
      note: "Primary armor map",
    },
    {
      label: "SIDE",
      x: 520,
      y: 252,
      silhouette: "side",
      note: "Profile continuity",
    },
    {
      label: "REAR",
      x: 92,
      y: 592,
      silhouette: "rear",
      note: "Back plate read",
    },
    {
      label: "THREE-QUARTER",
      x: 520,
      y: 592,
      silhouette: "threeQuarter",
      note: "Volume inspection",
    },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0D1117"/>
  <rect x="40" y="40" width="944" height="944" rx="28" fill="#11161D" stroke="#2B3440"/>
  <rect x="68" y="68" width="888" height="116" rx="20" fill="#161B22" stroke="rgba(255,255,255,0.08)"/>
  <text x="92" y="112" fill="#8FEAFF" font-size="19" font-family="monospace" letter-spacing="5">${escapeXml(renderLabel)}</text>
  <text x="92" y="154" fill="#E6EDF3" font-size="34" font-family="monospace">${escapeXml(title)}</text>
  <text x="92" y="203" fill="#58FFB2" font-size="17" font-family="monospace">${escapeXml(statusLabel)}</text>
  <text x="590" y="203" fill="#FFB84D" font-size="15" font-family="monospace">2x2 CONTACT SHEET / PALETTE LOCKED</text>
  ${panels.map(renderContactSheetPanel).join("\n")}
  <rect x="92" y="922" width="840" height="34" rx="12" fill="#0D1117" stroke="#3A4654"/>
  ${promptLines
    .map(
      (line, index) =>
        `<text x="112" y="${946 + index * 0}" fill="#9BA7B4" font-size="13" font-family="monospace">${escapeXml(
          index === 0 ? `PROMPT SNAPSHOT: ${line}` : line
        )}</text>`
    )
    .slice(0, 1)
    .join("\n")}
</svg>`;
}

function renderContactSheetPanel(panel: {
  label: string;
  x: number;
  y: number;
  silhouette: string;
  note: string;
}) {
  const x = panel.x;
  const y = panel.y;
  return `<g>
  <rect x="${x}" y="${y}" width="380" height="284" rx="22" fill="#161B22" stroke="rgba(143,234,255,0.22)"/>
  <rect x="${x + 20}" y="${y + 52}" width="340" height="182" rx="18" fill="#0D1117" stroke="#2B3440"/>
  <text x="${x + 20}" y="${y + 34}" fill="#8FEAFF" font-size="16" font-family="monospace" letter-spacing="4">${panel.label}</text>
  <text x="${x + 235}" y="${y + 34}" fill="#6E7A88" font-size="12" font-family="monospace">${escapeXml(panel.note)}</text>
  ${renderAngleSilhouette(panel.silhouette, x + 20, y + 52)}
  <text x="${x + 22}" y="${y + 264}" fill="#58FFB2" font-size="12" font-family="monospace">CONSISTENT COLOR ROLES / NO DESIGN MUTATION</text>
</g>`;
}

function renderAngleSilhouette(kind: string, x: number, y: number) {
  if (kind === "side") {
    return `<rect x="${x + 102}" y="${y + 34}" width="138" height="34" rx="12" fill="#3DD9FF" opacity="0.82"/>
    <rect x="${x + 86}" y="${y + 76}" width="188" height="56" rx="18" fill="#E6EDF3" opacity="0.88"/>
    <rect x="${x + 124}" y="${y + 140}" width="102" height="24" rx="9" fill="#FFB84D" opacity="0.9"/>
    <rect x="${x + 72}" y="${y + 78}" width="18" height="86" rx="8" fill="#58FFB2" opacity="0.72"/>
    <rect x="${x + 280}" y="${y + 88}" width="38" height="14" rx="7" fill="#8FEAFF" opacity="0.8"/>`;
  }
  if (kind === "rear") {
    return `<rect x="${x + 116}" y="${y + 28}" width="108" height="42" rx="15" fill="#E6EDF3" opacity="0.88"/>
    <rect x="${x + 86}" y="${y + 76}" width="168" height="96" rx="26" fill="#3DD9FF" opacity="0.8"/>
    <rect x="${x + 108}" y="${y + 94}" width="124" height="16" rx="8" fill="#0D1117" opacity="0.8"/>
    <rect x="${x + 70}" y="${y + 94}" width="34" height="80" rx="14" fill="#FFB84D" opacity="0.86"/>
    <rect x="${x + 236}" y="${y + 94}" width="34" height="80" rx="14" fill="#FFB84D" opacity="0.86"/>`;
  }
  if (kind === "threeQuarter") {
    return `<path d="M${x + 92} ${y + 58} L${x + 218} ${y + 34} L${x + 286} ${y + 86} L${x + 250} ${y + 160} L${x + 116} ${y + 174} L${x + 70} ${y + 112} Z" fill="#E6EDF3" opacity="0.88"/>
    <path d="M${x + 218} ${y + 34} L${x + 286} ${y + 86} L${x + 250} ${y + 160} L${x + 212} ${y + 118} Z" fill="#3DD9FF" opacity="0.78"/>
    <rect x="${x + 116}" y="${y + 88}" width="96" height="22" rx="10" fill="#FFB84D" opacity="0.9"/>
    <circle cx="${x + 92}" cy="${y + 128}" r="18" fill="#58FFB2" opacity="0.78"/>`;
  }
  return `<rect x="${x + 136}" y="${y + 28}" width="68" height="44" rx="16" fill="#E6EDF3" opacity="0.9"/>
    <rect x="${x + 96}" y="${y + 78}" width="148" height="92" rx="24" fill="#3DD9FF" opacity="0.78"/>
    <rect x="${x + 112}" y="${y + 98}" width="116" height="18" rx="9" fill="#FFB84D" opacity="0.92"/>
    <rect x="${x + 66}" y="${y + 88}" width="34" height="76" rx="14" fill="#58FFB2" opacity="0.72"/>
    <rect x="${x + 240}" y="${y + 88}" width="34" height="76" rx="14" fill="#58FFB2" opacity="0.72"/>`;
}

function buildInternalWeatheringSplitSvg({
  title,
  renderLabel,
  statusLabel,
  prompt,
}: {
  title: string;
  renderLabel: string;
  statusLabel: string;
  prompt: string;
}) {
  const promptLine = wrapText(prompt, 78)[0] ?? "Approved paint plan locked for weathering comparison.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0D1117"/>
  <rect x="40" y="40" width="944" height="944" rx="28" fill="#11161D" stroke="#2B3440"/>
  <rect x="68" y="68" width="888" height="128" rx="20" fill="#161B22" stroke="rgba(255,255,255,0.08)"/>
  <text x="92" y="112" fill="#FFB84D" font-size="18" font-family="monospace" letter-spacing="4">${escapeXml(renderLabel)}</text>
  <text x="92" y="154" fill="#E6EDF3" font-size="34" font-family="monospace">${escapeXml(title)}</text>
  <text x="92" y="205" fill="#58FFB2" font-size="16" font-family="monospace">${escapeXml(statusLabel)}</text>
  <line x1="512" y1="236" x2="512" y2="844" stroke="#3A4654" stroke-width="2" stroke-dasharray="10 10"/>
  ${renderWeatheringSplitPanel({
    label: "BEFORE CLEAN BUILD",
    sublabel: "Approved paint plan / no finishing damage",
    x: 82,
    y: 252,
    weathered: false,
  })}
  ${renderWeatheringSplitPanel({
    label: "AFTER WEATHERING PASS",
    sublabel: "Dust / chips / abrasion / streaking",
    x: 532,
    y: 252,
    weathered: true,
  })}
  <rect x="92" y="872" width="840" height="84" rx="18" fill="#0D1117" stroke="#3A4654"/>
  <text x="116" y="914" fill="#9BA7B4" font-size="14" font-family="monospace">MATCH LOCK: same camera, scale, palette, material profile, and silhouette.</text>
  <text x="116" y="940" fill="#6E7A88" font-size="12" font-family="monospace">${escapeXml(`PROMPT SNAPSHOT: ${promptLine}`)}</text>
</svg>`;
}

function renderWeatheringSplitPanel({
  label,
  sublabel,
  x,
  y,
  weathered,
}: {
  label: string;
  sublabel: string;
  x: number;
  y: number;
  weathered: boolean;
}) {
  const dustOverlay = weathered
    ? `<circle cx="${x + 102}" cy="${y + 448}" r="34" fill="#A77E4D" opacity="0.22"/>
      <circle cx="${x + 272}" cy="${y + 430}" r="48" fill="#A77E4D" opacity="0.18"/>
      <path d="M${x + 122} ${y + 178} C${x + 168} ${y + 202}, ${x + 224} ${y + 186}, ${x + 298} ${y + 218}" stroke="#BCA37A" stroke-width="9" stroke-linecap="round" opacity="0.36"/>
      <path d="M${x + 156} ${y + 254} L${x + 206} ${y + 230} L${x + 236} ${y + 248}" stroke="#0D1117" stroke-width="8" stroke-linecap="round" opacity="0.72"/>
      <path d="M${x + 246} ${y + 338} L${x + 300} ${y + 314}" stroke="#FFB84D" stroke-width="7" stroke-linecap="round" opacity="0.58"/>
      <rect x="${x + 118}" y="${y + 308}" width="20" height="8" rx="4" fill="#0D1117" opacity="0.82"/>
      <rect x="${x + 286}" y="${y + 242}" width="28" height="9" rx="4" fill="#0D1117" opacity="0.78"/>
      <rect x="${x + 198}" y="${y + 394}" width="34" height="8" rx="4" fill="#0D1117" opacity="0.72"/>`
    : "";

  return `<g>
    <rect x="${x}" y="${y}" width="410" height="592" rx="24" fill="#161B22" stroke="rgba(255,255,255,0.09)"/>
    <text x="${x + 24}" y="${y + 42}" fill="${weathered ? "#FFB84D" : "#8FEAFF"}" font-size="18" font-family="monospace" letter-spacing="4">${label}</text>
    <text x="${x + 24}" y="${y + 72}" fill="#9BA7B4" font-size="13" font-family="monospace">${escapeXml(sublabel)}</text>
    <rect x="${x + 24}" y="${y + 104}" width="362" height="392" rx="22" fill="#0D1117" stroke="#2B3440"/>
    <rect x="${x + 156}" y="${y + 138}" width="98" height="58" rx="20" fill="#E6EDF3" opacity="0.9"/>
    <path d="M${x + 96} ${y + 238} C${x + 116} ${y + 182}, ${x + 294} ${y + 182}, ${x + 314} ${y + 238} L${x + 294} ${y + 406} C${x + 264} ${y + 452}, ${x + 146} ${y + 452}, ${x + 116} ${y + 406} Z" fill="#3DD9FF" opacity="${weathered ? "0.68" : "0.82"}"/>
    <rect x="${x + 136}" y="${y + 262}" width="138" height="28" rx="14" fill="#FFB84D" opacity="${weathered ? "0.72" : "0.92"}"/>
    <rect x="${x + 70}" y="${y + 260}" width="52" height="146" rx="20" fill="#58FFB2" opacity="${weathered ? "0.55" : "0.72"}"/>
    <rect x="${x + 288}" y="${y + 260}" width="52" height="146" rx="20" fill="#58FFB2" opacity="${weathered ? "0.55" : "0.72"}"/>
    <rect x="${x + 144}" y="${y + 420}" width="42" height="54" rx="14" fill="#E6EDF3" opacity="${weathered ? "0.72" : "0.88"}"/>
    <rect x="${x + 224}" y="${y + 420}" width="42" height="54" rx="14" fill="#E6EDF3" opacity="${weathered ? "0.72" : "0.88"}"/>
    ${dustOverlay}
    <rect x="${x + 24}" y="${y + 520}" width="362" height="42" rx="14" fill="#0D1117" stroke="#3A4654"/>
    <text x="${x + 46}" y="${y + 547}" fill="#C7D0DA" font-size="13" font-family="monospace">${weathered ? "WEATHERING LAYER ENABLED" : "WEATHERING LAYER DISABLED"}</text>
  </g>`;
}

function buildInternalMaterialFinishComparisonSvg({
  title,
  renderLabel,
  statusLabel,
  prompt,
  variants,
}: {
  title: string;
  renderLabel: string;
  statusLabel: string;
  prompt: string;
  variants?: MaterialComparisonVariant[];
}) {
  const promptLine =
    wrapText(prompt, 78)[0] ?? "Material finish comparison with locked palette mapping.";
  const panels = normalizeMaterialComparisonVariants(variants).map((variant, index) => ({
    variant,
    index,
    x: index % 2 === 0 ? 82 : 532,
    y: index < 2 ? 244 : 568,
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0D1117"/>
  <rect x="40" y="40" width="944" height="944" rx="28" fill="#11161D" stroke="#2B3440"/>
  <rect x="68" y="68" width="888" height="132" rx="20" fill="#161B22" stroke="rgba(255,255,255,0.08)"/>
  <text x="92" y="112" fill="#EFCB7A" font-size="18" font-family="monospace" letter-spacing="4">${escapeXml(renderLabel)}</text>
  <text x="92" y="154" fill="#E6EDF3" font-size="34" font-family="monospace">${escapeXml(title)}</text>
  <text x="92" y="207" fill="#58FFB2" font-size="16" font-family="monospace">${escapeXml(statusLabel)}</text>
  <text x="614" y="207" fill="#8FEAFF" font-size="14" font-family="monospace">2x2 MATERIAL BOARD / PALETTE LOCKED</text>
  ${panels.map(renderMaterialFinishPanel).join("\n")}
  <rect x="92" y="898" width="840" height="58" rx="18" fill="#0D1117" stroke="#3A4654"/>
  <text x="116" y="930" fill="#9BA7B4" font-size="13" font-family="monospace">MATCH LOCK: same silhouette, camera, palette, weathering, and color-role mapping.</text>
  <text x="116" y="950" fill="#6E7A88" font-size="11" font-family="monospace">${escapeXml(`PROMPT SNAPSHOT: ${promptLine}`)}</text>
</svg>`;
}

function normalizeMaterialComparisonVariants(variants?: MaterialComparisonVariant[]) {
  const fallbackVariants: MaterialComparisonVariant[] = [
    {
      name: "Current Finish",
      slug: "current-finish",
      finishType: "matte",
      reflectivityLevel: "low",
      sheenLevel: "low",
      difficultyLevel: "standard",
      role: "current",
    },
    {
      name: "Semi-gloss Alternate",
      slug: "semi-gloss-alternate",
      finishType: "semi-gloss",
      reflectivityLevel: "medium",
      sheenLevel: "medium",
      difficultyLevel: "standard",
      role: "comparison",
    },
    {
      name: "Metallic Alternate",
      slug: "metallic-alternate",
      finishType: "metallic",
      reflectivityLevel: "high",
      sheenLevel: "high",
      difficultyLevel: "advanced",
      role: "comparison",
    },
    {
      name: "Ceramic Alternate",
      slug: "ceramic-alternate",
      finishType: "ceramic",
      reflectivityLevel: "low",
      sheenLevel: "low",
      difficultyLevel: "advanced",
      role: "comparison",
    },
  ];
  const normalized: MaterialComparisonVariant[] = (variants ?? []).slice(0, 4).map((variant, index) => ({
    ...variant,
    role: index === 0 ? "current" : variant.role ?? "comparison",
  }));

  while (normalized.length < 4) {
    normalized.push(fallbackVariants[normalized.length]);
  }

  return normalized;
}

function renderMaterialFinishPanel(panel: {
  variant: MaterialComparisonVariant;
  index: number;
  x: number;
  y: number;
}) {
  const { variant, index, x, y } = panel;
  const tone = getMaterialFinishTone(variant, index);
  const roleLabel =
    variant.role === "current" || index === 0 ? "CURRENT FINISH" : `ALT FINISH ${index}`;
  const meta = compactMaterialMeta(variant);
  const grainLayer =
    tone.grainOpacity > 0
      ? `<path d="M${x + 48} ${y + 116} L${x + 352} ${y + 116}" stroke="#0D1117" stroke-width="2" opacity="${tone.grainOpacity}"/>
        <path d="M${x + 72} ${y + 156} L${x + 328} ${y + 156}" stroke="#0D1117" stroke-width="2" opacity="${tone.grainOpacity}"/>
        <path d="M${x + 92} ${y + 190} L${x + 310} ${y + 190}" stroke="#0D1117" stroke-width="2" opacity="${tone.grainOpacity}"/>`
      : "";
  const highlightLayer =
    tone.highlightOpacity > 0
      ? `<path d="M${x + 228} ${y + 106} C${x + 284} ${y + 114}, ${x + 330} ${y + 142}, ${x + 352} ${y + 184}" stroke="${tone.highlight}" stroke-width="${tone.highlightWidth}" stroke-linecap="round" opacity="${tone.highlightOpacity}"/>
        <rect x="${x + 246}" y="${y + 136}" width="78" height="10" rx="5" fill="${tone.highlight}" opacity="${tone.highlightOpacity}"/>`
      : "";
  const metallicFlakes =
    tone.flakeOpacity > 0
      ? `<circle cx="${x + 152}" cy="${y + 142}" r="3" fill="#E6EDF3" opacity="${tone.flakeOpacity}"/>
        <circle cx="${x + 202}" cy="${y + 118}" r="2.5" fill="#E6EDF3" opacity="${tone.flakeOpacity}"/>
        <circle cx="${x + 278}" cy="${y + 188}" r="3.5" fill="#E6EDF3" opacity="${tone.flakeOpacity}"/>
        <circle cx="${x + 316}" cy="${y + 162}" r="2" fill="#E6EDF3" opacity="${tone.flakeOpacity}"/>`
      : "";

  return `<g>
    <rect x="${x}" y="${y}" width="410" height="286" rx="22" fill="#161B22" stroke="${tone.stroke}"/>
    <text x="${x + 24}" y="${y + 38}" fill="${tone.accent}" font-size="15" font-family="monospace" letter-spacing="3">${escapeXml(roleLabel)}</text>
    <text x="${x + 24}" y="${y + 66}" fill="#E6EDF3" font-size="20" font-family="monospace">${escapeXml(truncateLabel(variant.name, 24))}</text>
    <rect x="${x + 24}" y="${y + 84}" width="362" height="134" rx="18" fill="#0D1117" stroke="#2B3440"/>
    <rect x="${x + 168}" y="${y + 104}" width="74" height="34" rx="14" fill="#C7D0DA" opacity="0.88"/>
    <path d="M${x + 102} ${y + 164} C${x + 126} ${y + 112}, ${x + 284} ${y + 112}, ${x + 308} ${y + 164} L${x + 292} ${y + 202} C${x + 258} ${y + 226}, ${x + 152} ${y + 226}, ${x + 118} ${y + 202} Z" fill="${tone.surface}" opacity="${tone.surfaceOpacity}"/>
    <rect x="${x + 138}" y="${y + 164}" width="134" height="22" rx="11" fill="${tone.accent}" opacity="0.88"/>
    <rect x="${x + 70}" y="${y + 158}" width="50" height="58" rx="18" fill="${tone.support}" opacity="0.72"/>
    <rect x="${x + 290}" y="${y + 158}" width="50" height="58" rx="18" fill="${tone.support}" opacity="0.72"/>
    ${grainLayer}
    ${highlightLayer}
    ${metallicFlakes}
    <rect x="${x + 24}" y="${y + 236}" width="362" height="32" rx="12" fill="#0D1117" stroke="#3A4654"/>
    <text x="${x + 42}" y="${y + 256}" fill="#C7D0DA" font-size="11" font-family="monospace">${escapeXml(meta)}</text>
  </g>`;
}

function getMaterialFinishTone(variant: MaterialComparisonVariant, index: number) {
  const finishType = variant.finishType.toLowerCase();
  if (finishType.includes("metal")) {
    return {
      accent: "#EFCB7A",
      surface: "#8FEAFF",
      support: "#C7D0DA",
      highlight: "#FFFFFF",
      stroke: "rgba(239,203,122,0.36)",
      surfaceOpacity: "0.82",
      grainOpacity: 0.08,
      highlightOpacity: 0.82,
      highlightWidth: 8,
      flakeOpacity: 0.78,
    };
  }
  if (finishType.includes("semi") || finishType.includes("gloss")) {
    return {
      accent: "#3DD9FF",
      surface: "#58FFB2",
      support: "#8FEAFF",
      highlight: "#E6EDF3",
      stroke: "rgba(61,217,255,0.34)",
      surfaceOpacity: "0.78",
      grainOpacity: 0.04,
      highlightOpacity: 0.64,
      highlightWidth: 7,
      flakeOpacity: 0.18,
    };
  }
  if (finishType.includes("ceramic")) {
    return {
      accent: "#D9E1E8",
      surface: "#C7D0DA",
      support: "#8FEAFF",
      highlight: "#FFFFFF",
      stroke: "rgba(217,225,232,0.28)",
      surfaceOpacity: "0.86",
      grainOpacity: 0.1,
      highlightOpacity: 0.34,
      highlightWidth: 5,
      flakeOpacity: 0.08,
    };
  }
  const matteAccents = ["#58FFB2", "#FFB84D", "#8FEAFF", "#C7D0DA"];
  return {
    accent: matteAccents[index % matteAccents.length],
    surface: "#3DD9FF",
    support: "#E6EDF3",
    highlight: "#E6EDF3",
    stroke: "rgba(255,255,255,0.12)",
    surfaceOpacity: "0.66",
    grainOpacity: 0.18,
    highlightOpacity: 0.18,
    highlightWidth: 4,
    flakeOpacity: 0,
  };
}

function compactMaterialMeta(variant: MaterialComparisonVariant) {
  return [
    `finish=${variant.finishType}`,
    variant.reflectivityLevel ? `reflect=${variant.reflectivityLevel}` : undefined,
    variant.sheenLevel ? `sheen=${variant.sheenLevel}` : undefined,
    variant.difficultyLevel ? `diff=${variant.difficultyLevel}` : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getSimulationStageLabel(
  simulationStage?: SimulationStage
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

function getRenderLayoutSpec(
  renderMode?: RenderMode
) {
  if (renderMode === "multi-angle-preview") {
    return "2x2 contact sheet: FRONT, SIDE, REAR, and THREE-QUARTER panels with locked palette mapping.";
  }
  if (renderMode === "weathering-split-preview") {
    return "side-by-side split: BEFORE CLEAN BUILD left, AFTER WEATHERING PASS right, with matched camera and locked palette mapping.";
  }
  if (renderMode === "material-finish-comparison") {
    return "2x2 material comparison board: CURRENT FINISH plus up to three alternate material presets, with locked palette, pose, camera, weathering, and color-role mapping.";
  }
  return undefined;
}

function buildAssetKey(handle: string, generationJobId: string, contentType: string) {
  const extension = getImageExtension(contentType);
  return `generated/${handle}/${generationJobId}-${randomUUID()}.${extension}`;
}

function getImageExtension(contentType: string) {
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  if (contentType.includes("svg")) {
    return "svg";
  }
  return "bin";
}

function wrapText(input: string, maxLineLength: number) {
  const words = input.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length <= maxLineLength) {
      current = candidate;
      continue;
    }
    if (current !== "") {
      lines.push(current);
    }
    current = word;
  }
  if (current !== "") {
    lines.push(current);
  }
  return lines;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
