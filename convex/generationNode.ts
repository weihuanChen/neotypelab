"use node";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
let cachedPublicAssetBaseUrl: Promise<string | undefined> | undefined;

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

export const rerunJob = action({
  args: {
    generationJobId: v.id("generationJobs"),
  },
  handler: async (ctx, { generationJobId }) => {
    await ctx.runAction(internal.generationNode.executeQueuedJob, { generationJobId });
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

    const publicUrl = await resolvePublicAssetUrl(preview.key);
    if (!publicUrl) {
      throw new Error(
        "No public asset delivery URL is configured. Set R2_PUBLIC_BASE_URL or enable the bucket managed domain."
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

    try {
      const provider = resolveProvider();
      const generated = await generateImage({
        kind: job.kind,
        renderMode: job.renderMode,
        simulationStage: job.simulationStage,
        provider,
        prompt: job.prompt.composedPrompt,
        negativePrompt: job.prompt.negativePrompt,
        title: job.concept.title,
      });

      const uploaded = await uploadToR2({
        buffer: generated.buffer,
        contentType: generated.contentType,
        key: buildAssetKey(job.user.handle, job.generationJobId, generated.contentType),
      });

      await ctx.runMutation(internal.generation.markJobSucceeded, {
        generationJobId,
        conceptId: job.concept._id,
        promptCompositionId: job.prompt._id,
        provider,
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
          label:
            job.kind === "hd-preview"
              ? job.renderMode === "multi-angle-preview"
                ? "MULTI-ANGLE PREVIEW STABILIZED"
                : job.renderMode === "high-fidelity-render"
                  ? "HIGH-FIDELITY RENDER STABILIZED"
                  : job.renderMode === "build-stage-visualization"
                    ? `${getSimulationStageLabel(job.simulationStage).toUpperCase()} VISUALIZATION STABILIZED`
                    : job.renderMode === "weathering-simulation"
                      ? "WEATHERING SIMULATION STABILIZED"
                  : "HD RENDER STABILIZED"
              : "OUTPUT STABILIZED",
          provider,
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
        provider: resolveProvider(),
      });
      await ctx.runMutation(internal.generation.refundFailedJobCredits, {
        generationJobId,
      });
    }
  },
});

async function generateImage({
  kind,
  renderMode,
  simulationStage,
  provider,
  prompt,
  negativePrompt,
  title,
}: {
  kind: "palette-plan" | "hd-preview";
  renderMode?:
    | "hd-render"
    | "multi-angle-preview"
    | "high-fidelity-render"
    | "build-stage-visualization"
    | "weathering-simulation";
  simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass";
  provider: "internal" | "openai";
  prompt: string;
  negativePrompt?: string | null;
  title: string;
}) {
  if (provider === "openai") {
    return await generateWithOpenAI({ prompt, negativePrompt, renderMode, simulationStage });
  }

  return generateInternalPreview({ kind, renderMode, simulationStage, prompt, title });
}

async function generateWithOpenAI({
  prompt,
  renderMode,
  simulationStage,
}: {
  prompt: string;
  negativePrompt?: string | null;
  renderMode?:
    | "hd-render"
    | "multi-angle-preview"
    | "high-fidelity-render"
    | "build-stage-visualization"
    | "weathering-simulation";
  simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass";
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality:
        renderMode === "high-fidelity-render" ||
        renderMode === "build-stage-visualization" ||
        renderMode === "weathering-simulation"
          ? "high"
          : "medium",
      output_format: "png",
      background: "opaque",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI image generation failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  };
  const image = payload.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenAI image generation returned no image payload");
  }

  return {
    providerJobId: response.headers.get("x-request-id") ?? undefined,
    revisedPrompt: image.revised_prompt,
    contentType: "image/png",
    buffer: Buffer.from(image.b64_json, "base64"),
  };
}

function generateInternalPreview({
  kind,
  renderMode,
  simulationStage,
  prompt,
  title,
}: {
  kind: "palette-plan" | "hd-preview";
  renderMode?:
    | "hd-render"
    | "multi-angle-preview"
    | "high-fidelity-render"
    | "build-stage-visualization"
    | "weathering-simulation";
  simulationStage?: "primer-pass" | "decal-pass" | "weathering-pass";
  prompt: string;
  title: string;
}) {
  const renderLabel =
    kind === "hd-preview"
      ? renderMode === "multi-angle-preview"
        ? "MULTI-ANGLE PREVIEW / INTERNAL RENDERER"
        : renderMode === "high-fidelity-render"
          ? "HIGH-FIDELITY RENDER / INTERNAL RENDERER"
          : renderMode === "build-stage-visualization"
            ? `${getSimulationStageLabel(simulationStage).toUpperCase()} / INTERNAL RENDERER`
            : renderMode === "weathering-simulation"
              ? "WEATHERING SIMULATION / INTERNAL RENDERER"
          : "HD RENDER / INTERNAL RENDERER"
      : "PROTOTYPE PREVIEW / INTERNAL RENDERER";
  const statusLabel =
    kind === "hd-preview"
      ? renderMode === "multi-angle-preview"
        ? "SIMULATION STATUS: MULTI-ANGLE PREVIEW STABILIZED"
        : renderMode === "high-fidelity-render"
          ? "SIMULATION STATUS: HIGH-FIDELITY RENDER STABILIZED"
          : renderMode === "build-stage-visualization"
            ? `SIMULATION STATUS: ${getSimulationStageLabel(simulationStage).toUpperCase()} VISUALIZATION STABILIZED`
            : renderMode === "weathering-simulation"
              ? "SIMULATION STATUS: WEATHERING SIMULATION STABILIZED"
          : "SIMULATION STATUS: HD RENDER STABILIZED"
      : "SIMULATION STATUS: OUTPUT STABILIZED";
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
  <text x="144" y="868" fill="#FFB84D" font-size="20" font-family="monospace">OPENAI_API_KEY not configured. Internal renderer used for end-to-end execution.</text>
</svg>`;

  return {
    providerJobId: undefined,
    revisedPrompt: undefined,
    contentType: "image/svg+xml",
    buffer: Buffer.from(svg, "utf8"),
  };
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

async function uploadToR2({
  buffer,
  contentType,
  key,
}: {
  buffer: Buffer;
  contentType: string;
  key: string;
}) {
  const bucket = getRequiredEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: getRequiredEnv("R2_END_POINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  const result = await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    bucket,
    etag: result.ETag,
    publicUrl: await resolvePublicAssetUrl(key),
  };
}

async function resolvePublicAssetUrl(key: string) {
  const baseUrl = await resolvePublicAssetBaseUrl();
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl}/${key}`;
}

async function resolvePublicAssetBaseUrl() {
  if (cachedPublicAssetBaseUrl) {
    return cachedPublicAssetBaseUrl;
  }

  cachedPublicAssetBaseUrl = (async () => {
    const configuredBaseUrl = normalizeBaseUrl(process.env.R2_PUBLIC_BASE_URL);
    if (configuredBaseUrl) {
      return configuredBaseUrl;
    }

    const accountId = process.env.ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const apiToken = process.env.R2_TOKEN;

    if (!accountId || !bucket || !apiToken) {
      return undefined;
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/domains/managed`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      if (!response.ok) {
        return undefined;
      }

      const payload = (await response.json()) as {
        result?: {
          domain?: string;
          enabled?: boolean;
        };
      };

      if (!payload.result?.enabled || !payload.result.domain) {
        return undefined;
      }

      return normalizeBaseUrl(`https://${payload.result.domain}`);
    } catch {
      return undefined;
    }
  })();

  return cachedPublicAssetBaseUrl;
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return value.trim().replace(/\/+$/, "");
}

function resolveProvider(): "internal" | "openai" {
  return process.env.OPENAI_API_KEY ? "openai" : "internal";
}

function buildAssetKey(handle: string, generationJobId: string, contentType: string) {
  const extension = contentType === "image/png" ? "png" : "svg";
  return `generated/${handle}/${generationJobId}-${randomUUID()}.${extension}`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
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
