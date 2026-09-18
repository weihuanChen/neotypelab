import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";
import { styleIntentSchema } from "./creativeContracts";

const modules = import.meta.glob("./**/*.ts");
const intent = styleIntentSchema.parse({
  version: "style-intent.v1", source: "private", styleType: "custom", name: "Cyan Performance",
  palette: { primary: "cyan teal", secondary: "charcoal", accent: "magenta" },
  surfaceLogic: "smooth satin", graphicLanguage: "racing", contrast: "high", markingDensity: "medium",
  materialIntent: ["painted armor"], mood: "energetic", weathering: "clean", finish: "satin", paintability: "high",
});
async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.init.init, {});
  await t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-2.5-flash" });
  const owner = await seedUser(t, { tokenIdentifier: "style-owner", email: "owner@example.test", balance: 40 });
  const other = await seedUser(t, { tokenIdentifier: "style-other", email: "other@example.test", balance: 40 });
  const admin = await seedUser(t, { tokenIdentifier: "style-admin", email: "admin@example.test", isAdmin: true });
  const cost = await t.run(async ctx => (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-style-suggestion")).first())!.creditCost);
  return { t, owner, other, admin, cost };
}
async function interpreted(f: Awaited<ReturnType<typeof fixture>>) {
  const id = await f.owner.client.mutation(internal.styleInterpretations.begin, { description: "Private reference phrase", requestKey: "interpret-1" });
  await f.owner.client.mutation(internal.styleInterpretations.claim, { promptCompositionId: id });
  await f.t.mutation(internal.styleInterpretations.complete, { promptCompositionId: id, responseJson: JSON.stringify(intent), executionJson: '{"model":"fixture","profileId":"fixture"}' });
  return id;
}
async function saved(f: Awaited<ReturnType<typeof fixture>>) {
  const compositionId = await interpreted(f);
  const style = await f.owner.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: compositionId });
  return { ...style, compositionId };
}
async function balance(f: Awaited<ReturnType<typeof fixture>>) {
  return f.t.run(async ctx => (await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.owner.userId)).unique())!.balance);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Style interpretation lifecycle", () => {
  it("reserves once, claims once, restores successful output and protects ownership", async () => {
    const f = await fixture();
    const id = await interpreted(f);
    expect(await f.owner.client.mutation(internal.styleInterpretations.begin, { description: "Private reference phrase", requestKey: "interpret-1" })).toBe(id);
    expect(await f.owner.client.mutation(internal.styleInterpretations.claim, { promptCompositionId: id })).toBeNull();
    expect(await balance(f)).toBe(40 - f.cost);
    expect((await f.owner.client.query(api.styleInterpretations.latest, { description: "Private reference phrase" }))?.intent).toEqual(intent);
    expect(await f.other.client.query(api.styleInterpretations.latest, { description: "Private reference phrase" })).toBeNull();
    await expect(f.other.client.query(internal.styleInterpretations.result, { promptCompositionId: id })).rejects.toThrow(/not found/);
    await expect(f.owner.client.mutation(internal.styleInterpretations.begin, { description: "different", requestKey: "interpret-1" })).rejects.toThrow(/different/);
  });

  it("runs the public action through the text provider and reuses its request key", async () => {
    const f = await fixture();
    vi.stubEnv("GEMINI_API_KEY_OFFCIAL", "test-only");
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      id: "fixture-request", model: "gemini-2.5-flash",
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(intent) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const args = { description: "Cyan racing", requestKey: "public-action" };
    const first = await f.owner.client.action(api.prototypeTools.interpretCustomStyle, args);
    const second = await f.owner.client.action(api.prototypeTools.interpretCustomStyle, args);
    expect(first.intent).toEqual(intent);
    expect(second.promptCompositionId).toBe(first.promptCompositionId);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await balance(f)).toBe(40 - f.cost);
  });

  it("refunds malformed provider output once and cannot save failed interpretations", async () => {
    const f = await fixture();
    vi.stubEnv("GEMINI_API_KEY_OFFCIAL", "test-only");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: '{"wrong":"contract"}' } }],
    }), { status: 200 })));
    await expect(f.owner.client.action(api.prototypeTools.interpretCustomStyle, { description: "Cyan", requestKey: "bad-output" })).rejects.toThrow();
    const row = await f.t.run(ctx => ctx.db.query("promptCompositions").withIndex("by_user_request", q => q.eq("userId", f.owner.userId).eq("requestKey", "bad-output")).unique());
    await f.t.mutation(internal.creativePipeline.fail, { promptCompositionId: row!._id, reason: "repeat" });
    await f.t.mutation(internal.styleInterpretations.complete, { promptCompositionId: row!._id, responseJson: JSON.stringify(intent), executionJson: "{}" });
    expect(await balance(f)).toBe(40);
    await expect(f.owner.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: row!._id })).rejects.toThrow(/completed/);
  });

  it("expires abandoned requests, refunds them, and rejects late completion", async () => {
    const f = await fixture();
    const id = await f.owner.client.mutation(internal.styleInterpretations.begin, { description: "Cyan", requestKey: "abandoned" });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(await f.owner.client.mutation(internal.styleInterpretations.claim, { promptCompositionId: id })).toBeNull();
    expect(await balance(f)).toBe(40);
    await f.t.mutation(internal.styleInterpretations.complete, { promptCompositionId: id, responseJson: JSON.stringify(intent), executionJson: "{}" });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.status).toBe("failed");
  });

  it("enforces authentication, suspended-account checks and the shared text concurrency cap", async () => {
    const f = await fixture();
    await expect(f.t.mutation(internal.styleInterpretations.begin, { description: "Cyan", requestKey: "anon" })).rejects.toThrow(/authenticated/);
    for (const key of ["one", "two"]) await f.owner.client.mutation(internal.styleInterpretations.begin, { description: key, requestKey: key });
    await expect(f.owner.client.mutation(internal.styleInterpretations.begin, { description: "three", requestKey: "three" })).rejects.toThrow(/Two text/);
    await f.t.run(ctx => ctx.db.patch(f.other.userId, { accountStatus: "suspended" }));
    await expect(f.other.client.mutation(internal.styleInterpretations.begin, { description: "Cyan", requestKey: "suspended" })).rejects.toThrow(/suspended/);
  });

  it("rejects interpretation when credits are missing or the tariff is inactive", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.owner.userId)).unique();
      await ctx.db.patch(account!._id, { balance: 0 });
    });
    await expect(f.owner.client.mutation(internal.styleInterpretations.begin, { description: "Cyan", requestKey: "broke" })).rejects.toThrow(
      new RegExp(`Insufficient credits\\. ${f.cost} credits required, 0 available`)
    );
    await f.t.run(async ctx => {
      const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", f.owner.userId)).unique();
      await ctx.db.patch(account!._id, { balance: 40 });
      for (const rule of await ctx.db.query("creditPriceRules").withIndex("by_actionType", q => q.eq("actionType", "generate-style-suggestion")).collect()) {
        await ctx.db.patch(rule._id, { isActive: false });
      }
    });
    await expect(f.owner.client.mutation(internal.styleInterpretations.begin, { description: "Cyan", requestKey: "unpriced" })).rejects.toThrow(/currently unavailable/);
  });
});

describe("Private and community styles", () => {
  it("saves privately once and never exposes source descriptions through community payloads", async () => {
    const f = await fixture();
    const style = await saved(f);
    expect(await f.owner.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: style.compositionId })).toEqual({ styleId: style.styleId, intent });
    expect(await f.t.query(api.userStyles.getCommunityStyle, { styleId: style.styleId })).toBeNull();
    await expect(f.other.client.mutation(api.userStyles.saveInterpretation, { promptCompositionId: style.compositionId })).rejects.toThrow();
    await expect(f.other.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" })).rejects.toThrow();
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" });
    const community = await f.t.query(api.userStyles.community, {});
    expect(community).toHaveLength(1);
    expect(community[0].intent.source).toBe("community");
    expect(JSON.stringify(community)).not.toContain("Private reference phrase");
    expect(JSON.stringify(community)).not.toContain("promptCompositionId");
  });

  it("creates one private copy per user and preserves copies after the original is withdrawn", async () => {
    const f = await fixture();
    const style = await saved(f);
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" });
    const copy = await f.other.client.mutation(api.userStyles.saveCommunityStyle, { styleId: style.styleId });
    expect(await f.other.client.mutation(api.userStyles.saveCommunityStyle, { styleId: style.styleId })).toEqual(copy);
    await f.owner.client.mutation(api.userStyles.saveCommunityStyle, { styleId: style.styleId });
    expect((await f.t.query(api.userStyles.community, {}))[0].saveCount).toBe(1);
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "private" });
    expect(await f.t.query(api.userStyles.community, {})).toEqual([]);
    expect((await f.other.client.query(api.userStyles.mine, {}))[0].intent).toEqual(intent);
    await expect(f.other.client.mutation(api.userStyles.saveCommunityStyle, { styleId: style.styleId })).rejects.toThrow(/unavailable/);
    await expect(f.other.client.mutation(api.userStyles.setVisibility, { styleId: copy.styleId, visibility: "community" })).rejects.toThrow(/stay private/);
  });

  it("freezes saved-style lineage into concepts and rejects forged ownership or intent", async () => {
    const f = await fixture();
    const style = await saved(f);
    const catalog = await f.t.run(async ctx => ({ model: (await ctx.db.query("baseModels").first())!, material: (await ctx.db.query("materialPresets").first())!, roles: await ctx.db.query("colorRoles").collect() }));
    const args = { kitVariantId: catalog.model._id, materialPresetId: catalog.material._id, userStyleId: style.styleId, styleIntentJson: JSON.stringify(intent), weatheringLevel: "clean" as const };
    await expect(f.other.client.mutation(internal.creativePipeline.begin, { ...args, kind: "palette-plan", requestKey: "foreign-style" })).rejects.toThrow(/unavailable/);
    await expect(f.owner.client.mutation(internal.creativePipeline.begin, { ...args, styleIntentJson: JSON.stringify({ ...intent, name: "Forgery" }), kind: "palette-plan", requestKey: "tampered" })).rejects.toThrow(/does not match/);
    const paletteId = await f.owner.client.mutation(internal.creativePipeline.begin, { ...args, kind: "palette-plan", requestKey: "saved-palette" });
    await f.t.mutation(internal.creativePipeline.complete, { promptCompositionId: paletteId, responseJson: JSON.stringify({
      entries: catalog.roles.map(role => ({ roleSlug: role.slug, targetHex: "#00AABB", paintEffect: "solid", rationale: "Cyan armor" })), sprayNotes: ["Thin coats"],
    }), executionJson: "{}" });
    const concept = await f.owner.client.mutation(api.prototypes.initializePrototype, { ...args, paletteCompositionId: paletteId });
    const stored = await f.t.run(ctx => ctx.db.get(concept.conceptId));
    expect(stored?.userStyleId).toBe(style.styleId);
    expect(stored?.styleRootId).toBe(style.styleId);
    expect(stored?.styleIntentJson).toBe(JSON.stringify(intent));
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" });
    // A private draft is never counted as a public prototype.
    expect((await f.t.query(api.userStyles.community, {}))[0].publicPrototypeCount).toBe(0);
  });

  it("counts only published matching prototypes and removes withdrawn images from the community", async () => {
    const f = await fixture();
    const style = await saved(f);
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" });
    const conceptId = await f.t.run(async ctx => {
      const id = await ctx.db.insert("concepts", {
        userId: f.owner.userId, title: "Community prototype", status: "generated", visibility: "private",
        userStyleId: style.styleId, styleRootId: style.styleId, styleIntentJson: JSON.stringify(intent),
        weatheringLevel: "clean", searchText: "Community prototype",
      });
      const graph = await createAssetGraph(ctx, {
        legacyAsset: { userId: f.owner.userId, key: "private/original.png", bucket: "private",
          kind: "preview", contentType: "image/png", byteSize: 4000, status: "active" },
        mediaKind: "generated-image", rendition: "original", origin: "generated", bucketRole: "private", conceptId: id,
      });
      await upsertVersionStorageObjects(ctx, {
        mediaAssetId: graph.mediaAssetId, assetVersionId: graph.assetVersionId, userId: f.owner.userId,
        objects: (["master", "preview", "thumbnail"] as const).map(rendition => ({
          bucketRole: "private", bucket: "private", key: "private/" + rendition, rendition,
          contentType: "image/webp", byteSize: 1000, width: 1024, height: 1024, checksum: rendition, status: "ready",
        })),
      });
      await ctx.db.patch(id, { mediaAssetId: graph.mediaAssetId, currentAssetVersionId: graph.assetVersionId, previewAssetId: graph.legacyAssetId });
      return id;
    });
    expect((await f.t.query(api.userStyles.community, {}))[0].preview).toBeNull();
    const begin = await f.t.mutation(internal.publications.beginConceptPublication, {
      conceptId, tokenIdentifier: "style-owner", visibility: "public", publicBucket: "public",
    });
    if (begin.mode !== "copy") throw new Error("Expected copy");
    await f.t.mutation(internal.publications.finalizeConceptPublication, {
      publicationId: begin.publicationId, objects: begin.destinationObjects.map(object => ({
        storageObjectId: object.storageObjectId, rendition: object.rendition,
        publicUrl: "https://assets.example.test/" + object.rendition,
      })),
    });
    expect((await f.t.query(api.userStyles.community, {}))[0].publicPrototypeCount).toBe(1);
    expect((await f.t.query(api.userStyles.community, {}))[0].preview?.imageUrl).toBe("https://assets.example.test/preview");
    await f.t.run(ctx => ctx.db.patch(begin.publicationId, { status: "withdrawn" }));
    const after = (await f.t.query(api.userStyles.community, {}))[0];
    expect(after.publicPrototypeCount).toBe(0);
    expect(after.preview).toBeNull();
  });

  it("supports admin moderation and promotes only into a non-indexed official draft", async () => {
    const f = await fixture();
    const style = await saved(f);
    await f.owner.client.mutation(api.userStyles.setVisibility, { styleId: style.styleId, visibility: "community" });
    const args = { styleId: style.styleId, name: "Cyan Digital", slug: "cyan-digital-community", description: "Cyan racing language", confirmed: true };
    await expect(f.owner.client.mutation(api.userStyles.promote, args)).rejects.toThrow(/admin/);
    await f.admin.client.mutation(api.userStyles.moderate, { styleId: style.styleId, hidden: true });
    expect(await f.t.query(api.userStyles.community, {})).toEqual([]);
    await expect(f.admin.client.mutation(api.userStyles.promote, args)).rejects.toThrow(/active community/);
    await f.admin.client.mutation(api.userStyles.moderate, { styleId: style.styleId, hidden: false });
    await expect(f.admin.client.mutation(api.userStyles.promote, { ...args, confirmed: false })).rejects.toThrow(/Review/);
    const presetId = await f.admin.client.mutation(api.userStyles.promote, args);
    expect(await f.admin.client.mutation(api.userStyles.promote, args)).toBe(presetId);
    const preset = await f.t.run(ctx => ctx.db.get(presetId));
    expect(preset?.isActive).toBe(false);
    expect(JSON.parse(preset!.styleIntentJson!).source).toBe("official");
    expect((await f.t.query(api.styleEditorial.sitemap, {}))).toEqual([]);
    expect((await f.t.run(ctx => ctx.db.get(style.styleId)))?.intentJson).toBe(JSON.stringify(intent));
  });
});
