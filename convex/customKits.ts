import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./functions";
import { internalMutation as systemMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import schema from "./schema";
import { createAssetGraph } from "./assetModel";
import { assertPrivateStorageAdditionAllowed, reconcileAccountStorageUsage } from "./storageAccounting";
import { debitCredits, refundCreditTransaction } from "./creditLedger";
import { blockedKitScan, customKitPromptContext, effectiveKitParts, kitChangesSchema, kitScanSchema, kitScanVersion, kitReferenceTypes, maxKitReferenceBytes, type CustomKitSnapshot } from "./customKitContracts";

export function assertCustomKitEnabled() {
  if (process.env.CUSTOM_KIT_ENABLED !== "true") throw new Error("Custom Kit is not available yet");
}

const safetyStrikeLimit = 3;
const safetyStrikeWindowMs = 30 * 24 * 60 * 60_000;
async function assertUploadsNotPaused(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  const recent = await ctx.db.query("customKitScans").withIndex("by_userId_and_safetyBlocked", q => q.eq("userId", userId).eq("safetyBlocked", true)).order("desc").take(safetyStrikeLimit);
  if (recent.length >= safetyStrikeLimit && recent[safetyStrikeLimit - 1]._creationTime > Date.now() - safetyStrikeWindowMs) {
    throw new Error("Custom Kit uploads are paused for this account after repeated policy blocks. Contact hello@neotypelab.com");
  }
}

/** Hands the reference to the storage lifecycle, which deletes the R2 object and reconciles usage. */
async function releaseKitReference(ctx: Pick<MutationCtx, "db">, storageObjectId: Id<"storageObjects">) {
  const object = await ctx.db.get(storageObjectId);
  if (!object) return;
  await ctx.db.patch(object.mediaAssetId, { status: "deleted", currentVersionId: undefined, updatedAt: Date.now() });
  await ctx.db.patch(object._id, { retentionPolicy: "version-history", retainUntil: Date.now(), nextDeleteAttemptAt: Date.now(), updatedAt: Date.now() });
}

async function scanCost(ctx: Pick<QueryCtx, "db">) {
  const price = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-style-suggestion")).take(50)).find(row => row.isActive);
  if (!price || !Number.isInteger(price.creditCost) || price.creditCost < 0) throw new Error("Scan pricing is unavailable");
  return price.creditCost;
}
export const availability = query({ args: {}, returns: v.object({ enabled: v.boolean(), scanCost: v.union(v.number(), v.null()) }), handler: async ctx => {
  let cost: number | null = null;
  try { cost = await scanCost(ctx); } catch { /* Missing pricing keeps scanning unavailable. */ }
  const profile = await ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", "custom-kit-vision")).unique();
  return { enabled: process.env.CUSTOM_KIT_ENABLED === "true" && !!process.env.GOOGLE_CLOUD_VISION_API_KEY && !!profile?.isActive, scanCost: cost };
} });

export const configure = systemMutation({ args: { textProfileId: v.id("llmProfiles") }, returns: v.id("llmProfiles"), handler: async (ctx, { textProfileId }) => {
  const source = await ctx.db.get(textProfileId);
  if (!source?.isActive || !(["openai-compatible", "openai-chat-completions"] as string[]).includes(source.apiFormat) || source.keyEnvName !== "GEMINI_API_KEY_OFFCIAL") throw new Error("Use the configured official Gemini profile for the Vision capability trial");
  const { _id: _sourceId, _creationTime: _created, ...fields } = source;
  const profile = { ...fields, slug: "custom-kit-vision", name: "Custom Kit Vision", capability: "vision" as const,
    timeoutMs: 90_000, updatedAt: Date.now(), notes: "Single-image eligibility and geometry scan; verify actual model support before enabling Custom Kit." };
  const existing = await ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", profile.slug)).unique();
  if (existing) { await ctx.db.patch(existing._id, profile); return existing._id; }
  return await ctx.db.insert("llmProfiles", profile);
} });
export const visionProfile = internalQuery({ args: {}, returns: schema.doc("llmProfiles"), handler: async ctx => {
  assertCustomKitEnabled();
  const profile = await ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", "custom-kit-vision")).unique();
  if (!profile?.isActive || profile.capability !== "vision") throw new Error("Custom Kit Vision is not configured");
  if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) throw new Error("Image screening is not configured");
  return profile;
} });

export async function ownedKit(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, id: Id<"customKits">) {
  const kit = await ctx.db.get(id);
  if (!kit || kit.userId !== userId || kit.status !== "active") throw new Error("Custom Kit is unavailable");
  await assertKitReference(ctx, userId, kit.storageObjectId, kit.referenceVersionId, kit.checksum);
  return kit;
}

export async function assertKitReference(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, objectId: Id<"storageObjects">, versionId: Id<"assetVersions">, checksum: string) {
  const [object, version] = await Promise.all([ctx.db.get(objectId), ctx.db.get(versionId)]);
  if (!object || object.userId !== userId || object.bucketRole !== "private" || object.status !== "ready" ||
    object.assetVersionId !== versionId || object.checksum !== checksum || (object.retainUntil && object.retainUntil <= Date.now()) ||
    !version || version.userId !== userId || version.status !== "ready") throw new Error("The required Custom Kit reference is unavailable");
  return object;
}

export async function loadCustomKit(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, kitId: Id<"customKits">, versionId: Id<"customKitVersions">) {
  assertCustomKitEnabled();
  const kit = await ownedKit(ctx, userId, kitId);
  const version = await ctx.db.get(versionId);
  const scan = version ? await ctx.db.get(version.scanId) : null;
  if (!version || version.userId !== userId || version.customKitId !== kitId || kit.currentVersionId !== versionId || !version.confirmed ||
    version.referenceVersionId !== kit.referenceVersionId || !scan || scan.userId !== userId || scan.customKitId !== kitId || scan.referenceVersionId !== kit.referenceVersionId || scan.scanVersion !== kitScanVersion || scan.status !== "succeeded" || !scan.resultJson || kitScanSchema.parse(JSON.parse(scan.resultJson)).eligibility !== "supported") {
    throw new Error("Scan and confirm this Custom Kit before generating");
  }
  return JSON.parse(version.snapshotJson) as CustomKitSnapshot;
}

/** Read only safe display metadata; private keys are never returned to the browser. */
export const mine = query({ args: {}, returns: v.array(v.object({ id: v.id("customKits"), name: v.string() })), handler: async ctx => {
  if (!ctx.viewer) return [];
  return (await ctx.db.query("customKits").withIndex("by_user_status", q => q.eq("userId", ctx.viewer!._id).eq("status", "active")).order("desc").take(50)).map(kit => ({ id: kit._id, name: kit.name }));
} });

export const get = query({ args: { kitId: v.id("customKits") }, returns: v.union(v.null(), v.object({
  id: v.id("customKits"), name: v.string(), storageObjectId: v.id("storageObjects"), versionId: v.union(v.id("customKitVersions"), v.null()),
  snapshotJson: v.union(v.string(), v.null()), confirmed: v.boolean(), scanStatus: v.string(), scanResultJson: v.union(v.string(), v.null()), error: v.union(v.string(), v.null()),
  blocked: v.boolean(),
})), handler: async (ctx, { kitId }) => {
  if (!ctx.viewer) return null;
  const kit = await ctx.db.get(kitId);
  if (!kit || kit.userId !== ctx.viewer._id || kit.status === "deleted") return null;
  const version = kit.currentVersionId ? await ctx.db.get(kit.currentVersionId) : null;
  const scan = await ctx.db.query("customKitScans").withIndex("by_kit", q => q.eq("customKitId", kitId)).order("desc").first();
  return { id: kit._id, name: kit.name, storageObjectId: kit.storageObjectId, versionId: version?._id ?? null,
    snapshotJson: version?.snapshotJson ?? null, confirmed: version?.confirmed ?? false,
    scanStatus: scan?.status ?? "not-scanned", scanResultJson: scan?.resultJson ?? null, error: scan?.error ?? null, blocked: kit.status === "blocked" };
} });

export const createUpload = internalMutation({ args: { name: v.string(), contentType: v.string(), byteSize: v.number() }, returns: schema.doc("customKitUploads"), handler: async (ctx, args) => {
  assertCustomKitEnabled();
  const viewer = ctx.viewerX();
  if (viewer.accountStatus === "suspended") throw new Error("Account unavailable");
  if (!args.name.trim() || args.name.trim().length > 80) throw new Error("Use a Kit name of 1–80 characters");
  if (!(kitReferenceTypes as readonly string[]).includes(args.contentType) || !Number.isInteger(args.byteSize) || args.byteSize <= 0 || args.byteSize > maxKitReferenceBytes) throw new Error("Upload one PNG, JPG or WebP image up to 8 MB");
  await assertUploadsNotPaused(ctx, viewer._id);
  const pending = await ctx.db.query("customKitUploads").withIndex("by_user", q => q.eq("userId", viewer._id)).order("desc").take(100);
  const active = await ctx.db.query("customKits").withIndex("by_user_status", q => q.eq("userId", viewer._id).eq("status", "active")).take(50);
  if (active.length >= 50) throw new Error("Remove a saved Custom Kit before uploading another reference (50 maximum)");
  if (pending.filter(item => item.expiresAt > Date.now() && ["pending", "processing"].includes(item.status)).length >= 2) throw new Error("Finish the current reference upload first");
  await assertPrivateStorageAdditionAllowed(ctx, viewer._id, { optimizedBytes: args.byteSize });
  const id = await ctx.db.insert("customKitUploads", { ...args, name: args.name.trim(), userId: viewer._id,
    key: `custom-kit-uploads/${viewer._id}/${crypto.randomUUID()}`, status: "pending", expiresAt: Date.now() + 10 * 60_000 });
  await ctx.scheduler.runAfter(11 * 60_000, internal.customKitsNode.cleanUpload, { uploadId: id });
  return (await ctx.db.get(id))!;
} });

export const claimUpload = internalMutation({ args: { uploadId: v.id("customKitUploads") }, returns: schema.doc("customKitUploads"), handler: async (ctx, { uploadId }) => {
  const ticket = await ctx.db.get(uploadId);
  if (!ticket || ticket.userId !== ctx.viewerX()._id || ticket.expiresAt <= Date.now() || ticket.status !== "pending") throw new Error("Reference upload expired or already processed");
  await ctx.db.patch(ticket._id, { status: "processing" });
  return ticket;
} });
export const uploadRecord = internalQuery({ args: { uploadId: v.id("customKitUploads") }, returns: v.union(v.null(), schema.doc("customKitUploads")), handler: (ctx, { uploadId }) => ctx.db.get(uploadId) });
export const finishUpload = systemMutation({ args: {
  uploadId: v.id("customKitUploads"), key: v.string(), byteSize: v.number(), width: v.number(), height: v.number(), checksum: v.string(),
}, returns: v.id("customKits"), handler: async (ctx, args) => {
  const ticket = await ctx.db.get(args.uploadId);
  if (!ticket || ticket.status !== "processing" || ticket.expiresAt <= Date.now()) throw new Error("Reference upload expired");
  const active = await ctx.db.query("customKits").withIndex("by_user_status", q => q.eq("userId", ticket.userId).eq("status", "active")).take(50);
  if (active.length >= 50) throw new Error("Saved Custom Kit limit reached");
  await assertPrivateStorageAdditionAllowed(ctx, ticket.userId, { optimizedBytes: args.byteSize });
  const graph = await createAssetGraph(ctx, { legacyAsset: { userId: ticket.userId, key: args.key,
    bucket: process.env.R2_BUCKET_PRIVATE ?? "r2", kind: "reference", contentType: "image/webp", byteSize: args.byteSize, status: "active" },
    mediaKind: "reference-image", rendition: "source", origin: "uploaded", bucketRole: "private", title: ticket.name,
    width: args.width, height: args.height, checksum: args.checksum });
  const id = await ctx.db.insert("customKits", { userId: ticket.userId, name: ticket.name, storageObjectId: graph.storageObjectId,
    referenceVersionId: graph.assetVersionId, checksum: args.checksum, status: "active", updatedAt: Date.now() });
  await ctx.db.patch(ticket._id, { status: "complete", customKitId: id });
  await reconcileAccountStorageUsage(ctx, ticket.userId);
  return id;
} });

export const beginScan = internalMutation({ args: { kitId: v.id("customKits"), profileId: v.id("llmProfiles"), expectedCost: v.number() }, returns: v.object({ scanId: v.id("customKitScans"), execute: v.boolean() }), handler: async (ctx, args) => {
  assertCustomKitEnabled();
  const viewer = ctx.viewerX();
  if (viewer.accountStatus === "suspended") throw new Error("Account unavailable");
  await assertUploadsNotPaused(ctx, viewer._id);
  const kit = await ownedKit(ctx, viewer._id, args.kitId);
  const profile = await ctx.db.get(args.profileId);
  if (!profile?.isActive || profile.slug !== "custom-kit-vision" || profile.capability !== "vision" || !(["openai-compatible", "openai-chat-completions"] as string[]).includes(profile.apiFormat)) throw new Error("A compatible Vision route is required");
  const cacheKey = JSON.stringify([kit.checksum, kit.referenceVersionId, profile._id, profile.modelId, profile.requestDefaultsJson, kitScanVersion]);
  const previous = await ctx.db.query("customKitScans").withIndex("by_kit_cache", q => q.eq("customKitId", kit._id).eq("cacheKey", cacheKey)).order("desc").first();
  if (previous?.status === "succeeded" || previous?.status === "running") return { scanId: previous._id, execute: false };
  const activeKits = await ctx.db.query("customKits").withIndex("by_user_status", q => q.eq("userId", viewer._id).eq("status", "active")).take(100);
  for (const activeKit of activeKits) {
    const activeScan = await ctx.db.query("customKitScans").withIndex("by_kit", q => q.eq("customKitId", activeKit._id)).order("desc").first();
    if (activeScan?.status === "running") throw new Error("A reference scan is already running");
  }
  const cost = await scanCost(ctx);
  if (cost !== args.expectedCost) throw new Error("Scan price changed. Review the new price and retry");
  const scanId = await ctx.db.insert("customKitScans", { userId: viewer._id, customKitId: kit._id, referenceVersionId: kit.referenceVersionId,
    cacheKey, modelId: profile.modelId, profileId: profile._id, scanVersion: kitScanVersion, status: "running", cost, refunded: false, expiresAt: Date.now() + 3 * 60_000 });
  if (cost > 0) {
    const debit = await debitCredits(ctx, { userId: viewer._id, actionType: "generate-style-suggestion", amount: cost,
      metadata: { referenceTable: "customKitScans", referenceId: scanId, description: "Custom Kit reference scan", sourceType: "generation-spend" } });
    await ctx.db.patch(scanId, { creditTransactionId: debit.transactionId });
  }
  await ctx.scheduler.runAfter(3 * 60_000, internal.customKits.failScan, { scanId, reason: "Scan timed out. Credits were returned." });
  return { scanId, execute: true };
} });

export const scanReference = internalQuery({ args: { kitId: v.id("customKits") }, returns: schema.doc("storageObjects"), handler: async (ctx, { kitId }) => {
  const kit = await ownedKit(ctx, ctx.viewerX()._id, kitId);
  return await assertKitReference(ctx, kit.userId, kit.storageObjectId, kit.referenceVersionId, kit.checksum);
} });

export const completeScan = systemMutation({ args: { scanId: v.id("customKitScans"), resultJson: v.string(), executionJson: v.optional(v.string()) }, returns: v.null(), handler: async (ctx, args) => {
  const scan = await ctx.db.get(args.scanId);
  if (!scan || scan.status !== "running" || scan.expiresAt <= Date.now()) return null;
  const kit = await ownedKit(ctx, scan.userId, scan.customKitId);
  const result = kitScanSchema.parse(JSON.parse(args.resultJson));
  if (result.contentSafety.verdict === "blocked") {
    const stored = blockedKitScan(result.contentSafety.category === "none" ? "other" : result.contentSafety.category);
    await ctx.db.patch(scan._id, { resultJson: JSON.stringify(stored), status: "succeeded", completedAt: Date.now(), executionJson: args.executionJson, safetyBlocked: true });
    await ctx.db.patch(kit._id, { status: "blocked", currentVersionId: undefined, updatedAt: Date.now() });
    await releaseKitReference(ctx, kit.storageObjectId);
    return null;
  }
  await ctx.db.patch(scan._id, { resultJson: JSON.stringify(result), status: "succeeded", completedAt: Date.now(), executionJson: args.executionJson });
  if (result.eligibility === "supported") {
    const snapshot: CustomKitSnapshot = { kind: "custom", id: kit._id, version: 1, name: kit.name,
      scanId: scan._id, scanVersion: scan.scanVersion, referenceVersionId: kit.referenceVersionId, storageObjectId: kit.storageObjectId,
      checksum: kit.checksum, observations: result, corrections: [], requestedEdits: [], effectiveParts: result.parts };
    const latest = await ctx.db.query("customKitVersions").withIndex("by_kit_version", q => q.eq("customKitId", kit._id)).order("desc").first();
    snapshot.version = (latest?.version ?? 0) + 1;
    const id = await ctx.db.insert("customKitVersions", { userId: kit.userId, customKitId: kit._id, version: snapshot.version,
      scanId: scan._id, referenceVersionId: kit.referenceVersionId, snapshotJson: JSON.stringify(snapshot), confirmed: false });
    await ctx.db.patch(kit._id, { currentVersionId: id, updatedAt: Date.now() });
  } else await ctx.db.patch(kit._id, { currentVersionId: undefined, updatedAt: Date.now() });
  return null;
} });

export const failScan = systemMutation({ args: { scanId: v.id("customKitScans"), reason: v.string() }, returns: v.null(), handler: async (ctx, args) => {
  const scan = await ctx.db.get(args.scanId);
  if (!scan || scan.status !== "running") return null;
  if (scan.creditTransactionId) await refundCreditTransaction(ctx, { debitTransactionId: scan.creditTransactionId, actionType: "generation-refund",
    metadata: { description: "Custom Kit scan failed", referenceTable: "customKitScans", referenceId: scan._id } });
  await ctx.db.patch(scan._id, { status: "failed", error: args.reason.slice(0, 300), refunded: true, completedAt: Date.now() });
  return null;
} });

export const confirm = mutation({ args: { kitId: v.id("customKits"), expectedVersionId: v.id("customKitVersions"), changesJson: v.string() }, returns: v.id("customKitVersions"), handler: async (ctx, args) => {
  assertCustomKitEnabled();
  if (ctx.viewerX().accountStatus === "suspended") throw new Error("Account unavailable");
  const kit = await ownedKit(ctx, ctx.viewerX()._id, args.kitId);
  if (kit.currentVersionId !== args.expectedVersionId) throw new Error("This Kit changed. Reload its current structure");
  const prior = await ctx.db.get(args.expectedVersionId);
  const scan = prior ? await ctx.db.get(prior.scanId) : null;
  if (!scan?.resultJson || scan.status !== "succeeded" || scan.referenceVersionId !== kit.referenceVersionId) throw new Error("Scan this reference first");
  const observations = kitScanSchema.parse(JSON.parse(scan.resultJson));
  if (observations.eligibility !== "supported") throw new Error("This reference is not eligible");
  const changes = kitChangesSchema.parse(JSON.parse(args.changesJson));
  const snapshot = JSON.parse(prior!.snapshotJson) as CustomKitSnapshot;
  const next: CustomKitSnapshot = { ...snapshot, version: prior!.version + 1, ...changes, effectiveParts: effectiveKitParts(observations, changes) };
  const id = await ctx.db.insert("customKitVersions", { userId: kit.userId, customKitId: kit._id, scanId: scan._id,
    version: next.version, referenceVersionId: kit.referenceVersionId, snapshotJson: JSON.stringify(next), confirmed: true });
  await ctx.db.patch(kit._id, { currentVersionId: id, updatedAt: Date.now() });
  return id;
} });

export const remove = mutation({ args: { kitId: v.id("customKits") }, returns: v.null(), handler: async (ctx, args) => {
  const kit = await ownedKit(ctx, ctx.viewerX()._id, args.kitId);
  const scan = await ctx.db.query("customKitScans").withIndex("by_kit", q => q.eq("customKitId", kit._id)).order("desc").first();
  if (scan?.status === "running") throw new Error("Wait for the reference scan to finish before removing this Kit");
  const running = await ctx.db.query("creationRuns").withIndex("by_user", q => q.eq("userId", kit.userId)).order("desc").take(10);
  if (running.some(run => ["queued", "running"].includes(run.status))) throw new Error("Wait for your preview to finish before removing a reference");
  const queued = await ctx.db.query("generationJobs").withIndex("by_user_status", q => q.eq("userId", kit.userId).eq("status", "queued")).take(1);
  const rendering = await ctx.db.query("generationJobs").withIndex("by_user_status", q => q.eq("userId", kit.userId).eq("status", "running")).take(1);
  if (queued.length || rendering.length) throw new Error("Wait for your render to finish before removing a reference");
  await ctx.db.patch(kit._id, { status: "deleted", updatedAt: Date.now() });
  await releaseKitReference(ctx, kit.storageObjectId);
  return null;
} });

export async function customKitModelContext(ctx: Pick<MutationCtx, "db">, userId: Id<"users">, args: { customKitId?: Id<"customKits">; customKitVersionId?: Id<"customKitVersions">; baseModelId?: Id<"baseModels">; kitVariantId?: Id<"baseModels"> }) {
  if (!args.customKitId && !args.customKitVersionId) return null;
  if (!args.customKitId || !args.customKitVersionId || args.baseModelId || args.kitVariantId) throw new Error("Choose exactly one Official or Custom Kit source");
  const snapshot = await loadCustomKit(ctx, userId, args.customKitId, args.customKitVersionId);
  return { kitSnapshot: snapshot, ...customKitPromptContext(snapshot) };
}
