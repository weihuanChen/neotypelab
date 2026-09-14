import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { seedUser } from "@/tests/convexTestHelpers";
import { buildPaintPlan } from "./paintMappingEngine";

const customIntent = {
  version: "style-intent.v1", source: "private", styleType: "custom", name: "Cyan Performance",
  palette: { primary: "cyan teal", secondary: "charcoal", accent: "magenta" },
  surfaceLogic: "smooth", graphicLanguage: "racing", contrast: "high", markingDensity: "medium",
  materialIntent: ["painted armor"], mood: "energetic", weathering: "clean", finish: "satin", paintability: "high",
};
const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;
async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.init.init, {});
  const user = await seedUser(t, { tokenIdentifier: "creative-pilot", email: "creative@example.test", balance: 30 });
  await t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-2.5-flash" });
  const catalog = await t.run(async ctx => ({
    model: (await ctx.db.query("baseModels").first())!, style: (await ctx.db.query("stylePresets").first())!,
    material: (await ctx.db.query("materialPresets").first())!, roles: await ctx.db.query("colorRoles").collect(),
  }));
  const input = { kitVariantId: catalog.model._id, stylePresetId: catalog.style._id, materialPresetId: catalog.material._id, weatheringLevel: "clean" as const, moodTags: [] };
  return { t, ...user, catalog, input };
}
async function completePalette(f: Awaited<ReturnType<typeof fixture>>) {
  const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "palette-1" });
  const output = { entries: f.catalog.roles.map(r => ({ roleSlug: r.slug, targetHex: "#EEEEEE", paintEffect: "solid", rationale: "Use a consistent neutral armor hierarchy." })), sprayNotes: ["Apply thin coats."] };
  await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: '{"model":"fixture"}' });
  return id;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("creative pipeline", () => {
  it("rejects invalid and ambiguous intents before charging", async () => {
    const f = await fixture();
    await expect(f.client.mutation(internal.creativePipeline.begin, {
      ...f.input, stylePresetId: undefined, styleIntentJson: "{}", kind: "palette-plan", requestKey: "invalid",
    })).rejects.toThrow();
    await expect(f.client.mutation(internal.creativePipeline.begin, {
      ...f.input, styleIntentJson: JSON.stringify(customIntent), kind: "palette-plan", requestKey: "ambiguous",
    })).rejects.toThrow(/either/);
    expect(await f.t.run(ctx => ctx.db.query("promptCompositions").collect())).toHaveLength(0);
  });

  it("preserves the same style language across different model identities", async () => {
    const f = await fixture();
    const secondModel = await f.t.run(async ctx => {
      const { _id, _creationTime, ...fields } = f.catalog.model;
      return ctx.db.insert("baseModels", { ...fields, name: "Second kit", slug: "second-kit", panelDensity: "high" });
    });
    for (const modelId of [f.input.kitVariantId, secondModel]) {
      const id = await f.client.mutation(internal.creativePipeline.begin, {
        ...f.input, kitVariantId: modelId, stylePresetId: undefined, styleIntentJson: JSON.stringify(customIntent),
        kind: "palette-plan", requestKey: String(modelId),
      });
      const composition = await f.t.run(ctx => ctx.db.get(id));
      const snapshot = JSON.parse(composition!.inputSnapshotJson);
      expect(snapshot.styleIntent).toEqual(customIntent);
      expect(snapshot.baseModel.id).toBe(modelId);
      expect(composition!.composedPrompt).toContain("cyan teal");
      expect(composition!.composedPrompt).toContain("Model DNA v1");
    }
  });

  it("requires authentication and reserves credits once for a repeated request", async () => {
    const f = await fixture();
    const args = { ...f.input, kind: "palette-plan" as const, requestKey: "same-request" };
    await expect(f.t.mutation(internal.creativePipeline.begin, args)).rejects.toThrow(/authenticated/);
    const first = await f.client.mutation(internal.creativePipeline.begin, args);
    const second = await f.client.mutation(internal.creativePipeline.begin, args);
    expect(first).toBe(second);
    const transactions = await f.t.run(ctx => ctx.db.query("creditTransactions").collect());
    expect(transactions.filter(tx => tx.referenceId === first && tx.delta < 0)).toHaveLength(1);
    await expect(f.client.mutation(internal.creativePipeline.begin, { ...args, notes: "changed" })).rejects.toThrow(/different creative inputs/);
  });

  it("rejects unavailable paint effects rather than inventing a match", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "effect" });
    await f.t.run(async ctx => {
      for (const paint of await ctx.db.query("paintMappings").collect()) {
        await ctx.db.patch(paint._id, { isActive: false });
      }
    });
    const output = {
      entries: f.catalog.roles.map(role => ({ roleSlug: role.slug, targetHex: "#00FFFF", paintEffect: "metallic", rationale: "Reflective armor" })),
      sprayNotes: ["Thin coats"],
    };
    await expect(f.t.mutation(internal.creativePipeline.complete, {
      promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: "{}",
    })).rejects.toThrow(/No catalog paint/);
  });

  it("rejects a stale official revision and isolates palette recovery across revisions", async () => {
    const f = await fixture();
    const official = { ...customIntent, source: "official", styleType: "preset" };
    await f.t.run(ctx => ctx.db.patch(f.catalog.style._id, { styleIntentJson: JSON.stringify(official) }));
    await expect(f.client.mutation(internal.creativePipeline.begin, {
      ...f.input, kind: "palette-plan", requestKey: "stale-style",
    })).rejects.toThrow(/Refresh/);
    const id = await f.client.mutation(internal.creativePipeline.begin, {
      ...f.input, styleRevision: JSON.stringify(official), kind: "palette-plan", requestKey: "official-v1",
    });
    const stored = await f.t.run(ctx => ctx.db.get(id));
    expect(JSON.parse(stored!.inputSnapshotJson).styleIntent).toEqual(official);
    await f.t.run(ctx => ctx.db.patch(f.catalog.style._id, { styleIntentJson: JSON.stringify({ ...official, name: "New revision" }) }));
    await expect(f.client.mutation(internal.creativePipeline.begin, {
      ...f.input, styleRevision: JSON.stringify(official), kind: "palette-plan", requestKey: "official-v2",
    })).rejects.toThrow(/Refresh/);
  });

  it("refunds failures once and rejects late completion", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "fail" });
    await f.t.mutation(internal.creativePipeline.fail, { promptCompositionId: id, reason: "Malformed model output" });
    await f.t.mutation(internal.creativePipeline.failStale, { promptCompositionId: id });
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: "{}", executionJson: "{}" });
    const snapshot = await f.t.run(async ctx => ({ composition: await ctx.db.get(id), credits: await ctx.db.query("creditAccounts").first(), tx: await ctx.db.query("creditTransactions").collect() }));
    expect(snapshot.composition?.status).toBe("failed");
    expect(snapshot.credits?.balance).toBe(30);
    expect(snapshot.tx.filter(tx => tx.actionType === "generation-refund")).toHaveLength(1);
  });

  it("rejects invented style IDs and incomplete palette roles", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { kitVariantId: f.input.kitVariantId, kind: "style-suggestion", requestKey: "style" });
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: '{"suggestions":[{"stylePresetId":"invented","rationale":"Best"}]}', executionJson: "{}" })).rejects.toThrow(/outside the candidate/);
    const paletteId = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "incomplete" });
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: paletteId, responseJson: JSON.stringify({ entries: [{ roleSlug: "primary-armor", targetHex: "#FFFFFF", paintEffect: "solid", rationale: "neutral" }], sprayNotes: ["Thin coats"] }), executionJson: "{}" })).rejects.toThrow(/each approved color role/);
  });

  it("blocks foreign or stale palettes before creating a concept", async () => {
    const f = await fixture();
    const id = await completePalette(f);
    const other = await seedUser(f.t, { tokenIdentifier: "other", email: "other@example.test", balance: 30 });
    await expect(other.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id })).rejects.toThrow(/approve a palette/);
    await expect(f.client.mutation(api.prototypes.initializePrototype, { ...f.input, notes: "new instructions", paletteCompositionId: id })).rejects.toThrow(/inputs have changed/);
    expect(await f.t.run(ctx => ctx.db.query("concepts").collect())).toHaveLength(0);
  });

  it.each(["preset", "custom"])("locks %s catalog paints through specification and HD rendering", async (mode) => {
    const f = await fixture();
    const input = f.input as typeof f.input & { styleIntentJson?: string };
    if (mode === "custom") {
      Object.assign(input, { stylePresetId: undefined, styleIntentJson: JSON.stringify(customIntent) });
    }
    const id = await completePalette(f);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id, requestKey: "spec-1" });
    const repeated = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id, requestKey: "spec-1" });
    expect(repeated.conceptId).toBe(repaint.conceptId);
    const spec = {
      summary: "Neutral display model", panels: f.catalog.roles.map(role => ({ roleSlug: role.slug, areas: [role.recommendedArea ?? role.name], maskingNotes: "Follow existing panel edges." })),
      material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte clear" },
      weathering: { level: "heavy", applicationNotes: "No weathering" }, decals: { density: "low", placementNotes: "Shoulder markings" },
    };
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(spec), executionJson: "{}" })).rejects.toThrow(/changed the approved weathering/);
    spec.weathering.level = "clean";
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(spec), executionJson: "{}" });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const prompt = await f.t.run(ctx => ctx.db.get(render.promptCompositionId));
    for (const role of f.catalog.roles) expect(prompt?.composedPrompt).toContain(role.slug);
    expect(prompt?.composedPrompt).toContain("Approved repaint specification");
    const snapshot = await f.t.run(ctx => ctx.db.get(repaint.conceptId));
    expect(JSON.parse(snapshot!.palettePlanJson!)).toEqual(result.plan);
    if (mode === "custom") {
      expect(JSON.parse(snapshot!.styleIntentJson!)).toEqual(customIntent);
      expect(prompt?.composedPrompt).toContain("Cyan Performance");
      expect(prompt?.composedPrompt).toContain("cyan teal");
      expect(snapshot!.stylePresetId).toBeUndefined();
    }
    // Catalog drift after approval must not change the selected paint snapshot.
    const locked = buildPaintPlan({ conceptTitle: "Same", weatheringLevel: "clean", colorRoles: [], paintMappings: [], approvedPlanJson: snapshot!.palettePlanJson });
    expect(locked.entries).toEqual(result.plan?.entries);
    const reservations = await f.t.run(ctx => ctx.db.query("storageReservations").collect());
    expect(reservations.some(reservation => reservation.generationJobId === repaint.generationJobId)).toBe(false);
    expect(reservations.some(reservation => reservation.generationJobId === render.generationJobId)).toBe(true);
  });
});
