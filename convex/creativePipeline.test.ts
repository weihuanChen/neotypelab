import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { seedUser } from "@/tests/convexTestHelpers";
import { buildPaintPlan } from "./paintMappingEngine";
import { legacyCreativeInputKey } from "./creativeContracts";
import type { CreativeSnapshot } from "./creativePipeline";
import { executeTextRequest } from "./textGenerationNode";
import { finalImagePrompt } from "./imagePromptBudget";
import { sourceNormalizationProtocolVersion } from "./creativeContracts";
import { localChitinMaterialStyle, orangeShadesDescription } from "@/tests/fixtures/orangeShades";

vi.mock("./textGenerationNode", () => ({ executeTextRequest: vi.fn() }));

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
  const input = { kitVariantId: catalog.model._id, stylePresetId: catalog.style._id, styleRevision: catalog.style.styleIntentJson, materialPresetId: catalog.material._id, weatheringLevel: "clean" as const, moodTags: [] };
  return { t, ...user, catalog, input };
}
async function completePalette(f: Awaited<ReturnType<typeof fixture>>) {
  const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "palette-1" });
  const composition = (await f.t.run(ctx => ctx.db.get(id)))!;
  const snapshot = JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot;
  if (!snapshot.resolvedIntent) {
    await f.t.mutation(internal.creativePipeline.claim, { promptCompositionId: id });
    const normalized = snapshot.styleIntent!.explicitRequirements ?? { version: "normalized-user-intent.v1", requirements: [], unresolved: [] };
    const resolved = await f.t.mutation(internal.creativePipeline.resolveIntent, { promptCompositionId: id, normalizedNotesJson: JSON.stringify(normalized), executionJson: "{}" });
    if (resolved && "error" in resolved) throw new Error(resolved.error);
  }
  const output = await paletteResponse(f.t, id);
  await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: '{"model":"fixture"}' });
  return id;
}

const familyHex: Record<string, string> = { red: "#E53935", orange: "#FF8800", yellow: "#FFD600", green: "#00AA00", cyan: "#00FFFF", blue: "#0055DD", purple: "#8800CC", pink: "#EE55AA", brown: "#884422", white: "#FFFFFF", black: "#111111", gray: "#888888", beige: "#DDCCAA" };
async function paletteResponse(t: Backend, id: string, effect = "solid") {
  const composition = await t.run(ctx => {
    const parsed = ctx.db.normalizeId("promptCompositions", id);
    if (!parsed) throw new Error("Invalid fixture composition ID");
    return ctx.db.get(parsed);
  });
  const snapshot = JSON.parse(composition!.inputSnapshotJson) as CreativeSnapshot;
  return {
    version: "visual-palette.v3",
    entries: snapshot.resolvedIntent!.colors.map(color => ({
      colorId: color.colorId, colorName: color.name,
      roleSlug: color.scope.kind === "inner-frame" || (color.scope.kind === "whole-kit" && color.visualRole === "neutral") ? "inner-frame" : color.scope.kind === "sensors" ? "sensor-color" : color.scope.kind === "markings" ? "markings" : color.visualRole === "secondary" ? "secondary-armor" : "primary-armor",
      targetHex: color.hex ?? familyHex[color.family ?? "gray"], paintEffect: effect,
      rationale: "Preserve the resolved color and allocate it to the intended surface.",
      ...(color.coverage?.strength === "hard" ? { coverage: { scope: color.coverage.scope, part: color.coverage.part, percent: color.coverage.percent, source: "resolved-constraint" } } : {}),
    })), sprayNotes: ["Apply thin coats."],
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.mocked(executeTextRequest).mockReset(); });
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

  it("marks unavailable paint effects as a custom mix instead of inventing a match", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "effect" });
    await f.t.run(async ctx => {
      for (const paint of await ctx.db.query("paintMappings").collect()) {
        await ctx.db.patch(paint._id, { isActive: false });
      }
    });
    const output = await paletteResponse(f.t, id, "metallic");
    await f.t.mutation(internal.creativePipeline.complete, {
      promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: "{}",
    });
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    const recommended = result.paintRecommendations?.sets.find((set) => set.recommended);
    expect(recommended?.coverageCount).toBe(0);
    expect(recommended?.missingRoleSlugs).toHaveLength(output.entries.length);
    expect(result.plan?.entries.every((entry) => entry.suggestedPaint === null)).toBe(true);
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
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: paletteId, responseJson: JSON.stringify({ entries: [{ roleSlug: "primary-armor", targetHex: "#FFFFFF", paintEffect: "solid", rationale: "neutral" }], sprayNotes: ["Thin coats"] }), executionJson: "{}" })).rejects.toThrow(/v3|color|palette/i);
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
      version: "repaint-specification.v3",
      summary: "Neutral display model using Mr. Color C39", panels: result.visualPalette!.entries.map((entry, index) => ({ assignmentId: `panel-${index}`, colorId: entry.colorId, roleSlug: entry.roleSlug, areas: [entry.roleSlug === "inner-frame" ? "Inner frame" : entry.roleSlug === "sensor-color" ? "Head sensors" : "Chest armor"], maskingNotes: "Follow existing panel edges." })),
      material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte clear", finish: result.resolvedIntent!.effectiveStyle.finish, intent: result.resolvedIntent!.effectiveStyle.materialIntent },
      weathering: { level: "heavy", applicationNotes: "No weathering" }, decals: { density: "low", placementNotes: "Shoulder markings" },
    };
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(spec), executionJson: "{}" })).rejects.toThrow(/changed the (approved|resolved) weathering/);
    spec.weathering.level = "clean";
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(spec), executionJson: "{}" });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const prompt = await f.t.run(ctx => ctx.db.get(render.promptCompositionId));
    for (const color of result.visualPalette!.entries) expect(prompt?.composedPrompt).toContain(color.roleSlug);
    expect(prompt?.composedPrompt).toContain("Approved repaint specification");
    expect(prompt?.composedPrompt).toContain("visual-palette.v3");
    expect(prompt?.composedPrompt).not.toContain("Mr. Color");
    expect(prompt?.composedPrompt).not.toContain("C39");
    for (const set of result.paintRecommendations?.sets ?? []) {
      for (const entry of set.entries) {
        expect(prompt?.composedPrompt).not.toContain(entry.paint.code);
        expect(prompt?.composedPrompt).not.toContain(entry.paint.brand);
      }
    }
    const snapshot = await f.t.run(ctx => ctx.db.get(repaint.conceptId));
    expect(JSON.parse(snapshot!.palettePlanJson!)).toEqual(result.plan);
    expect(JSON.parse(snapshot!.visualPaletteJson!)).toEqual(result.visualPalette);
    expect(JSON.parse(snapshot!.paintRecommendationSetsJson!)).toEqual(result.paintRecommendations);
    if (mode === "custom") {
      expect(JSON.parse(snapshot!.styleIntentJson!)).toEqual(customIntent);
      expect(prompt?.composedPrompt).toContain("racing");
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

describe("resolved Style creation", () => {
  function effectiveIntentFromPrompt(prompt: string) {
    const prefix = "Effective creative intent JSON: ";
    const line = prompt.split("\n").find(value => value.startsWith(prefix));
    expect(line).toBeDefined();
    const payload = line!.slice(prefix.length);
    expect(payload).not.toContain('"originalStyle"');
    expect(payload).not.toContain('"evidence"');
    expect(payload).not.toContain('"quote"');
    return JSON.parse(payload) as { colors: Array<{ colorId: string; coverage?: { scope: string; percent: number } }>; constraints: Array<{ property: string; scope: { kind: string }; value: string | number }> };
  }
  function blueWhiteNotes(notes: string, ratio = false) {
    return {
      version: "normalized-user-intent.v1", requirements: [{
        id: "armor-colors", property: "colors", operation: "only", scope: { kind: "exterior-armor" },
        colors: [{ name: "Blue armor", family: "blue", visualRole: "unspecified", ...(ratio ? { coveragePercent: 70 } : {}) },
          { name: "White armor", family: "white", visualRole: "unspecified", ...(ratio ? { coveragePercent: 30 } : {}) }],
        evidence: { inputRef: "notes", quote: notes },
      }], unresolved: [],
    };
  }
  async function resolveNotes(f: Awaited<ReturnType<typeof fixture>>, notes: string, normalization: unknown = blueWhiteNotes(notes)) {
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes, kind: "palette-plan", requestKey: "resolved-palette" });
    await f.t.mutation(internal.creativePipeline.claim, { promptCompositionId: id });
    await f.t.mutation(internal.creativePipeline.resolveIntent, { promptCompositionId: id, normalizedNotesJson: JSON.stringify(normalization), executionJson: '{"model":"fixture"}' });
    return id;
  }
  async function completeResolvedPalette(f: Awaited<ReturnType<typeof fixture>>, id: Awaited<ReturnType<typeof resolveNotes>>) {
    const output = await paletteResponse(f.t, id);
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: "{}" });
    return f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
  }
  function specification(result: Awaited<ReturnType<typeof completeResolvedPalette>>) {
    return {
      version: "repaint-specification.v3", summary: "Apply the resolved paint scheme to existing kit panels.",
      panels: result.visualPalette!.entries.map((entry, index) => ({ assignmentId: `assignment-${index}`, colorId: entry.colorId!, roleSlug: entry.roleSlug,
        areas: [entry.roleSlug === "inner-frame" ? "Inner frame" : entry.roleSlug === "sensor-color" ? "Head sensors" : "Shoulder armor and chest armor"], maskingNotes: "Mask along existing panel edges." })),
      material: { surfaceTexture: "Smooth painted armor", reflectivity: "Low", coating: "Satin clear coat", finish: result.resolvedIntent!.effectiveStyle.finish, intent: result.resolvedIntent!.effectiveStyle.materialIntent },
      weathering: { level: result.resolvedIntent!.effectiveStyle.weathering, applicationNotes: "Follow the approved wear level." },
      decals: { density: "low", placementNotes: "Native markings only" },
    };
  }

  it("carries a saved local chitin material through Palette, Specification, private Library and the frozen render contract", async () => {
    const f = await fixture();
    const sourceId = await f.t.run(ctx => ctx.db.insert("promptCompositions", { userId: f.userId, status: "consumed", composedPrompt: "Completed interpretation",
      inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description: orangeShadesDescription }),
      outputSummaryJson: JSON.stringify({ intent: localChitinMaterialStyle, sourceNormalizationProtocolVersion }) }));
    const saved = await f.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: sourceId });
    Object.assign(f.input, { stylePresetId: undefined, styleRevision: undefined, userStyleId: saved.styleId, styleIntentJson: JSON.stringify(saved.intent) });
    const id = await completePalette(f);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    expect(result.resolvedIntent!.conflicts).toEqual([]);
    expect(result.resolvedIntent!.unresolved).toEqual([]);
    expect(result.resolvedIntent!.effectiveStyle.materialIntent.join(" ")).not.toContain("chitin");
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id });
    const specRecord = (await f.t.run(ctx => ctx.db.get(repaint.promptCompositionId)))!;
    expect(JSON.parse(specRecord.inputSnapshotJson).systemPrompt).toContain("never promote a local material to the entire kit");
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    const concept = (await f.t.run(ctx => ctx.db.get(repaint.conceptId)))!;
    const frozen = JSON.parse(concept.renderSpecificationJson!);
    expect(frozen.material.scopedIntents).toEqual([{ constraintId: "description:req-material", scope: { kind: "exterior-armor" }, intent: "chitinous shell finish", areas: ["Shoulder armor and chest armor"] }]);
    expect(JSON.parse(concept.styleIntentJson!)).toEqual(localChitinMaterialStyle);
    const detail = (await f.client.query(api.libraryDetails.get, { conceptId: repaint.conceptId }))!;
    expect(detail.specification!.material).toMatchObject({ scopedIntents: frozen.material.scopedIntents });
    const other = await seedUser(f.t, { tokenIdentifier: "local-material-other", email: "local-material-other@example.test", balance: 30 });
    expect(await other.client.query(api.libraryDetails.get, { conceptId: repaint.conceptId })).toBeNull();
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const renderRecord = (await f.t.run(ctx => ctx.db.get(render.promptCompositionId)))!;
    const contract = JSON.parse(renderRecord.composedPrompt.split("Frozen render contract JSON:\n")[1]);
    expect(contract.material.scopedIntents).toEqual(frozen.material.scopedIntents);
    expect(contract.hardConstraints).toContainEqual({ property: "material", scope: { kind: "exterior-armor" }, value: "chitinous shell finish" });
    expect(renderRecord.composedPrompt).toContain("whole-kit material remains the default elsewhere");
    expect(contract.material.finish).toBe(result.resolvedIntent!.effectiveStyle.finish);
    expect(contract.palette).toHaveLength(6);
  });

  it("normalizes Notes once on the current text route before Palette and keeps the same tariff", async () => {
    const f = await fixture();
    const notes = "Use only blue and white armor. Keep original kit geometry.";
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes, kind: "palette-plan", requestKey: "normalization-call" });
    const response = (json: Record<string, unknown>) => ({ json, text: JSON.stringify(json), model: "fixture", profileId: "fixture", providerRequestId: null, usage: null });
    const normalized = { ...blueWhiteNotes(notes), requirements: [...blueWhiteNotes(notes).requirements,
      { id: "preserve-geometry", property: "geometry", operation: "preserve", scope: { kind: "whole-kit" }, evidence: { inputRef: "notes", quote: "Keep original kit geometry." } }] };
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(normalized))
      .mockImplementationOnce(async () => response(await paletteResponse(f.t, id)));
    await f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id });
    expect(executeTextRequest).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(executeTextRequest).mock.calls.map(([, args]) => args);
    expect(calls.every(args => args.templateKind === "palette-plan" && args.safetyReference?.id === id)).toBe(true);
    expect(calls[0].userPrompt).toContain(notes);
    expect(calls[1].userPrompt).not.toContain(notes);
    expect(calls[1].userPrompt).not.toContain("originalStyle");
    const debits = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_reference", q => q.eq("referenceTable", "promptCompositions").eq("referenceId", id)).collect());
    expect(debits.filter(tx => tx.delta < 0)).toHaveLength(1);
  });

  it("replaces preset armor colors without inventing ratios or replaying raw Notes downstream", async () => {
    const f = await fixture();
    const notes = "Use only blue and white armor";
    const id = await resolveNotes(f, notes);
    const result = await completeResolvedPalette(f, id);
    const armor = result.resolvedIntent!.colors.filter(color => color.scope.kind === "exterior-armor");
    expect(armor.map(color => color.family).sort()).toEqual(["blue", "white"]);
    expect(armor.every(color => !color.coverage)).toBe(true);
    expect(result.resolvedIntent!.styleModified).toBe(true);
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, notes, paletteCompositionId: id });
    const specPrompt = await f.t.run(ctx => ctx.db.get(repaint.promptCompositionId));
    expect(specPrompt!.composedPrompt).not.toContain(notes);
    expect(specPrompt!.composedPrompt).not.toContain("originalStyle");
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const prompt = await f.t.run(ctx => ctx.db.get(render.promptCompositionId));
    expect(prompt!.composedPrompt).not.toContain(notes);
    expect(prompt!.composedPrompt).not.toContain("originalStyle");
    for (const color of result.visualPalette!.entries) expect(prompt!.composedPrompt).toContain(color.colorId);
  });

  it("retains seven armor colors, repeat roles and assignment IDs through the complete pipeline", async () => {
    const f = await fixture();
    const colors = ["red", "blue", "green", "orange", "purple", "yellow", "white"].map(name => ({ role: "primary", name, hex: familyHex[name], coverage: 14 }));
    const rainbow = { ...customIntent, version: "style-intent.v2", name: "Spectrum Armor", colors, pattern: "none" };
    Object.assign(f.input, { stylePresetId: undefined, styleRevision: undefined, styleIntentJson: JSON.stringify(rainbow) });
    const id = await completePalette(f);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    const palettePrompt = (await f.t.run(ctx => ctx.db.get(id)))!.composedPrompt;
    const paletteIntent = effectiveIntentFromPrompt(palettePrompt);
    expect(paletteIntent.colors.map(color => color.colorId)).toEqual(result.visualPalette!.entries.map(entry => entry.colorId));
    expect(result.visualPalette!.entries).toHaveLength(7);
    expect(new Set(result.visualPalette!.entries.map(entry => entry.roleSlug))).toEqual(new Set(["primary-armor"]));
    expect(new Set(result.visualPalette!.entries.map(entry => entry.colorId)).size).toBe(7);
    expect(result.plan!.entries).toHaveLength(7);
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id });
    const specPrompt = (await f.t.run(ctx => ctx.db.get(repaint.promptCompositionId)))!.composedPrompt;
    expect(effectiveIntentFromPrompt(specPrompt).colors.map(color => color.colorId)).toEqual(result.visualPalette!.entries.map(entry => entry.colorId));
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const prompt = await f.t.run(ctx => ctx.db.get(render.promptCompositionId));
    for (let index = 0; index < 7; index++) {
      expect(prompt!.composedPrompt).toContain(result.visualPalette!.entries[index].colorId);
      expect(prompt!.composedPrompt).toContain(`assignment-${index}`);
    }
  });

  it.each([7, 32])("queues %i colors once with all assignments and hard targets, preserving administrator view instructions", async count => {
    const f = await fixture();
    const colors = Array.from({ length: count }, (_, index) => ({ role: "primary", name: `Armor color ${index + 1}`, hex: `#${(0x224400 + index * 37).toString(16).padStart(6, "0").toUpperCase()}`, coverage: Math.floor(100 / count) }));
    const description = `Only these armor colors: ${colors.map(color => color.hex).join(", ")}`;
    const custom = { ...customIntent, version: "style-intent.v3", name: "Multi-color Armor", colors, pattern: "none", explicitRequirements: {
      version: "normalized-user-intent.v1", requirements: [{ id: "exact-armor-colors", property: "colors", operation: "only", scope: { kind: "exterior-armor" },
        colors: colors.map(color => ({ name: color.name, hex: color.hex, visualRole: "unspecified" })), evidence: { inputRef: "style-description", quote: description } }], unresolved: [],
    } };
    Object.assign(f.input, { stylePresetId: undefined, styleRevision: undefined, styleIntentJson: JSON.stringify(custom), styleDescription: description });
    const id = await completePalette(f);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id });
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    const adminView = "ADMIN CAMERA: low-angle camera, 3x2 panoramic contact sheet, six equal views and unchanged native emblems.";
    await f.t.run(async ctx => {
      const template = (await ctx.db.query("promptTemplates").withIndex("by_kind", q => q.eq("kind", "hd-render")).collect()).find(item => item.isActive)!;
      const userPromptTemplate = `${adminView}\nMode: {{renderMode}}\n${Array.from({ length: 6 }, () => "Palette JSON: {{approvedPalette}}\nIntent JSON: {{resolvedIntent}}\nAssignments JSON: {{renderSpecification}}\nRoles: {{colorRoles}}\n").join("")}`;
      await ctx.db.patch(template._id, { userPromptTemplate });
      if (template.publishedVersionId) await ctx.db.patch(template.publishedVersionId, { userPromptTemplate });
    });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const composition = (await f.t.run(ctx => ctx.db.get(render.promptCompositionId)))!;
    const prompt = composition.composedPrompt;
    expect(prompt).toContain(adminView);
    expect(prompt).toContain("including surfaces without an explicit assignment");
    expect(prompt).toContain("never inherit the kit's original paint colors or invent another body paint color");
    expect(prompt).toContain("Natural lighting highlights and shadows");
    expect(prompt.match(/"targetHex":/g)).toHaveLength(count);
    expect(prompt.match(/"assignmentId":/g)).toHaveLength(count);
    expect(prompt.match(/Frozen render contract JSON:/g)).toHaveLength(1);
    const contract = JSON.parse(prompt.split("Frozen render contract JSON:\n")[1]);
    expect(contract.palette.map((entry: { colorId: string }) => entry.colorId)).toEqual(result.visualPalette!.entries.map(entry => entry.colorId));
    expect(contract.assignments.map((entry: { assignmentId: string }) => entry.assignmentId)).toEqual(specification(result).panels.map(panel => panel.assignmentId));
    expect(contract.hardConstraints.filter((constraint: { property: string }) => constraint.property === "color-hex").map((constraint: { value: string }) => constraint.value)).toEqual(colors.map(color => color.hex));
    expect(prompt).not.toContain("originalStyle");
    expect(prompt).not.toContain("supersededConstraintIds");
    expect(prompt).not.toContain("suggestedPaint");
    expect(prompt).not.toContain('"rationale"');
    expect(finalImagePrompt(prompt, composition.negativePrompt, true).length).toBeLessThanOrEqual(32000);
  });

  it("rejects an oversized administrator render template before reserving render credits", async () => {
    const f = await fixture();
    const id = await completePalette(f);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id });
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    await f.t.run(async ctx => {
      const template = (await ctx.db.query("promptTemplates").withIndex("by_kind", q => q.eq("kind", "hd-render")).collect()).find(item => item.isActive)!;
      const userPromptTemplate = "Detailed administrator layout instruction. ".repeat(1000);
      await ctx.db.patch(template._id, { userPromptTemplate });
      if (template.publishedVersionId) await ctx.db.patch(template.publishedVersionId, { userPromptTemplate });
    });
    const before = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    await expect(f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId })).rejects.toThrow(/32000.*new preview/);
    const after = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    expect(after!.balance).toBe(before!.balance);
    const jobs = await f.t.run(ctx => ctx.db.query("generationJobs").withIndex("by_user_status", q => q.eq("userId", f.userId).eq("status", "queued")).collect());
    expect(jobs.some(job => job.kind === "hd-preview")).toBe(false);
  });

  it("preserves explicit 70:30 armor ratios and refuses changed ratios, IDs or sensor-only armor", async () => {
    const f = await fixture();
    const notes = "70% blue armor, 30% white armor";
    const id = await resolveNotes(f, notes, blueWhiteNotes(notes, true));
    const output = await paletteResponse(f.t, id);
    const palettePrompt = (await f.t.run(ctx => ctx.db.get(id)))!.composedPrompt;
    const effective = effectiveIntentFromPrompt(palettePrompt);
    expect(effective.colors.filter(color => color.coverage).map(color => color.coverage!.percent).sort()).toEqual([30, 70]);
    expect(effective.colors.filter(color => color.coverage).every(color => color.coverage!.scope === "exterior-armor")).toBe(true);
    expect(effective.constraints.filter(constraint => constraint.property === "color-coverage").map(constraint => ({ percent: constraint.value, scope: constraint.scope.kind })).sort((a, b) => Number(a.percent) - Number(b.percent))).toEqual([{ percent: 30, scope: "exterior-armor" }, { percent: 70, scope: "exterior-armor" }]);
    const altered = structuredClone(output);
    const blue = altered.entries.find(entry => entry.coverage?.percent === 70)!;
    blue.coverage!.percent = 50;
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: JSON.stringify(altered), executionJson: "{}" })).rejects.toThrow(/coverage/);
    const result = await completeResolvedPalette(f, id);
    expect(result.visualPalette!.entries.filter(entry => entry.coverage).map(entry => entry.coverage!.percent).sort()).toEqual([30, 70]);
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, notes, paletteCompositionId: id });
    const specPrompt = (await f.t.run(ctx => ctx.db.get(repaint.promptCompositionId)))!.composedPrompt;
    expect(effectiveIntentFromPrompt(specPrompt).colors.filter(color => color.coverage).map(color => color.coverage!.percent).sort()).toEqual([30, 70]);
    const valid = specification(result);
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify({ ...valid, panels: valid.panels.slice(1) }), executionJson: "{}" })).rejects.toThrow(/omitted/);
    const wrong = structuredClone(valid); wrong.panels[0].colorId = "unknown-color";
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(wrong), executionJson: "{}" })).rejects.toThrow(/unknown color/);
    const sensorOnly = structuredClone(valid); sensorOnly.panels[0].roleSlug = "sensor-color";
    await expect(f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(sensorOnly), executionJson: "{}" })).rejects.toThrow(/scope/);
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(valid), executionJson: "{}" });
    const concept = await f.t.run(ctx => ctx.db.get(repaint.conceptId));
    const stored = JSON.parse(concept!.renderSpecificationJson!);
    expect(stored.colorPlan.entries.filter((entry: { coverage?: unknown }) => entry.coverage).map((entry: { coverage: { percent: number } }) => entry.coverage.percent).sort()).toEqual([30, 70]);
  });

  it("freezes effective finish and weathering after Notes override automatic selections", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.catalog.material._id, { finishType: "matte", paintFinish: "matte" }));
    const notes = "Gloss finish with heavy weathering";
    const normalization = { version: "normalized-user-intent.v1", requirements: [
      { id: "finish", property: "finish", operation: "set", scope: { kind: "whole-kit" }, value: "gloss", evidence: { inputRef: "notes", quote: "Gloss finish" } },
      { id: "weathering", property: "weathering", operation: "set", scope: { kind: "whole-kit" }, value: "heavy", evidence: { inputRef: "notes", quote: "heavy weathering" } },
    ], unresolved: [] };
    const id = await resolveNotes(f, notes, normalization);
    const result = await completeResolvedPalette(f, id);
    await f.t.run(ctx => ctx.db.patch(f.catalog.material._id, { finishType: "satin", paintFinish: "satin", name: "Changed catalog material" }));
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, notes, paletteCompositionId: id });
    expect(result.resolvedIntent!.effectiveStyle.finish).toBe("gloss");
    expect(result.resolvedIntent!.effectiveStyle.weathering).toBe("heavy");
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(specification(result)), executionJson: "{}" });
    const render = await f.client.mutation(api.prototypeTools.requestHdRender, { conceptId: repaint.conceptId });
    const prompt = await f.t.run(ctx => ctx.db.get(render.promptCompositionId));
    expect(prompt!.composedPrompt).toContain('"finish":"gloss"');
    expect(prompt!.composedPrompt).not.toContain('"finish":"matte"');
    expect(prompt!.composedPrompt).not.toContain("Changed catalog material");
    expect(prompt!.composedPrompt).not.toContain("Satin clear coat");
    const concept = await f.t.run(ctx => ctx.db.get(repaint.conceptId));
    expect(concept!.weatheringLevel).toBe("heavy");
  });

  it("normalizes real catalog flat finish before applying an explicit material selection", async () => {
    const f = await fixture();
    const glossy = { ...customIntent, finish: "gloss" };
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, stylePresetId: undefined, styleIntentJson: JSON.stringify(glossy),
      selectionSources: { material: "user-selection", weathering: "system-default" }, kind: "palette-plan", requestKey: "flat-material" });
    const snapshot = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
    expect(snapshot.materialSnapshot!.paintFinish).toBe("flat");
    expect(snapshot.resolvedIntent!.effectiveStyle.finish).toBe("matte");
    expect(snapshot.resolvedIntent!.constraints).toContainEqual(expect.objectContaining({ property: "finish", value: "matte", strength: "hard", status: "active" }));
  });

  it("normalizes legacy saved source descriptions before Notes without rewriting the saved style", async () => {
    const f = await fixture();
    const description = "70% blue armor, 30% white armor";
    const legacyStyle = { ...customIntent, version: "style-intent.v2", pattern: "none", colors: [{ role: "primary", name: "Blue armor", hex: "#0055DD", coverage: 70 }, { role: "secondary", name: "White armor", hex: "#FFFFFF", coverage: 30 }] };
    const styleId = await f.t.run(async ctx => {
      const sourceId = await ctx.db.insert("promptCompositions", { userId: f.userId, status: "consumed", composedPrompt: description,
        inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description }), outputSummaryJson: JSON.stringify({ intent: legacyStyle }) });
      return ctx.db.insert("userStyles", { userId: f.userId, name: legacyStyle.name, intentJson: JSON.stringify(legacyStyle), promptCompositionId: sourceId,
        visibility: "private", status: "active", saveCount: 0, createdAt: 1, updatedAt: 1 });
    });
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, stylePresetId: undefined, userStyleId: styleId, styleIntentJson: JSON.stringify(legacyStyle), kind: "palette-plan", requestKey: "legacy-description" });
    const claimed = await f.t.mutation(internal.creativePipeline.claim, { promptCompositionId: id });
    expect(claimed!.normalization!.styleDescription).toBe(description);
    const normalization = blueWhiteNotes(description, true);
    normalization.requirements[0].evidence.inputRef = "style-description";
    await f.t.mutation(internal.creativePipeline.resolveIntent, { promptCompositionId: id, normalizedNotesJson: JSON.stringify(normalization), executionJson: "{}" });
    const snapshot = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
    expect(snapshot.resolvedIntent!.styleModified).toBe(false);
    expect(snapshot.resolvedIntent!.colors.map(color => color.coverage!.strength)).toEqual(["hard", "hard"]);
    expect(snapshot.resolvedIntent!.originalStyle).toEqual(legacyStyle);
    expect((await f.t.run(ctx => ctx.db.get(styleId)))!.intentJson).toBe(JSON.stringify(legacyStyle));
  });

  it("re-normalizes an old saved v3 source with omitted major importance without changing saved data", async () => {
    const f = await fixture();
    const names = ["red", "blue", "green", "orange", "purple", "yellow", "pink"];
    const description = `Use ${names.join(", ")} as seven large armor colors.`;
    const legacy = { ...customIntent, version: "style-intent.v3", name: "Seven-color Armor", pattern: "none",
      colors: names.map((name, index) => ({ role: index < 3 ? "primary" : index < 5 ? "secondary" : "accent", name, hex: familyHex[name], coverage: index < 5 ? 18 : 5 })),
      explicitRequirements: { version: "normalized-user-intent.v1", requirements: [{ id: "seven-colors", property: "colors", operation: "replace", scope: { kind: "exterior-armor" }, colors: names.map(name => ({ name, family: name })), evidence: { inputRef: "style-description", quote: description } }], unresolved: [] },
    };
    const styleId = await f.t.run(async ctx => {
      const sourceId = await ctx.db.insert("promptCompositions", { userId: f.userId, status: "consumed", composedPrompt: "Private source prompt",
        inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description }), outputSummaryJson: JSON.stringify({ intent: legacy }) });
      return ctx.db.insert("userStyles", { userId: f.userId, name: legacy.name, intentJson: JSON.stringify(legacy), promptCompositionId: sourceId,
        visibility: "private", status: "active", saveCount: 0, createdAt: 1, updatedAt: 1 });
    });
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, stylePresetId: undefined, userStyleId: styleId, styleIntentJson: JSON.stringify(legacy), kind: "palette-plan", requestKey: "old-seven-color-source" });
    const initial = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
    expect(initial.styleDescription).toBe(description);
    expect(initial.needsSourceNormalization).toBe(true);
    expect(initial.resolvedIntent).toBeUndefined();
    const normalized = { version: "normalized-user-intent.v1", requirements: [{ id: "seven-colors-current", property: "colors", operation: "replace", scope: { kind: "exterior-armor" },
      colors: names.map(name => ({ name, family: name, visualRole: "primary" })), evidence: { inputRef: "style-description", quote: description } }], unresolved: [] };
    const response = (json: Record<string, unknown>) => ({ json, text: JSON.stringify(json), model: "fixture", profileId: "fixture", providerRequestId: null, usage: null });
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(normalized)).mockImplementationOnce(async () => response(await paletteResponse(f.t, id)));
    await f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id });
    expect(executeTextRequest).toHaveBeenCalledTimes(2);
    expect(vi.mocked(executeTextRequest).mock.calls[0][1].userPrompt).toContain(description);
    const result = await f.client.query(internal.creativePipeline.result, { promptCompositionId: id });
    expect(result.resolvedIntent!.colors.map(color => color.visualRole)).toEqual(Array(7).fill("primary"));
    expect(result.resolvedIntent!.colors.every(color => !color.coverage)).toBe(true);
    expect(result.resolvedIntent!.originalStyle).toEqual(legacy);
    expect(result.resolvedIntent!.constraints.filter(constraint => constraint.status === "active" && constraint.property === "color-importance")).toHaveLength(7);
    const completed = (await f.t.run(ctx => ctx.db.get(id)))!;
    const frozen = JSON.parse(completed.inputSnapshotJson) as CreativeSnapshot;
    const roleLine = completed.composedPrompt.split("\n").find(line => line.startsWith("Roles: "))!;
    const permissions = JSON.parse(roleLine.slice("Roles: ".length)) as Array<{ colorName: string; allowedRoleSlugs: string[] }>;
    expect(permissions).toHaveLength(7);
    expect(permissions.every(permission => JSON.stringify(permission.allowedRoleSlugs) === JSON.stringify(["primary-armor", "secondary-armor"]))).toBe(true);
    const executedStyle = JSON.parse(frozen.promptValues!.stylePreset);
    for (const key of ["name", "palette", "colors", "referenceNotes", "explicitRequirements", "version", "source"]) expect(executedStyle).not.toHaveProperty(key);
    expect(completed.composedPrompt).not.toContain("recommendedArea");
    const saved = (await f.t.run(ctx => ctx.db.get(styleId)))!;
    expect(JSON.parse(saved.intentJson)).toEqual(legacy);
    const concept = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, stylePresetId: undefined, userStyleId: styleId, styleIntentJson: JSON.stringify(legacy), paletteCompositionId: id });
    expect(JSON.parse((await f.t.run(ctx => ctx.db.get(concept.conceptId)))!.styleIntentJson!)).toEqual(legacy);
  });

  it("trusts only a current validated interpreter receipt and skips redundant source normalization", async () => {
    const f = await fixture();
    const current = { ...customIntent, version: "style-intent.v3", pattern: "none", colors: [{ role: "primary", name: "Blue", hex: "#0055DD", coverage: 80 }],
      explicitRequirements: { version: "normalized-user-intent.v1", requirements: [], unresolved: [] } };
    const styleId = await f.t.run(async ctx => {
      const sourceId = await ctx.db.insert("promptCompositions", { userId: f.userId, status: "consumed", composedPrompt: "Private source prompt",
        inputSnapshotJson: JSON.stringify({ kind: "style-interpreter", description: "Cool display model" }),
        outputSummaryJson: JSON.stringify({ intent: current, sourceNormalizationProtocolVersion }) });
      return ctx.db.insert("userStyles", { userId: f.userId, name: current.name, intentJson: JSON.stringify(current), promptCompositionId: sourceId,
        visibility: "private", status: "active", saveCount: 0, createdAt: 1, updatedAt: 1 });
    });
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, stylePresetId: undefined, userStyleId: styleId, styleIntentJson: JSON.stringify(current), kind: "palette-plan", requestKey: "current-source-receipt" });
    const snapshot = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
    expect(snapshot.needsSourceNormalization).toBe(false);
    expect(snapshot.resolvedIntent).toBeDefined();
    expect((await f.t.mutation(internal.creativePipeline.claim, { promptCompositionId: id }))!.normalization).toBeNull();
  });

  it("sends explicit per-color major permissions and rejects a provider that still returns yellow as accent", async () => {
    const f = await fixture();
    const notes = "Use yellow as a large armor color";
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes, kind: "palette-plan", requestKey: "yellow-role-options" });
    const normalized = { version: "normalized-user-intent.v1", requirements: [{ id: "major-yellow", property: "colors", operation: "add", scope: { kind: "exterior-armor" },
      colors: [{ name: "Yellow armor", family: "yellow", visualRole: "primary" }], evidence: { inputRef: "notes", quote: notes } }], unresolved: [] };
    const response = (json: Record<string, unknown>) => ({ json, text: JSON.stringify(json), model: "fixture", profileId: "fixture", providerRequestId: null, usage: null });
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(normalized)).mockImplementation(async (_ctx, args) => {
      const snapshot = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
      const yellow = snapshot.resolvedIntent!.colors.find(color => color.family === "yellow" && color.visualRole === "primary" && color.scope.kind === "exterior-armor")!;
      const line = args.userPrompt.split("\n").find(item => item.startsWith("Roles: "))!;
      const permissions = JSON.parse(line.slice("Roles: ".length)) as Array<{ colorId: string; allowedRoleSlugs: string[] }>;
      expect(permissions.find(permission => permission.colorId === yellow.colorId)!.allowedRoleSlugs).toEqual(["primary-armor", "secondary-armor"]);
      expect(args.userPrompt).not.toContain("recommendedArea");
      const output = await paletteResponse(f.t, id);
      output.entries.find(entry => entry.colorId === yellow.colorId)!.roleSlug = "accent";
      return response(output);
    });
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id })).rejects.toThrow(/visual importance/);
    const composition = (await f.t.run(ctx => ctx.db.get(id)))!;
    const snapshot = JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot;
    const stored = snapshot.lastExecutionAttempt!.response as { entries: Array<{ colorName: string; roleSlug: string }> };
    expect(stored.entries.find(entry => entry.colorName === "Yellow armor")!.roleSlug).toBe("accent");
    expect(composition.status).toBe("failed");
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique()))!.balance).toBe(30);
  });

  it("rejects selection provenance changes and normalization conflicts while refunding once", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.catalog.material._id, { finishType: "matte", paintFinish: "matte" }));
    const input = { ...f.input, selectionSources: { material: "user-selection" as const, weathering: "user-selection" as const }, notes: "Gloss finish" };
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...input, kind: "palette-plan", requestKey: "conflict" });
    vi.mocked(executeTextRequest).mockResolvedValueOnce({ json: { version: "normalized-user-intent.v1", requirements: [{ id: "finish", property: "finish", operation: "set", scope: { kind: "whole-kit" }, value: "gloss", evidence: { inputRef: "notes", quote: "Gloss finish" } }], unresolved: [] }, text: "{}", model: "fixture", profileId: "fixture", providerRequestId: null, usage: null });
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id })).rejects.toThrow(/conflicts/);
    expect(executeTextRequest).toHaveBeenCalledTimes(1);
    await f.t.mutation(internal.creativePipeline.failStale, { promptCompositionId: id });
    const account = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    expect(account!.balance).toBe(30);
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_reference", q => q.eq("referenceTable", "promptCompositions").eq("referenceId", id)).collect());
    expect(tx.filter(entry => entry.delta > 0)).toHaveLength(1);
    await expect(f.client.mutation(internal.creativePipeline.begin, { ...input, selectionSources: { material: "system-default", weathering: "user-selection" }, kind: "palette-plan", requestKey: "conflict" })).rejects.toThrow(/different creative inputs/);
  });

  it("retains private provider diagnostics while exposing bounded schema fields on normalization failure", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes: "Gloss finish", kind: "palette-plan", requestKey: "invalid-normalization" });
    const invalid = { version: "normalized-user-intent.v1", requirements: [{ id: "missing-finish", property: "finish", operation: "set", scope: { kind: "whole-kit" }, evidence: { inputRef: "notes", quote: "Gloss finish" } }], unresolved: [] };
    vi.mocked(executeTextRequest).mockResolvedValueOnce({ json: invalid, text: JSON.stringify(invalid), model: "fixture", profileId: "fixture", providerRequestId: "fixture-request", usage: null });
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id })).rejects.toThrow(/requirements\.0/);
    const composition = (await f.t.run(ctx => ctx.db.get(id)))!;
    const snapshot = JSON.parse(composition.inputSnapshotJson);
    expect(composition.failureReason).not.toContain("Gloss finish");
    expect(composition.failureReason).not.toContain("ZodError");
    expect(snapshot.normalizationExecution.json).toEqual(invalid);
    expect(snapshot.resolvedIntent).toBeUndefined();
    expect(composition.status).toBe("failed");
    const account = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    expect(account!.balance).toBe(30);
  });

  it("limits invalid palettes to one correction, retains both diagnostics and refunds once", async () => {
    const f = await fixture();
    const notes = "Use only blue and white armor";
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes, kind: "palette-plan", requestKey: "wrong-palette-hue" });
    const response = (json: Record<string, unknown>) => ({ json, text: JSON.stringify(json), model: "fixture", profileId: "fixture", providerRequestId: "palette-provider-request", usage: { total_tokens: 12 } });
    let rejected: unknown;
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(blueWhiteNotes(notes))).mockImplementation(async () => {
      const output = await paletteResponse(f.t, id);
      const snapshot = JSON.parse((await f.t.run(ctx => ctx.db.get(id)))!.inputSnapshotJson) as CreativeSnapshot;
      const blueId = snapshot.resolvedIntent!.colors.find(color => color.family === "blue")!.colorId;
      output.entries.find(entry => entry.colorId === blueId)!.targetHex = "#FF0000";
      rejected = output;
      return response(output);
    });
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id })).rejects.toThrow(/color-family/);
    const composition = (await f.t.run(ctx => ctx.db.get(id)))!;
    const snapshot = JSON.parse(composition.inputSnapshotJson) as CreativeSnapshot;
    expect(snapshot.lastExecutionAttempt!.response).toEqual(rejected);
    expect(snapshot.lastExecutionAttempt!.metadata.providerRequestId).toBe("palette-provider-request");
    expect(snapshot.lastExecutionAttempt!.validationError).toContain("color-family");
    expect(snapshot.rejectedExecutionAttempt!.response).toEqual(rejected);
    expect(snapshot.lastExecutionAttempt).not.toHaveProperty("text");
    expect(composition.status).toBe("failed");
    expect(executeTextRequest).toHaveBeenCalledTimes(3);
    const account = await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique());
    expect(account!.balance).toBe(30);
    await f.t.mutation(internal.creativePipeline.failStale, { promptCompositionId: id });
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_reference", q => q.eq("referenceTable", "promptCompositions").eq("referenceId", id)).collect());
    expect(tx.filter(t => t.delta > 0)).toHaveLength(1);
  });

  it("corrects a rejected palette under the same reservation and preserves the original hard requirements", async () => {
    const f = await fixture();
    const notes = "Use only blue and white armor";
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, notes, kind: "palette-plan", requestKey: "palette-correction" });
    const response = (json: Record<string, unknown>, requestId: string) => ({ json, text: JSON.stringify(json), model: "fixture", profileId: "fixture", providerRequestId: requestId, usage: null });
    vi.mocked(executeTextRequest).mockResolvedValueOnce(response(blueWhiteNotes(notes), "normalize"))
      .mockImplementationOnce(async () => {
        const invalid = await paletteResponse(f.t, id);
        invalid.entries[0].targetHex = "#FF0000";
        return response(invalid, "invalid-palette");
      }).mockImplementationOnce(async (_ctx, args) => {
        expect(args.userPrompt).toContain("Palette correction (one final attempt)");
        expect(args.userPrompt).toContain("Palette violates color-family");
        expect(args.userPrompt).toContain("#FF0000");
        expect(args.systemPrompt).toContain("orange: [10,45]");
        const valid = await paletteResponse(f.t, id);
        // Allocation labels are corrected deterministically, without a third model request.
        for (const entry of valid.entries) Object.assign(entry, { coverage: { percent: 40, scope: "exterior-armor", source: "resolved-constraint" } });
        return response(valid, "corrected-palette");
      });
    await f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id });
    expect(executeTextRequest).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(executeTextRequest).mock.calls;
    expect(calls[1][1].deadlineMs).toBe(calls[2][1].deadlineMs);
    expect(calls[2][1].userPrompt.startsWith(calls[1][1].userPrompt)).toBe(true);
    const stored = (await f.t.run(ctx => ctx.db.get(id)))!;
    const snapshot = JSON.parse(stored.inputSnapshotJson) as CreativeSnapshot;
    expect(stored.status).toBe("consumed");
    expect(snapshot.rejectedExecutionAttempt!.metadata.providerRequestId).toBe("invalid-palette");
    expect(snapshot.rejectedExecutionAttempt!.validationError).toContain("color-family");
    expect(snapshot.lastExecutionAttempt!.metadata.providerRequestId).toBe("corrected-palette");
    expect(snapshot.lastExecutionAttempt!.validationError).toBeUndefined();
    const output = JSON.parse(stored.outputSummaryJson!);
    expect(output.visualPalette.entries.every((entry: { coverage: { source: string } }) => entry.coverage.source === "ai-allocation")).toBe(true);
    const tx = await f.t.run(ctx => ctx.db.query("creditTransactions").withIndex("by_reference", q => q.eq("referenceTable", "promptCompositions").eq("referenceId", id)).collect());
    expect(tx.filter(t => t.delta < 0)).toHaveLength(1);
    expect(tx.filter(t => t.delta > 0)).toHaveLength(0);
  });

  it("does not correct transport failures or start another request after the shared deadline", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "transport-failure" });
    vi.mocked(executeTextRequest).mockRejectedValueOnce(new Error("Palette violates color-family: HTTP 503"));
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id })).rejects.toThrow(/HTTP 503/);
    expect(executeTextRequest).toHaveBeenCalledTimes(1);
    vi.mocked(executeTextRequest).mockReset();
    const expiredId = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "expired-correction" });
    vi.mocked(executeTextRequest).mockImplementationOnce(async (_ctx, args) => {
      const json = await paletteResponse(f.t, expiredId);
      json.entries[0].roleSlug = "unknown-role";
      vi.setSystemTime(args.deadlineMs!);
      return { json, text: "{}", model: "fixture", profileId: "fixture", providerRequestId: null, usage: null };
    });
    await expect(f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: expiredId })).rejects.toThrow(/unknown role/);
    expect(executeTextRequest).toHaveBeenCalledTimes(1);
    expect((await f.t.run(ctx => ctx.db.get(expiredId)))!.status).toBe("failed");
  });

  it("discards a late response and does not correct a composition that expired during the request", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "stale-palette-response" });
    vi.mocked(executeTextRequest).mockImplementationOnce(async () => {
      const json = await paletteResponse(f.t, id);
      json.entries[0].roleSlug = "unknown-role";
      await f.t.mutation(internal.creativePipeline.failStale, { promptCompositionId: id });
      return { json, text: "{}", model: "fixture", profileId: "fixture", providerRequestId: null, usage: null };
    });
    await f.t.action(internal.creativeNode.executeComposition, { promptCompositionId: id });
    expect(executeTextRequest).toHaveBeenCalledTimes(1);
    const composition = (await f.t.run(ctx => ctx.db.get(id)))!;
    expect(composition.status).toBe("failed");
    expect(JSON.parse(composition.inputSnapshotJson).lastExecutionAttempt).toBeUndefined();
    expect((await f.t.run(ctx => ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.userId)).unique()))!.balance).toBe(30);
  });

  it("applies Notes to a saved custom style without mutating the saved intent", async () => {
    const f = await fixture();
    const savedIntent = { ...customIntent, version: "style-intent.v3", colors: [{ role: "primary", name: "Red armor", hex: "#E53935", coverage: 70 }], pattern: "none", explicitRequirements: { version: "normalized-user-intent.v1", requirements: [], unresolved: [] } };
    const styleId = await f.t.run(ctx => ctx.db.insert("userStyles", { userId: f.userId, name: savedIntent.name, intentJson: JSON.stringify(savedIntent), visibility: "private", status: "active", saveCount: 0, createdAt: 1, updatedAt: 1 }));
    Object.assign(f.input, { userStyleId: styleId, stylePresetId: undefined, styleRevision: undefined, styleIntentJson: JSON.stringify(savedIntent) });
    const notes = "Use only blue and white armor";
    const id = await resolveNotes(f, notes);
    const result = await completeResolvedPalette(f, id);
    await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, notes, paletteCompositionId: id });
    const style = await f.t.run(ctx => ctx.db.get(styleId));
    expect(JSON.parse(style!.intentJson)).toEqual(savedIntent);
    expect(result.resolvedIntent!.originalStyle).toEqual(savedIntent);
    expect(result.resolvedIntent!.colors.map(color => color.family).sort()).toEqual(["blue", "white"]);
  });

  it("continues an old approved palette after v3 publication using the frozen legacy generation protocol", async () => {
    const f = await fixture();
    const id = await f.client.mutation(internal.creativePipeline.begin, { ...f.input, kind: "palette-plan", requestKey: "legacy" });
    await f.t.run(async ctx => {
      const row = (await ctx.db.get(id))!;
      const snapshot = JSON.parse(row.inputSnapshotJson);
      delete snapshot.contractVersion; delete snapshot.resolvedIntent;
      snapshot.inputKey = legacyCreativeInputKey(f.input);
      snapshot.promptValues.baseModel += "\nKey anchors: green chest accents.";
      snapshot.promptValues.kitVariant += "\nKey anchors: green chest accents.";
      await ctx.db.patch(id, { inputSnapshotJson: JSON.stringify(snapshot) });
    });
    const output = { entries: f.catalog.roles.map(role => ({ roleSlug: role.slug, targetHex: "#EEEEEE", paintEffect: "solid", rationale: "Legacy neutral palette" })), sprayNotes: ["Thin coats"] };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: id, responseJson: JSON.stringify(output), executionJson: "{}" });
    await f.t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-2.5-flash" });
    const repaint = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id, requestKey: "legacy-spec" });
    const composition = (await f.t.run(ctx => ctx.db.get(repaint.promptCompositionId)))!;
    const snapshot = JSON.parse(composition.inputSnapshotJson);
    expect(snapshot.templateVersion).toBe("creation.v2");
    expect(snapshot.systemPrompt).toContain("Include every approved palette role exactly once");
    expect(snapshot.systemPrompt).not.toContain('"assignmentId"');
    expect(snapshot.systemPrompt).not.toContain('"version":"repaint-specification.v3"');
    expect(composition.composedPrompt).toContain("Approved legacy palette JSON:");
    expect(composition.composedPrompt).not.toContain("Effective creative intent JSON:");
    expect(composition.composedPrompt).not.toContain("green chest accents");
    expect(composition.composedPrompt).toContain("chest accent panel geometry");
    const spec = { summary: "Legacy kit", panels: f.catalog.roles.map(role => ({ roleSlug: role.slug, areas: [role.name], maskingNotes: "Mask panels" })), material: { surfaceTexture: "Smooth", reflectivity: "Low", coating: "Matte" }, weathering: { level: "clean", applicationNotes: "Clean" }, decals: { density: "low", placementNotes: "Native markings" } };
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: repaint.promptCompositionId, responseJson: JSON.stringify(spec), executionJson: "{}" });
    const again = await f.client.mutation(api.prototypes.initializePrototype, { ...f.input, paletteCompositionId: id, requestKey: "legacy-spec" });
    expect(again.conceptId).toBe(repaint.conceptId);
    const concept = await f.t.run(ctx => ctx.db.get(repaint.conceptId));
    expect(concept!.resolvedIntentJson).toBeUndefined();
    expect(JSON.parse(concept!.visualPaletteJson!).version).toBe("visual-palette.v2");
  });
});
