import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import workflowTest from "@convex-dev/workflow/test";
import type { WorkflowId } from "@convex-dev/workflow";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { seedUser } from "@/tests/convexTestHelpers";
import { createAssetGraph } from "./assetModel";
import type { CreativeSnapshot } from "./creativePipeline";
import { sourceNormalizationProtocolVersion, styleIntentSchema, type NormalizedRequirement } from "./creativeContracts";
import { convexErrorMessage } from "@/src/lib/convexError";
import { executeTextRequest } from "./textGenerationNode";
import { localChitinMaterialStyle, orangeShadesDescription, orangeShadesStyle } from "@/tests/fixtures/orangeShades";

vi.mock("./textGenerationNode", () => ({ executeTextRequest: vi.fn() }));

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.mocked(executeTextRequest).mockReset(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function fixture(balance = 20) {
  const t = convexTest(schema, modules);
  workflowTest.register(t);
  await t.mutation(internal.init.init, {});
  const owner = await seedUser(t, { tokenIdentifier: "run-owner", email: "owner@example.test", balance });
  const data = await t.run(async ctx => ({ kit: (await ctx.db.query("baseModels").first())!, style: (await ctx.db.query("stylePresets").first())!, material: (await ctx.db.query("materialPresets").first())!, roles: await ctx.db.query("colorRoles").collect() }));
  const input = { kitVariantId: data.kit._id, stylePresetId: data.style._id, styleRevision: data.style.styleIntentJson, materialPresetId: data.material._id, weatheringLevel: "clean" as const };
  const cost = (await owner.client.query(api.creationRuns.quote, {}))!.cost;
  return { t, ...owner, data, input, cost };
}
async function saveCustomStyle(f: Awaited<ReturnType<typeof fixture>>, description: string, requirements: NormalizedRequirement[]) {
  const intent = styleIntentSchema.parse({ ...JSON.parse(f.data.style.styleIntentJson!), version: "style-intent.v3", source: "private", styleType: "custom",
    colors: [{ role: "primary", name: "Industrial gray", hex: "#78828C", coverage: 100 }], pattern: "none",
    explicitRequirements: { version: "normalized-user-intent.v1", requirements, unresolved: [] } });
  const promptCompositionId = await f.t.run(ctx => ctx.db.insert("promptCompositions", {
    userId: f.userId, status: "consumed", composedPrompt: "Completed interpretation",
    inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description }),
    outputSummaryJson: JSON.stringify({ intent, sourceNormalizationProtocolVersion }),
  }));
  return await f.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId });
}
async function finishPalette(f: Awaited<ReturnType<typeof fixture>>, runId: Id<"creationRuns">) {
  const run = (await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 1 }))!;
  const composition = (await f.t.run(ctx => ctx.db.get(run.paletteId!)))!;
  const intent = (JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot).resolvedIntent!;
  await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: run.paletteId!,
    responseJson: JSON.stringify({ version: "visual-palette.v3", entries: intent.colors.map(color => ({ colorId: color.colorId, colorName: color.name,
      roleSlug: color.scope.kind === "inner-frame" ? "inner-frame" : color.scope.kind === "sensors" ? "sensor-color" : color.scope.kind === "markings" ? "markings" : "primary-armor",
      targetHex: color.hex ?? "#EEEEEE", paintEffect: "solid", rationale: "Neutral build" })), sprayNotes: ["Thin coats"] }), executionJson: "{}" });
  await f.t.mutation(internal.creationRuns.advance, { runId, attempt: 1 });
}

describe("complete preview runs", () => {
  it.each([{ label: "orange shades", savedIntent: orangeShadesStyle }, { label: "local chitin material", savedIntent: localChitinMaterialStyle }])("starts the saved $label style, freezes distinct colors and charges one preview", async ({ savedIntent }) => {
    const f = await fixture();
    const promptCompositionId = await f.t.run(ctx => ctx.db.insert("promptCompositions", {
      userId: f.userId, status: "consumed", composedPrompt: "Completed interpretation",
      inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description: orangeShadesDescription }),
      outputSummaryJson: JSON.stringify({ intent: savedIntent, sourceNormalizationProtocolVersion }),
    }));
    const saved = await f.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId });
    const input = { ...f.input, stylePresetId: undefined, styleRevision: undefined, userStyleId: saved.styleId, styleIntentJson: JSON.stringify(saved.intent) };
    const args = { input, requestKey: "orange-shades", expectedCost: f.cost };
    const runId = await f.client.mutation(api.creationRuns.start, args);
    expect(await f.client.mutation(api.creationRuns.start, args)).toBe(runId);
    const run = (await f.t.run(ctx => ctx.db.get(runId)))!;
    const palette = (await f.t.run(ctx => ctx.db.get(run.paletteId!)))!;
    const intent = (JSON.parse(palette.inputSnapshotJson) as CreativeSnapshot).resolvedIntent!;
    expect(intent.conflicts).toEqual([]);
    expect(intent.colors.find(c => c.name === "Bright Orange")).toMatchObject({ colorId: "style-color-1", visualRole: "primary", hex: "#FF6600" });
    expect(intent.colors.find(c => c.name === "Burnt Orange")).toMatchObject({ colorId: "style-color-2", visualRole: "secondary", hex: "#A33B00" });
    expect(intent.colors).toHaveLength(6);
    expect(JSON.parse((await f.t.run(ctx => ctx.db.get(saved.styleId)))!.intentJson)).toEqual(savedIntent);
    await finishPalette(f, runId);
    const advanced = (await f.t.run(ctx => ctx.db.get(runId)))!;
    expect(advanced.stage).toBe("specification");
    const concept = (await f.t.run(ctx => ctx.db.get(advanced.conceptId!)))!;
    const frozen = JSON.parse(concept.visualPaletteJson!);
    expect(frozen.entries).toHaveLength(6);
    expect(frozen.entries.find((c: { colorName: string }) => c.colorName === "Burnt Orange").targetHex).toBe("#A33B00");
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_userId", q => q.eq("userId", f.userId)).collect());
    expect(tx.filter(t => t.delta < 0)).toHaveLength(1);
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique()))!.balance).toBe(20 - f.cost);
  });

  it.each([true, false])("keeps one preview charge and a single refund decision when palette correction succeeds=%s", async corrected => {
    const f = await fixture();
    await f.t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-2.5-flash" });
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: `correct-${corrected}`, expectedCost: f.cost });
    const stage = await f.t.mutation(internal.creationRuns.claimWorkflowStage, { runId, attempt: 1 });
    if (!stage || stage.kind === "render") throw new Error("Expected palette stage");
    const composition = (await f.t.run(ctx => ctx.db.get(stage.promptCompositionId)))!;
    const intent = (JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot).resolvedIntent!;
    const json = { version: "visual-palette.v3", entries: intent.colors.map(color => ({ colorId: color.colorId, colorName: color.name,
      roleSlug: color.scope.kind === "inner-frame" ? "inner-frame" : color.scope.kind === "sensors" ? "sensor-color" : color.scope.kind === "markings" ? "markings" : "primary-armor",
      targetHex: color.hex ?? "#EEEEEE", paintEffect: "solid", rationale: "Keep approved colors" })), sprayNotes: ["Thin coats"] };
    const invalid = structuredClone(json);
    invalid.entries[0].roleSlug = "unknown-role";
    const response = (value: typeof json) => ({ json: value, text: JSON.stringify(value), model: "fixture", profileId: "fixture", providerRequestId: null, usage: null });
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(invalid)).mockResolvedValueOnce(response(corrected ? json : invalid));
    if (corrected) {
      await f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: stage.promptCompositionId });
      await f.t.mutation(internal.creationRuns.advanceWorkflow, { runId, attempt: 1 });
      expect((await f.t.run(ctx => ctx.db.get(runId)))!.stage).toBe("specification");
    } else {
      await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: stage.promptCompositionId })).rejects.toThrow(/unknown role/);
      const run = (await f.t.run(ctx => ctx.db.get(runId)))!;
      await f.t.mutation(internal.creationRuns.completeWorkflow, { workflowId: run.workflowId! as WorkflowId, context: { runId, attempt: 1 }, result: { kind: "failed", error: "Palette uses an unknown role" } });
      await f.t.mutation(internal.creationRuns.expire, { runId, attempt: 1 });
    }
    expect(executeTextRequest).toHaveBeenCalledTimes(2);
    const account = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    expect(account!.balance).toBe(corrected ? 20 - f.cost : 20);
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_userId", q => q.eq("userId", f.userId)).collect());
    expect(tx.filter(row => row.delta < 0)).toHaveLength(1);
    expect(tx.filter(row => row.delta > 0)).toHaveLength(corrected ? 0 : 1);
  });

  it("retains private workflow diagnostics but only exposes a fixed recovery message to the owner", async () => {
    const f = await fixture();
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "private-diagnostics", expectedCost: f.cost });
    const reason = "Error: Uncaught ConvexError: Palette violates color-family for Fiery Orange\n at run (../../node_modules/@convex-dev/workflow/src/client/workflowContext.ts:321:9)";
    await f.t.mutation(internal.creationRuns.fail, { runId, attempt: 1, reason });
    const publicRun = await f.client.query(api.creationRuns.latest, {});
    expect(publicRun?.error).toContain("match the palette to your color requirements");
    expect(publicRun?.error).not.toMatch(/ConvexError|node_modules|workflowContext|Fiery Orange/);
    expect(publicRun?.refunded).toBe(true);
    expect((await f.t.run(ctx => ctx.db.get(runId)))?.error).toBe(reason);
    const other = await seedUser(f.t, { tokenIdentifier: "diagnostics-other", email: "diagnostics-other@example.test", balance: 20 });
    expect(await other.client.query(api.creationRuns.latest, {})).toBeNull();
  });

  it("starts a saved custom style with two mood clauses and charges the preview once", async () => {
    const f = await fixture();
    const saved = await saveCustomStyle(f, "hazard unit  Industrial Alert", [
      { id: "hazard", property: "mood", operation: "set", scope: { kind: "whole-kit" }, value: "industrial hazard support", evidence: { inputRef: "style-description", quote: "hazard unit" } },
      { id: "alert", property: "mood", operation: "set", scope: { kind: "whole-kit" }, value: "high-visibility warning", evidence: { inputRef: "style-description", quote: "Industrial Alert" } },
    ]);
    const args = { input: { ...f.input, stylePresetId: undefined, styleRevision: undefined, userStyleId: saved.styleId, styleIntentJson: JSON.stringify(saved.intent) }, requestKey: "combined-mood", expectedCost: f.cost };
    const runId = await f.client.mutation(api.creationRuns.start, args);
    expect(await f.client.mutation(api.creationRuns.start, args)).toBe(runId);
    const run = (await f.t.run(ctx => ctx.db.get(runId)))!;
    const palette = (await f.t.run(ctx => ctx.db.get(run.paletteId!)))!;
    expect((JSON.parse(palette.inputSnapshotJson) as CreativeSnapshot).resolvedIntent?.effectiveStyle.mood)
      .toBe("industrial hazard support, high-visibility warning");
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
    expect(await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_reference", q => q.eq("referenceTable", "creationRuns").eq("referenceId", runId)).collect())).toHaveLength(1);
  });

  it("returns readable requirement conflicts and rolls back the preview and debit", async () => {
    const f = await fixture();
    const saved = await saveCustomStyle(f, "matte and gloss", ["matte", "gloss"].map(value => ({
      id: value, property: "finish", operation: "set", scope: { kind: "whole-kit" }, value, evidence: { inputRef: "style-description", quote: value },
    })));
    const error = await f.client.mutation(api.creationRuns.start, {
      input: { ...f.input, stylePresetId: undefined, styleRevision: undefined, userStyleId: saved.styleId, styleIntentJson: JSON.stringify(saved.intent) },
      requestKey: "conflicting-finish", expectedCost: f.cost,
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ConvexError);
    expect(convexErrorMessage(error, "Unexpected server error")).toContain("Explicit finish conflicts");
    expect(await f.t.run(ctx => ctx.db.query("creationRuns").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("creditTransactions").collect())).toHaveLength(0);
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20);
  });

  it("repairs a historical failed retry by its debit once and rejects mismatched repairs", async () => {
    const f = await fixture();
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "historical", expectedCost: f.cost });
    const firstDebit = (await f.t.run(ctx => ctx.db.get(runId)))!.creditTransactionId!;
    await f.t.mutation(internal.creationRuns.fail, { runId, attempt: 1, reason: "First failure" });
    await f.client.mutation(api.creationRuns.retry, { runId });
    const retryDebit = (await f.t.run(ctx => ctx.db.get(runId)))!.creditTransactionId!;
    const generationJobId = await f.t.run(async ctx => {
      await ctx.db.patch(runId, { creditTransactionId: firstDebit });
      return await ctx.db.insert("generationJobs", { userId: f.userId, kind: "hd-preview", status: "failed", requestedCredits: 0, creationRunId: runId, creationAttempt: 2 });
    });
    await f.t.mutation(internal.creationRuns.fail, { runId, attempt: 2, reason: "Historical retry failure" });
    await f.client.mutation(api.creationRuns.retry, { runId });
    const args = { userId: f.userId, generationJobId, debitTransactionId: retryDebit, expectedAmount: f.cost };
    await expect(f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, args)).rejects.toThrow(/settled/);
    await f.t.run(ctx => ctx.db.patch(runId, { status: "succeeded" }));
    await expect(f.t.query(internal.creationRuns.inspectHistoricalRefund, args)).resolves.toEqual({ runId, amount: f.cost, alreadyRefunded: false });
    await expect(f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, { ...args, debitTransactionId: firstDebit })).rejects.toThrow(/unambiguously/);
    await expect(f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, { ...args, expectedAmount: f.cost + 1 })).rejects.toThrow(/expected amount/);
    const other = await seedUser(f.t, { tokenIdentifier: "repair-other", email: "repair-other@example.test" });
    await expect(f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, { ...args, userId: other.userId })).rejects.toThrow(/owned/);
    await f.t.run(ctx => ctx.db.patch(generationJobId, { status: "succeeded" }));
    await expect(f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, args)).rejects.toThrow(/failed preview retry/);
    await f.t.run(ctx => ctx.db.patch(generationJobId, { status: "failed" }));
    const first = await f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, args);
    const second = await f.t.mutation(internal.creationRuns.refundHistoricalFailedAttempt, args);
    expect(first).toMatchObject({ refunded: true, balanceAfter: 20 - f.cost });
    expect(second).toMatchObject({ refunded: false, transactionId: first.transactionId });
    const refund = await f.t.run(ctx => ctx.db.get(first.transactionId));
    expect(refund).toMatchObject({ refundOfTransactionId: retryDebit, generationJobId, delta: f.cost });
    expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("succeeded");
  });

  it("refunds every failed attempt once and only charges the successful attempt", async () => {
    const f = await fixture();
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "repeated-failure", expectedCost: f.cost });
    const debitIds: string[] = [];
    for (const attempt of [1, 2]) {
      const run = (await f.t.run(ctx => ctx.db.get(runId)))!;
      debitIds.push(run.creditTransactionId!);
      await f.t.mutation(internal.creationRuns.fail, { runId, attempt, reason: "Provider failed" });
      await f.t.mutation(internal.creationRuns.expire, { runId, attempt });
      expect((await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique()))?.balance).toBe(20);
      await f.client.mutation(api.creationRuns.retry, { runId });
      await f.t.mutation(internal.creationRuns.expire, { runId, attempt });
      expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("queued");
    }
    const finalRun = (await f.t.run(ctx => ctx.db.get(runId)))!;
    debitIds.push(finalRun.creditTransactionId!);
    expect(new Set(debitIds).size).toBe(3);
    await f.t.run(ctx => ctx.db.patch(runId, { status: "succeeded" }));
    await f.t.mutation(internal.creationRuns.expire, { runId, attempt: 3 });
    const transactions = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_userId", q => q.eq("userId", f.userId)).collect());
    expect(transactions.filter(tx => tx.actionType === "generation-refund").map(tx => tx.refundOfTransactionId)).toEqual(debitIds.slice(0, 2));
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique()))?.balance).toBe(20 - f.cost);
  });

  it("reserves the full quote once and rejects stale prices, mismatched retries and insufficient balances", async () => {
    const f = await fixture();
    await expect(f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "price", expectedCost: f.cost - 1 })).rejects.toThrow(/price changed/);
    const args = { input: f.input, requestKey: "one", expectedCost: f.cost };
    await expect(f.t.mutation(api.creationRuns.start, args)).rejects.toThrow(/authenticated/);
    const id = await f.client.mutation(api.creationRuns.start, args);
    expect(await f.client.mutation(api.creationRuns.start, args)).toBe(id);
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
    await expect(f.client.mutation(api.creationRuns.start, { ...args, input: { ...f.input, notes: "Changed" } })).rejects.toThrow(/another preview/);
    await expect(f.client.mutation(api.creationRuns.start, { ...args, requestKey: "two" })).rejects.toThrow(/already in progress/);
    const poor = await fixture(1);
    await expect(poor.client.mutation(api.creationRuns.start, { input: poor.input, requestKey: "poor", expectedCost: poor.cost })).rejects.toThrow(/requires/);
    expect(await poor.t.run(ctx => ctx.db.query("creationRuns").collect())).toHaveLength(0);
  });

  it("refunds a failed run only once, rejects foreign retries, and ignores expired attempts", async () => {
    const f = await fixture();
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "refund", expectedCost: f.cost });
    const started = (await f.t.run(ctx => ctx.db.get(runId)))!;
    expect(started.workflowId).toBeDefined();
    await f.t.mutation(internal.creationRuns.completeWorkflow, {
      workflowId: started.workflowId! as WorkflowId,
      result: { kind: "failed", error: "Provider failed" },
      context: { runId, attempt: 1 },
    });
    await f.t.mutation(internal.creationRuns.expire, { runId, attempt: 1 });
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20);
    const other = await seedUser(f.t, { tokenIdentifier: "other", email: "other@example.test", balance: 20 });
    await expect(other.client.mutation(api.creationRuns.retry, { runId })).rejects.toThrow(/unavailable/);
    await f.client.mutation(api.creationRuns.retry, { runId });
    await f.t.mutation(internal.creationRuns.expire, { runId, attempt: 1 });
    expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("queued");
    const transactions = await f.t.run(ctx => ctx.db.query("creditTransactions").collect());
    expect(transactions.filter(tx => tx.actionType === "generation-refund")).toHaveLength(1);
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
  });

  it("chains approved palette, specification and image without additional debits and resumes after image failure", async () => {
    const f = await fixture();
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "chain", expectedCost: f.cost });
    await finishPalette(f, runId);
    const specRun = (await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 1 }))!;
    const prepared = (await f.t.run(ctx => ctx.db.get(specRun.conceptId!)))!;
    const palette = JSON.parse(prepared.visualPaletteJson!) as { entries: Array<{ colorId: string; roleSlug: string }> };
    const effective = JSON.parse(prepared.resolvedIntentJson!).effectiveStyle;
    const spec = { version: "repaint-specification.v3", summary: "Neutral model", panels: palette.entries.map((color, index) => ({ assignmentId: `assignment-${index}`, colorId: color.colorId, roleSlug: color.roleSlug, areas: ["Existing armor panels"], maskingNotes: "Follow panel edges" })), material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte", finish: effective.finish, intent: effective.materialIntent }, weathering: { level: "clean", applicationNotes: "No wear" }, decals: { density: "low", placementNotes: "Shoulders" } };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: specRun.specificationId!, responseJson: JSON.stringify(spec), executionJson: "{}" });
    await f.t.mutation(internal.creationRuns.advance, { runId, attempt: 1 });
    const imageRun = (await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 1 }))!;
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
    const concept = (await f.t.run(ctx => ctx.db.get(imageRun.conceptId!)))!;
    expect(concept.visibility).toBe("private");
    expect(concept.visualPaletteJson).toBeDefined();
    await f.t.mutation(internal.creationRuns.fail, { runId, attempt: 1, reason: "Image failed" });
    const libraryConcept = (await f.client.query(api.concepts.listLibrary, {}))
      .find((item) => item._id === concept._id);
    expect(libraryConcept?.generationJob?.creationRunId).toBe(runId);
    await f.client.mutation(api.creationRuns.retry, { runId });
    const retried = (await f.t.run(ctx => ctx.db.get(runId)))!;
    expect(retried.stage).toBe("render");
    expect(retried.paletteId).toBe(imageRun.paletteId);
    expect(retried.specificationId).toBe(imageRun.specificationId);
    expect(retried.renderJobId).not.toBe(imageRun.renderJobId);
    expect(await f.t.query(internal.creationRuns.jobIsRunnable, { generationJobId: imageRun.renderJobId! })).toBe(false);
    await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 2 });
    await f.t.run(ctx => ctx.db.patch(retried.renderJobId!, { status: "succeeded" }));
    await f.t.mutation(internal.creationRuns.advance, { runId, attempt: 2 });
    await f.t.mutation(internal.creationRuns.expire, { runId, attempt: 2 });
    expect((await f.client.query(api.creationRuns.latest, {}))?.status).toBe("succeeded");
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
  });

  it("exposes full-body loading image with cover fallback on the latest run payload", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.test";
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.data.kit._id, {
        thumbnailAssetKey: "catalog/kits/demo/cover.webp",
        fullBodyAssetKey: "catalog/kits/demo/fullbody.webp",
      });
    });
    await f.client.mutation(api.creationRuns.start, {
      input: f.input,
      requestKey: "images",
      expectedCost: f.cost,
    });
    const latest = await f.client.query(api.creationRuns.latest, {});
    expect(latest?.kit?.portrait).toBe("https://cdn.example.test/catalog/kits/demo/cover.webp");
    expect(latest?.kit?.fullBody).toBe("https://cdn.example.test/catalog/kits/demo/fullbody.webp");

    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.data.kit._id, { fullBodyAssetKey: undefined });
    });
    const fallback = await f.client.query(api.creationRuns.latest, {});
    expect(fallback?.kit?.fullBody).toBe("https://cdn.example.test/catalog/kits/demo/cover.webp");
  });

  it("shows the uploaded photo and a viewable preview instead of the original file", async () => {
    const f = await fixture();
    await f.t.mutation(internal.init.seedEntitlementProfiles, {});
    await f.t.run(async (ctx) => {
      const profile = (await ctx.db.query("entitlementProfiles").withIndex("by_slug", (q) => q.eq("slug", "free-mvp-v2")).unique())!;
      await ctx.db.patch(profile._id, { originalDownloadAllowed: false });
    });
    const runId = await f.client.mutation(api.creationRuns.start, { input: f.input, requestKey: "custom-preview", expectedCost: f.cost });
    const ids = await f.t.run(async (ctx) => {
      const conceptId = await ctx.db.insert("concepts", {
        userId: f.userId, title: "Front photo repaint", status: "generated", visibility: "private", weatheringLevel: "clean", searchText: "Front photo",
      });
      const uploaded = await createAssetGraph(ctx, {
        legacyAsset: { userId: f.userId, key: "reference.webp", bucket: "private-library", kind: "reference", status: "active", contentType: "image/webp", byteSize: 1000 },
        mediaKind: "reference-image", rendition: "source", origin: "uploaded", bucketRole: "private", title: "Front photo",
      });
      const kitId = await ctx.db.insert("customKits", {
        userId: f.userId, name: "Front photo", storageObjectId: uploaded.storageObjectId, referenceVersionId: uploaded.assetVersionId, checksum: "abc", status: "active", updatedAt: Date.now(),
      });
      const graph = await createAssetGraph(ctx, {
        legacyAsset: { userId: f.userId, key: "secret/original.png", bucket: "private-library", kind: "preview", status: "active", contentType: "image/png", byteSize: 3000 },
        mediaKind: "generated-image", rendition: "original", origin: "generated", bucketRole: "private", conceptId,
      });
      const source = (await ctx.db.get(graph.storageObjectId))!;
      const { _id, _creationTime, ...fields } = source;
      const masterId = await ctx.db.insert("storageObjects", { ...fields, rendition: "master", key: "secret/master.webp", contentType: "image/webp" });
      await ctx.db.patch(conceptId, {
        mediaAssetId: graph.mediaAssetId, currentAssetVersionId: graph.assetVersionId, previewAssetId: graph.legacyAssetId,
        customKitSnapshotJson: JSON.stringify({ kind: "custom", id: kitId, name: "Front photo", version: 1, storageObjectId: "not-a-storage-id" }),
      });
      await ctx.db.patch(runId, { conceptId, status: "succeeded", stage: "render", inputJson: JSON.stringify({ ...f.input, customKitId: kitId, kitVariantId: undefined }) });
      return { masterId, reference: uploaded.storageObjectId, originalId: graph.storageObjectId };
    });
    const latest = await f.client.query(api.creationRuns.latest, {});
    expect(latest?.kit).toMatchObject({ name: "Front photo", grade: "Custom Kit", referenceObjectId: ids.reference });
    expect(latest?.previewAsset?.storageObjectId).toBe(ids.masterId);
    expect(latest?.previewAsset?.storageObjectId).not.toBe(ids.originalId);
    expect(JSON.stringify(latest)).not.toContain("secret/");
  });
});
