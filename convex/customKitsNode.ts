"use node";

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client, type CORSRule } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createPrivateR2DownloadUrl, createPrivateR2UploadUrl, deleteR2Object, readPrivateR2Object, uploadR2Object } from "./r2Storage";
import { blockedKitScan, kitScanJsonSchema, kitScanSchema, kitScanSystemPrompt, maxKitReferenceBytes } from "./customKitContracts";
import { ProviderSafetyBlockError, requestTextCompletion } from "./llmProtocol";
import { parseSafeSearchResponse, safeSearchEndpoint, safeSearchMode, safeSearchRequestBody, safeSearchVerdict, type SafeSearchAnnotation } from "./customKitSafeSearch";
import { screenPromptBeforeGeneration } from "./contentSafetyNode";
import type { Doc, Id } from "./_generated/dataModel";
import { getR2ConnectionConfig } from "./r2Config";

export async function decodeKitReference(buffer: Buffer) {
  if (!buffer.length || buffer.length > maxKitReferenceBytes) throw new Error("Reference must be up to 8 MB");
  const image = sharp(buffer, { limitInputPixels: 16_777_216, animated: false });
  const meta = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages ?? 1) !== 1 ||
    !meta.width || !meta.height || Math.min(meta.width, meta.height) < 256 || Math.max(meta.width, meta.height) > 4096) {
    throw new Error("Use one static PNG, JPG or WebP image, 256–4096 pixels on each side");
  }
  // Decode fully, remove metadata and normalize into an immutable private object.
  const { data, info } = await image.rotate().webp({ quality: 95 }).toBuffer({ resolveWithObject: true });
  if (data.length > maxKitReferenceBytes) throw new Error("Decoded reference is too large; use a smaller image");
  return { data, width: info.width, height: info.height, checksum: createHash("sha256").update(data).digest("hex") };
}

export const prepareUpload = action({ args: { name: v.string(), contentType: v.string(), byteSize: v.number() },
  returns: v.object({ uploadId: v.id("customKitUploads"), url: v.string() }), handler: async (ctx, args): Promise<{ uploadId: Id<"customKitUploads">; url: string }> => {
    const ticket: Doc<"customKitUploads"> = await ctx.runMutation(internal.customKits.createUpload, args);
    return { uploadId: ticket._id, url: await createPrivateR2UploadUrl(ticket.key, ticket.contentType, ticket.byteSize) };
  } });

export const finishUpload = action({ args: { uploadId: v.id("customKitUploads") }, returns: v.id("customKits"), handler: async (ctx, args): Promise<Id<"customKits">> => {
  const ticket = await ctx.runMutation(internal.customKits.claimUpload, args);
  const key = `custom-kit-references/${ticket.userId}/${randomUUID()}.webp`;
  let committed = false;
  try {
    const buffer = await readPrivateR2Object(ticket.key, maxKitReferenceBytes);
    if (buffer.length !== ticket.byteSize) throw new Error("Reference size did not match the upload");
    const image = await decodeKitReference(buffer);
    await uploadR2Object("private", { key, buffer: image.data, contentType: "image/webp" });
    const kitId: Id<"customKits"> = await ctx.runMutation(internal.customKits.finishUpload, {
      uploadId: ticket._id, key, byteSize: image.data.length, width: image.width, height: image.height, checksum: image.checksum,
    });
    committed = true;
    return kitId;
  } finally {
    await deleteR2Object("private", ticket.key).catch(() => undefined);
    if (!committed) await deleteR2Object("private", key).catch(() => undefined);
  }
} });

export const cleanUpload = internalAction({ args: { uploadId: v.id("customKitUploads") }, returns: v.null(), handler: async (ctx, args) => {
  const ticket = await ctx.runQuery(internal.customKits.uploadRecord, args);
  if (ticket) await deleteR2Object("private", ticket.key);
  return null;
} });

export const scan = action({ args: { kitId: v.id("customKits"), expectedCost: v.number() }, returns: v.id("customKitScans"), handler: async (ctx, args): Promise<Id<"customKitScans">> => {
  const profile = await ctx.runQuery(internal.customKits.visionProfile, {});
  const claim = await ctx.runMutation(internal.customKits.beginScan, { ...args, profileId: profile._id });
  if (!claim.execute) return claim.scanId;
  const startedAt = Date.now();
  let screening: { mode: "enforce" | "monitor"; annotation: SafeSearchAnnotation; wouldBlock: string | null } | null = null;
  try {
    const object = await ctx.runQuery(internal.customKits.scanReference, { kitId: args.kitId });
    const image = await readPrivateR2Object(object.key, maxKitReferenceBytes);
    if (createHash("sha256").update(image).digest("hex") !== object.checksum) throw new Error("The reference changed; upload a new image");
    const annotation = await requestSafeSearch(image);
    const category = safeSearchVerdict(annotation);
    screening = { mode: safeSearchMode(), annotation, wouldBlock: category };
    if (category && screening.mode === "enforce") {
      await ctx.runMutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(blockedKitScan(category)),
        executionJson: JSON.stringify({ safeSearch: screening, durationMs: Date.now() - startedAt }) });
      return claim.scanId;
    }
    const userPrompt = "Check this single reference for content safety first. If it is allowed, observe the primary mecha and report its eligibility, visible structure and unknown regions.";
    await screenPromptBeforeGeneration(ctx, { prompt: userPrompt, subject: "text", stage: "custom-kit-scan" });
    const response = await requestTextCompletion({ profile, systemPrompt: kitScanSystemPrompt, userPrompt,
      imageDataUris: [`data:image/webp;base64,${image.toString("base64")}`], jsonSchema: kitScanJsonSchema });
    const result = kitScanSchema.parse(response.json);
    await ctx.runMutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(result),
      executionJson: JSON.stringify({ model: response.model, providerRequestId: response.providerRequestId, usage: response.usage, safeSearch: screening, durationMs: Date.now() - startedAt }) });
  } catch (error) {
    if (error instanceof ProviderSafetyBlockError) {
      await ctx.runMutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(blockedKitScan("other")),
        executionJson: JSON.stringify({ providerSafetyBlock: true, safeSearch: screening, durationMs: Date.now() - startedAt }) });
      return claim.scanId;
    }
    const reason = error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : "Reference scan failed";
    await ctx.runMutation(internal.customKits.failScan, { scanId: claim.scanId, reason });
    throw new Error(reason);
  }
  return claim.scanId;
} });

/** Sends a downscaled JPEG copy: SafeSearch does not need full resolution, and base64 must stay under the 10 MB request limit. */
async function requestSafeSearch(image: Buffer): Promise<SafeSearchAnnotation> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) throw new Error("Image screening is not configured");
  const preview = await sharp(image).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(safeSearchEndpoint, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(safeSearchRequestBody(preview.toString("base64"))) });
    if (!response.ok) throw new Error(`Image screening failed: HTTP ${response.status}`);
    return parseSafeSearchResponse(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Image screening timed out");
    throw error;
  } finally { clearTimeout(timer); }
}

export const configureUploadCors = internalAction({ args: { origins: v.array(v.string()) }, returns: v.object({ origins: v.array(v.string()), methods: v.array(v.string()) }), handler: async (_ctx, args) => {
  if (!args.origins.length) throw new Error("At least one exact frontend origin is required");
  const origins = Array.from(new Set(args.origins.map(origin => {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Use exact HTTPS origins or localhost HTTP origins");
    return url.origin;
  })));
  const config = getR2ConnectionConfig();
  const client = new S3Client({ region: "auto", endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  let rules: CORSRule[] = [];
  try { rules = (await client.send(new GetBucketCorsCommand({ Bucket: config.buckets.private }))).CORSRules ?? []; }
  catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error; }
  const id = "neotypelab-custom-kit-uploads";
  await client.send(new PutBucketCorsCommand({ Bucket: config.buckets.private, CORSConfiguration: { CORSRules: [
    ...rules.filter(rule => rule.ID !== id), { ID: id, AllowedOrigins: origins, AllowedMethods: ["PUT"], AllowedHeaders: ["Content-Type", "Content-Length"], MaxAgeSeconds: 300 },
  ] } }));
  return { origins, methods: ["PUT"] };
} });

export const referenceUrl = action({ args: { kitId: v.id("customKits") }, returns: v.string(), handler: async (ctx, args): Promise<string> => {
  const object = await ctx.runQuery(internal.customKits.scanReference, args);
  return await createPrivateR2DownloadUrl({ key: object.key });
} });
