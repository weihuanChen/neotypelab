import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { seedUser } from "@/tests/convexTestHelpers";
import { createAssetGraph, upsertVersionStorageObjects } from "./assetModel";

const modules = import.meta.glob("./**/*.ts");

type Backend = ReturnType<typeof convexTest>;

async function publishConcept(
  t: Backend,
  owner: { userId: Id<"users"> },
  title: string,
  options: { withPlan?: boolean } = {},
) {
  const conceptId = await t.run(async (ctx) => {
    const style = (await ctx.db.query("stylePresets").first())!;
    const model = (await ctx.db.query("baseModels").first())!;
    const paint = (await ctx.db.query("paintMappings").collect()).find((p) => p.isActive)!;
    const id = await ctx.db.insert("concepts", {
      userId: owner.userId, title, weatheringLevel: "clean", status: "generated",
      visibility: "private", searchText: title, stylePresetId: style._id, baseModelId: model._id,
      ...(options.withPlan === false ? {} : {
        palettePlanJson: JSON.stringify({
          entries: [
            { roleName: "Armor", roleSlug: "armor", rationale: "Base", recommendedArea: "Outer armor",
              suggestedPaint: { _id: paint._id, brand: paint.brand, code: paint.code, colorName: paint.colorName, hexPreview: "#D8D5CC" } },
            { roleName: "Accent", roleSlug: "accent", rationale: "Accent", targetHex: "#C25F2A", suggestedPaint: null },
          ],
          sprayNotes: ["Prime everything grey.", "Spray the armor base.", "Mask and spray accents."],
          privateDebug: "must-not-leak",
        }),
      }),
    });
    const graph = await createAssetGraph(ctx, {
      legacyAsset: { userId: owner.userId, key: `private/${title}.png`, bucket: "private-library",
        kind: "preview", contentType: "image/png", byteSize: 4000, status: "active" },
      mediaKind: "generated-image", rendition: "original", origin: "generated", bucketRole: "private", conceptId: id,
    });
    await upsertVersionStorageObjects(ctx, {
      mediaAssetId: graph.mediaAssetId, assetVersionId: graph.assetVersionId, userId: owner.userId,
      objects: (["master", "preview", "thumbnail"] as const).map((rendition) => ({
        bucketRole: "private", bucket: "private-library", key: `private/${title}-${rendition}.webp`,
        rendition, contentType: "image/webp", byteSize: 1000, width: 1024, height: 1024, checksum: `${title}-${rendition}`, status: "ready",
      })),
    });
    await ctx.db.patch(id, { mediaAssetId: graph.mediaAssetId, currentAssetVersionId: graph.assetVersionId, previewAssetId: graph.legacyAssetId });
    return id;
  });
  const tokenIdentifier = await t.run(async (ctx) => (await ctx.db.get(owner.userId))!.tokenIdentifier);
  const begin = await t.mutation(internal.publications.beginConceptPublication, {
    conceptId, tokenIdentifier, visibility: "public", publicBucket: "public-showcase",
  });
  if (begin.mode !== "copy") throw new Error("Expected copy");
  await t.mutation(internal.publications.finalizeConceptPublication, {
    publicationId: begin.publicationId,
    objects: begin.destinationObjects.map((object) => ({
      storageObjectId: object.storageObjectId, rendition: object.rendition,
      publicUrl: `https://assets.example.test/${title}/${object.rendition}.webp`,
    })),
  });
  return conceptId;
}

async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.init.init, {});
  const admin = await seedUser(t, { tokenIdentifier: "curator", email: "curator@example.test", isAdmin: true });
  const owner = await seedUser(t, { tokenIdentifier: "artist", email: "artist@example.test" });
  return { t, admin, owner };
}

describe("home curation", () => {
  it("falls back to the newest public build with a plan until an admin curates", async () => {
    const f = await fixture();
    expect(await f.t.query(api.homeFeature.getHome, {})).toEqual({
      hero: null, works: [], curated: { hero: false, works: false },
    });
    const planned = await publishConcept(f.t, f.owner, "Planned");
    await publishConcept(f.t, f.owner, "No plan", { withPlan: false });

    const home = await f.t.query(api.homeFeature.getHome, {});
    expect(home.hero?.conceptId).toBe(planned);
    expect(home.hero?.paints.map((paint) => paint.letter)).toEqual(["A", "B"]);
    expect(home.hero?.paints[1]).toMatchObject({ hex: "#C25F2A", paint: null });
    expect(home.hero?.sprayNotes).toHaveLength(3);
    // The hero is not repeated in the fallback carousel.
    expect(home.works.map((work) => work.title)).toEqual(["No plan"]);
    expect(home.curated).toEqual({ hero: false, works: false });
    expect(JSON.stringify(home)).not.toContain("must-not-leak");
    expect(JSON.stringify(home)).not.toContain("private/");
  });

  it("only lets admins curate, and validates markers and builds", async () => {
    const f = await fixture();
    const first = await publishConcept(f.t, f.owner, "First");
    const second = await publishConcept(f.t, f.owner, "Second");
    const bare = await publishConcept(f.t, f.owner, "Bare", { withPlan: false });

    await expect(f.owner.client.mutation(api.homeFeature.saveHero, {
      conceptId: first, showLineArt: false, callouts: [],
    })).rejects.toThrow(/admin/);
    await expect(f.owner.client.query(api.homeFeature.adminWorkspace, {})).rejects.toThrow(/admin/);

    await expect(f.admin.client.mutation(api.homeFeature.saveHero, {
      conceptId: bare, showLineArt: false, callouts: [],
    })).rejects.toThrow(/paint plan/);
    await expect(f.admin.client.mutation(api.homeFeature.saveHero, {
      conceptId: first, showLineArt: false, callouts: [{ paintIndex: 5, x: 0.5, y: 0.5 }],
    })).rejects.toThrow(/paint key/);
    await expect(f.admin.client.mutation(api.homeFeature.saveHero, {
      conceptId: first, showLineArt: false, callouts: [{ paintIndex: 0, x: 1.4, y: 0.5 }],
    })).rejects.toThrow(/inside/);

    await f.admin.client.mutation(api.homeFeature.saveHero, {
      conceptId: first, showLineArt: true, callouts: [{ paintIndex: 1, x: 0.25, y: 0.75 }],
    });
    await f.admin.client.mutation(api.homeFeature.saveCarousel, { conceptIds: [bare, second] });

    const home = await f.t.query(api.homeFeature.getHome, {});
    expect(home.curated).toEqual({ hero: true, works: true });
    expect(home.hero?.conceptId).toBe(first);
    expect(home.hero?.callouts).toEqual([{ letter: "B", paintIndex: 1, x: 0.25, y: 0.75 }]);
    expect(home.works.map((work) => work.title)).toEqual(["Bare", "Second"]);

    const workspace = await f.admin.client.query(api.homeFeature.adminWorkspace, {});
    expect(workspace.curation?.heroConceptId).toBe(first);
    expect(workspace.candidates.find((c) => c.conceptId === bare)?.hasPaintPlan).toBe(false);
  });

  it("drops curated builds that stop being public", async () => {
    const f = await fixture();
    const first = await publishConcept(f.t, f.owner, "First");
    const second = await publishConcept(f.t, f.owner, "Second");
    await f.admin.client.mutation(api.homeFeature.saveHero, { conceptId: first, showLineArt: false, callouts: [] });
    await f.admin.client.mutation(api.homeFeature.saveCarousel, { conceptIds: [first, second] });

    await f.t.run((ctx) => ctx.db.patch(first, { visibility: "private" }));
    const home = await f.t.query(api.homeFeature.getHome, {});
    expect(home.curated.hero).toBe(false);
    expect(home.hero?.conceptId).toBe(second);
    expect(home.works.map((work) => work.title)).toEqual(["Second"]);

    await expect(f.admin.client.mutation(api.homeFeature.saveCarousel, { conceptIds: [first] }))
      .rejects.toThrow(/public/);
    await expect(f.admin.client.mutation(api.homeFeature.saveCarousel, { conceptIds: [second, second] }))
      .rejects.toThrow(/once/);
  });
});
