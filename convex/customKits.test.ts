/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { seedUser } from "@/tests/convexTestHelpers";
import { customKitDisplay, effectiveKitParts, kitScanSchema, type KitScan } from "./customKitContracts";
import { creativeInputKey } from "./creativeContracts";
import { requiredPaletteRolesForExecution } from "./creativeIntentResolver";
import type { CreativeSnapshot } from "./creativePipeline";

const modules = import.meta.glob("./**/*.ts");
const scan: KitScan = { version: "kit-scan.v2", contentSafety: { verdict: "allowed", category: "none" }, eligibility: "supported", reason: "A clear original quadruped robot with visible armor structure.",
  parts: [{ id: "body", category: "armor", name: "Body armor", description: "Segmented mechanical body armor.", visibility: "visible" },
    { id: "shoulders", category: "armor", name: "Shoulder armor", description: "Layered broad shoulder shells.", visibility: "partial" }],
  uncertainFeatures: ["Backpack attachment is not visible."] };
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("CUSTOM_KIT_ENABLED", "true"); vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "test-vision-key"); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });

async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.init.init, {});
  await t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-3.5-flash" });
  const owner = await seedUser(t, { tokenIdentifier: "custom-owner", email: "custom@example.test", balance: 50 });
  const other = await seedUser(t, { tokenIdentifier: "custom-other", email: "other@example.test", balance: 50 });
  const profile = await t.run(ctx => ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", "gemini-official-creative-text")).unique());
  const profileId = await t.mutation(internal.customKits.configure, { textProfileId: profile!._id });
  const ticket = await owner.client.mutation(internal.customKits.createUpload, { name: "Original Robot", contentType: "image/png", byteSize: 1000 });
  await owner.client.mutation(internal.customKits.claimUpload, { uploadId: ticket._id });
  const kitId = await t.mutation(internal.customKits.finishUpload, { uploadId: ticket._id, key: "secret-custom-reference.webp", width: 512, height: 512, byteSize: 800, checksum: "fixture-sha256" });
  const availability = await owner.client.query(api.customKits.availability, {});
  const begin = () => owner.client.mutation(internal.customKits.beginScan, { kitId, profileId, expectedCost: availability.scanCost! });
  const catalog = await owner.client.query(api.catalog.listCreateOptions, {});
  const style = catalog.stylePresets.find(row => row.slug === "arctic-ops")!;
  const common = { materialPresetId: catalog.materialPresets[0]._id, weatheringLevel: "clean" as const, stylePresetId: style._id, styleRevision: style.styleIntentJson };
  return { t, owner, other, kitId, profileId, begin, common, style, cost: availability.scanCost! };
}
async function confirmKit(f: Awaited<ReturnType<typeof fixture>>, edits = false) {
  const claim = await f.begin();
  await f.t.mutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(scan) });
  const record = await f.owner.client.query(api.customKits.get, { kitId: f.kitId });
  const versionId = await f.owner.client.mutation(api.customKits.confirm, { kitId: f.kitId, expectedVersionId: record!.versionId!,
    changesJson: JSON.stringify({ corrections: [{ partId: "shoulders", description: "Two separate shoulder shells." }],
      requestedEdits: edits ? [{ partId: "shoulders", action: "adjust", description: "Slightly thicken shoulder armor." }] : [] }) });
  return { versionId, scanId: claim.scanId };
}

describe("Custom Kit access, scans and versions", () => {
  it("removes its private reference through the existing lifecycle without deleting finished build snapshots", async () => {
    const f = await fixture();
    const { versionId } = await confirmKit(f);
    const saved = await f.t.run(ctx => ctx.db.get(versionId));
    const kit = (await f.t.run(ctx => ctx.db.get(f.kitId)))!;
    await f.owner.client.mutation(api.customKits.remove, { kitId: f.kitId });
    expect(await f.owner.client.query(api.customKits.get, { kitId: f.kitId })).toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(versionId)))!.snapshotJson).toBe(saved!.snapshotJson);
    const cleanup = await f.t.mutation(internal.storageLifecycle.claimExpiredObjects, {});
    expect(cleanup.some(item => item.storageObjectId === kit.storageObjectId)).toBe(true);
  });
  it("reports Custom Kit unavailable until image screening is configured", async () => {
    const f = await fixture();
    vi.stubEnv("GOOGLE_CLOUD_VISION_API_KEY", "");
    expect((await f.owner.client.query(api.customKits.availability, {})).enabled).toBe(false);
    await expect(f.t.query(internal.customKits.visionProfile, {})).rejects.toThrow(/screening/);
  });
  it("keeps new uploads closed when the deployment feature is disabled", async () => {
    const f = await fixture();
    vi.stubEnv("CUSTOM_KIT_ENABLED", "false");
    await expect(f.owner.client.mutation(internal.customKits.createUpload, { name: "Closed", contentType: "image/png", byteSize: 1000 })).rejects.toThrow(/not available/);
  });
  it("requires an owner and exactly one Kit source before preview debit", async () => {
    const f = await fixture();
    const { versionId } = await confirmKit(f);
    const quote = await f.owner.client.query(api.creationRuns.quote, {});
    const input = { ...f.common, customKitId: f.kitId, customKitVersionId: versionId };
    await expect(f.other.client.mutation(api.creationRuns.start, { input, requestKey: "foreign", expectedCost: quote!.cost })).rejects.toThrow(/unavailable/);
    const model = await f.t.run(ctx => ctx.db.query("baseModels").first());
    await expect(f.owner.client.mutation(api.creationRuns.start, { input: { ...input, kitVariantId: model!._id }, requestKey: "mixed", expectedCost: quote!.cost })).rejects.toThrow(/exactly one/);
    expect(await f.other.client.query(api.customKits.get, { kitId: f.kitId })).toBeNull();
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").collect());
    expect(tx.filter(item => item.referenceTable === "creationRuns")).toHaveLength(0);
    expect(JSON.stringify(await f.owner.client.query(api.customKits.get, { kitId: f.kitId }))).not.toContain("secret-custom-reference");
  });
  it("deduplicates running and successful scans and refunds a technical failure once", async () => {
    const f = await fixture();
    const first = await f.begin();
    expect((await f.begin()).execute).toBe(false);
    await f.t.mutation(internal.customKits.failScan, { scanId: first.scanId, reason: "Vision failed" });
    await f.t.mutation(internal.customKits.failScan, { scanId: first.scanId, reason: "Duplicate failure" });
    const next = await f.begin();
    expect(next.execute).toBe(true);
    await f.t.mutation(internal.customKits.completeScan, { scanId: next.scanId, resultJson: JSON.stringify(scan) });
    expect((await f.begin()).scanId).toBe(next.scanId);
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").collect());
    expect(tx.filter(item => item.referenceTable === "customKitScans" && item.delta > 0)).toHaveLength(1);
    expect(tx.filter(item => item.referenceTable === "customKitScans" && item.delta < 0)).toHaveLength(2);
  });
  it.each(["unsupported", "needs-better-reference"] as const)("blocks %s references and forged confirmations before main generation", async eligibility => {
    const f = await fixture();
    const claim = await f.begin();
    await f.t.mutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify({ ...scan, eligibility, parts: [] }) });
    expect((await f.owner.client.query(api.customKits.get, { kitId: f.kitId }))!.versionId).toBeNull();
    await expect(f.owner.client.mutation(internal.creativePipeline.begin, { ...f.common, customKitId: f.kitId, kind: "palette-plan", requestKey: "invalid" })).rejects.toThrow(/exactly one/);
    expect(await f.t.run(ctx => ctx.db.query("promptCompositions").collect())).toHaveLength(0);
  });
  it("charges a policy-blocked scan, locks the Kit and hands its reference to deletion", async () => {
    const f = await fixture();
    const kit = (await f.t.run(ctx => ctx.db.get(f.kitId)))!;
    const claim = await f.begin();
    const blocked = { ...scan, contentSafety: { verdict: "blocked", category: "adult-content" }, eligibility: "unsupported", reason: "Model description that must not be stored.", parts: [], uncertainFeatures: [] };
    await f.t.mutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(blocked) });
    const record = (await f.owner.client.query(api.customKits.get, { kitId: f.kitId }))!;
    expect(record.blocked).toBe(true);
    expect(record.versionId).toBeNull();
    expect(record.scanResultJson).not.toContain("must not be stored");
    expect(await f.owner.client.query(api.customKits.mine, {})).toHaveLength(0);
    const saved = (await f.t.run(ctx => ctx.db.get(claim.scanId)))!;
    expect(saved.safetyBlocked).toBe(true);
    expect(saved.refunded).toBe(false);
    await f.t.mutation(internal.customKits.failScan, { scanId: claim.scanId, reason: "Late timeout" });
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").collect());
    expect(tx.filter(item => item.referenceTable === "customKitScans" && item.delta > 0)).toHaveLength(0);
    await expect(f.begin()).rejects.toThrow(/unavailable/);
    const cleanup = await f.t.mutation(internal.storageLifecycle.claimExpiredObjects, {});
    expect(cleanup.some(item => item.storageObjectId === kit.storageObjectId)).toBe(true);
  });
  it("pauses uploads and scans after three policy blocks within 30 days", async () => {
    const f = await fixture();
    const kit = (await f.t.run(ctx => ctx.db.get(f.kitId)))!;
    await f.t.run(async ctx => {
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("customKitScans", { userId: kit.userId, customKitId: kit._id, referenceVersionId: kit.referenceVersionId, cacheKey: `strike-${index}`, modelId: "test",
          profileId: f.profileId, scanVersion: "kit-scan.v2", status: "succeeded", cost: 1, refunded: false, expiresAt: Date.now(), safetyBlocked: true });
      }
    });
    await expect(f.owner.client.mutation(internal.customKits.createUpload, { name: "Again", contentType: "image/png", byteSize: 1000 })).rejects.toThrow(/paused/);
    await expect(f.begin()).rejects.toThrow(/paused/);
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60_000);
    await expect(f.owner.client.mutation(internal.customKits.createUpload, { name: "Later", contentType: "image/png", byteSize: 1000 })).resolves.toBeTruthy();
  });
  it("rejects blocked verdicts that still carry structure or a mismatched category", () => {
    expect(kitScanSchema.safeParse({ ...scan, contentSafety: { verdict: "blocked", category: "graphic-injury" }, eligibility: "unsupported" }).success).toBe(false);
    expect(kitScanSchema.safeParse({ ...scan, contentSafety: { verdict: "allowed", category: "hateful-symbol" } }).success).toBe(false);
    expect(kitScanSchema.safeParse({ ...scan, contentSafety: { verdict: "blocked", category: "none" }, eligibility: "unsupported", parts: [], uncertainFeatures: [] }).success).toBe(false);
  });
  it("keeps raw scans immutable, invalidates edited version keys and rejects hidden part edits", async () => {
    const f = await fixture();
    const first = await confirmKit(f, true);
    const record = (await f.owner.client.query(api.customKits.get, { kitId: f.kitId }))!;
    const snapshot = JSON.parse(record.snapshotJson!);
    expect(snapshot.observations).toEqual(scan);
    expect(snapshot.effectiveParts[1].description).toBe("Two separate shoulder shells.");
    expect(snapshot.requestedEdits).toHaveLength(1);
    await expect(f.owner.client.mutation(api.customKits.confirm, { kitId: f.kitId, expectedVersionId: first.versionId, changesJson: JSON.stringify({ corrections: [], requestedEdits: [{ partId: "unseen-back", action: "add", description: "New connector" }] }) })).rejects.toThrow(/visible/);
    const next = await f.owner.client.mutation(api.customKits.confirm, { kitId: f.kitId, expectedVersionId: first.versionId, changesJson: '{"corrections":[],"requestedEdits":[]}' });
    expect(creativeInputKey({ customKitId: f.kitId, customKitVersionId: first.versionId })).not.toBe(creativeInputKey({ customKitId: f.kitId, customKitVersionId: next }));
    await expect(f.owner.client.mutation(internal.creativePipeline.begin, { ...f.common, customKitId: f.kitId, customKitVersionId: first.versionId, kind: "palette-plan", requestKey: "stale" })).rejects.toThrow(/confirm/);
    expect(JSON.parse((await f.t.run(ctx => ctx.db.get(first.scanId)))!.resultJson!)).toEqual(scan);
  });
  it("does not let a late model result revive an expired refunded scan", async () => {
    const f = await fixture();
    const claim = await f.begin();
    await f.t.run(ctx => ctx.db.patch(claim.scanId, { expiresAt: Date.now() - 1 }));
    await f.t.mutation(internal.customKits.failScan, { scanId: claim.scanId, reason: "Timeout" });
    await f.t.mutation(internal.customKits.completeScan, { scanId: claim.scanId, resultJson: JSON.stringify(scan) });
    expect((await f.t.run(ctx => ctx.db.get(claim.scanId)))!.status).toBe("failed");
  });
  it("rejects changed references and foreign upload tickets", async () => {
    const f = await fixture();
    const { versionId } = await confirmKit(f);
    const ticket = await f.owner.client.mutation(internal.customKits.createUpload, { name: "Next", contentType: "image/webp", byteSize: 1000 });
    await expect(f.other.client.mutation(internal.customKits.claimUpload, { uploadId: ticket._id })).rejects.toThrow(/expired/);
    const kit = await f.t.run(ctx => ctx.db.get(f.kitId));
    await f.t.run(ctx => ctx.db.patch(kit!.storageObjectId, { checksum: "replacement" }));
    await expect(f.owner.client.mutation(internal.creativePipeline.begin, { ...f.common, customKitId: f.kitId, customKitVersionId: versionId, kind: "palette-plan", requestKey: "changed-ref" })).rejects.toThrow(/reference/);
  });
  it("marks descriptions of new parts as proposals rather than scan observations", () => {
    const parts = effectiveKitParts(scan, { corrections: [], requestedEdits: [{ partId: "body", action: "add", description: "Add wing plates." }] });
    expect(parts.at(-1)?.source).toBe("user-request");
    expect(scan.parts).toHaveLength(2);
    expect(kitScanSchema.safeParse({ ...scan, parts: [scan.parts[0], scan.parts[0]] }).success).toBe(false);
  });
  it.each(["preset", "custom"])("uses the shared palette, specification and reference-view render with %s Style", async styleMode => {
    const f = await fixture();
    const { versionId } = await confirmKit(f, true);
    const input = { ...f.common, customKitId: f.kitId, customKitVersionId: versionId,
      ...(styleMode === "custom" ? { stylePresetId: undefined, styleRevision: undefined, styleIntentJson: JSON.stringify({ ...JSON.parse(f.style.styleIntentJson!), source: "private", styleType: "custom" }) } : {}) };
    const paletteId = await f.owner.client.mutation(internal.creativePipeline.begin, { ...input, kind: "palette-plan", requestKey: `palette-${styleMode}` });
    const composition = (await f.t.run(ctx => ctx.db.get(paletteId)))!;
    const snapshot = JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot;
    expect(snapshot.resolvedIntent!.kit!.source).toBe("custom");
    expect(snapshot.resolvedIntent!.constraints.some(item => item.id === "kit-edit:0")).toBe(true);
    const permissions = requiredPaletteRolesForExecution(snapshot.resolvedIntent!);
    const palette = { version: "visual-palette.v3", entries: snapshot.resolvedIntent!.colors.map(color => ({ colorId: color.colorId, colorName: color.name,
      roleSlug: permissions.find(item => item.colorId === color.colorId)!.allowedRoleSlugs[0], targetHex: color.hex ?? "#888888", paintEffect: "solid", rationale: "Resolved palette target" })), sprayNotes: ["Apply thin coats."] };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: paletteId, responseJson: JSON.stringify(palette), executionJson: "{}" });
    const concept = await f.owner.client.mutation(api.prototypes.initializePrototype, { ...input, paletteCompositionId: paletteId, requestKey: `spec-${styleMode}` });
    const specification = { version: "repaint-specification.v3", summary: "Custom shoulder modification with approved paint colors",
      panels: palette.entries.map((entry, index) => ({ assignmentId: `assignment-${index}`, colorId: entry.colorId, roleSlug: entry.roleSlug, areas: ["body", "shoulders"], maskingNotes: "Mask at armor seams." })),
      material: { finish: snapshot.resolvedIntent!.effectiveStyle.finish, intent: snapshot.resolvedIntent!.effectiveStyle.materialIntent, surfaceTexture: "Smooth", reflectivity: "Low", coating: "Thin" },
      weathering: { level: "clean", applicationNotes: "No wear." }, decals: { density: "none", placementNotes: "No decals." } };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: concept.promptCompositionId, responseJson: JSON.stringify(specification), executionJson: "{}" });
    const render = await f.owner.client.mutation(api.prototypeTools.requestHdRender, { conceptId: concept.conceptId });
    expect(render).toBeTruthy();
    const saved = (await f.t.run(ctx => ctx.db.get(concept.conceptId)))!;
    expect(saved.baseModelId).toBeUndefined();
    expect(customKitDisplay(saved.customKitSnapshotJson)?.name).toBe("Original Robot");
    const detail = await f.owner.client.query(api.libraryDetails.get, { conceptId: saved._id });
    expect(detail!.kit!.grade).toBe("Custom Kit");
    expect(JSON.stringify(detail)).not.toContain("secret-custom-reference");
    await expect(f.owner.client.mutation(api.prototypeTools.requestMultiAnglePreview, { conceptId: saved._id })).rejects.toThrow(/reference-view/);
  });
});
