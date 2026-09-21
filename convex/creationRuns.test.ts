import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import workflowTest from "@convex-dev/workflow/test";
import type { WorkflowId } from "@convex-dev/workflow";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function fixture(balance = 20) {
  const t = convexTest(schema, modules);
  workflowTest.register(t);
  await t.mutation(internal.init.init, {});
  const owner = await seedUser(t, { tokenIdentifier: "run-owner", email: "owner@example.test", balance });
  const data = await t.run(async ctx => ({ kit: (await ctx.db.query("baseModels").first())!, style: (await ctx.db.query("stylePresets").first())!, material: (await ctx.db.query("materialPresets").first())!, roles: await ctx.db.query("colorRoles").collect() }));
  const input = { kitVariantId: data.kit._id, stylePresetId: data.style._id, materialPresetId: data.material._id, weatheringLevel: "clean" as const };
  const cost = (await owner.client.query(api.creationRuns.quote, {}))!.cost;
  return { t, ...owner, data, input, cost };
}
async function finishPalette(f: Awaited<ReturnType<typeof fixture>>, runId: Id<"creationRuns">) {
  const run = (await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 1 }))!;
  await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: run.paletteId!,
    responseJson: JSON.stringify({ entries: f.data.roles.map(role => ({ roleSlug: role.slug, targetHex: "#EEEEEE", paintEffect: "solid", rationale: "Neutral build" })), sprayNotes: ["Thin coats"] }), executionJson: "{}" });
  await f.t.mutation(internal.creationRuns.advance, { runId, attempt: 1 });
}

describe("complete preview runs", () => {
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
    const spec = { summary: "Neutral model", panels: f.data.roles.map(role => ({ roleSlug: role.slug, areas: [role.name], maskingNotes: "Follow panel edges" })), material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte" }, weathering: { level: "clean", applicationNotes: "No wear" }, decals: { density: "low", placementNotes: "Shoulders" } };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: specRun.specificationId!, responseJson: JSON.stringify(spec), executionJson: "{}" });
    await f.t.mutation(internal.creationRuns.advance, { runId, attempt: 1 });
    const imageRun = (await f.t.mutation(internal.creationRuns.claim, { runId, attempt: 1 }))!;
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").first()))?.balance).toBe(20 - f.cost);
    const concept = (await f.t.run(ctx => ctx.db.get(imageRun.conceptId!)))!;
    expect(concept.visibility).toBe("private");
    expect(concept.visualPaletteJson).toBeDefined();
    await f.t.mutation(internal.creationRuns.fail, { runId, attempt: 1, reason: "Image failed" });
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
});
