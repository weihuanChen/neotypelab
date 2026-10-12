import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./functions";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { portraitUrl } from "./kitPicker";
import { readStoredPaintPlan, type PaintPlan } from "./paintMappingEngine";
import { getPublishedRenditions } from "./publications";
import { isSharedShowcaseConcept } from "./showcasePolicy";
import { publicVisualPalette } from "./showcase";
import { summarizeConceptStyle } from "./styleRefinements";
import type { MutationCtx, QueryCtx } from "./types";

/**
 * Home page curation.
 *
 * The home page explains the product with one admin-picked build (hero plate +
 * "what a plan gives you") and a short carousel of builds. Everything returned
 * here is a public projection of already-public concepts: never storage keys,
 * prompts, or private paint-plan fields.
 */

export const HOME_CURATION_KEY = "home" as const;
export const MAX_HERO_PAINTS = 8;
export const MAX_HERO_CALLOUTS = MAX_HERO_PAINTS;
export const MAX_CAROUSEL_WORKS = 12;
const FALLBACK_CAROUSEL_WORKS = 6;
const SPRAY_STEPS = 8;
const PAINT_LETTERS = "ABCDEFGH";

const vCallout = v.object({ paintIndex: v.number(), x: v.number(), y: v.number() });

type HomeCallout = { paintIndex: number; x: number; y: number };

export type HomeHeroPaint = {
  letter: string;
  name: string;
  roleName: string;
  hex: string | null;
  area: string | null;
  coverage: number | null;
  paint: { brand: string; code: string; colorName: string } | null;
};

export type HomeHero = {
  conceptId: Id<"concepts">;
  title: string;
  href: string;
  kitName: string | null;
  styleName: string | null;
  creator: string | null;
  imageUrl: string;
  lineArtUrl: string | null;
  showLineArt: boolean;
  paints: HomeHeroPaint[];
  callouts: Array<{ letter: string; paintIndex: number; x: number; y: number }>;
  sprayNotes: string[];
};

export type HomeWork = {
  conceptId: Id<"concepts">;
  title: string;
  href: string;
  kitName: string | null;
  styleName: string | null;
  creator: string | null;
  imageUrl: string;
};

function isHomeEligible(concept: Doc<"concepts"> | null): concept is Doc<"concepts"> {
  return isSharedShowcaseConcept(concept) && concept?.visibility === "public";
}

async function getCuration(ctx: QueryCtx) {
  return await ctx.db
    .query("homeCuration")
    .withIndex("by_key", (q) => q.eq("key", HOME_CURATION_KEY))
    .unique();
}

function readPlan(concept: Doc<"concepts">): PaintPlan | null {
  try {
    const plan = readStoredPaintPlan(concept.palettePlanJson, concept._id, concept.title);
    return plan && plan.entries.length > 0 ? plan : null;
  } catch {
    return null;
  }
}

function heroPaints(concept: Doc<"concepts">, plan: PaintPlan): HomeHeroPaint[] {
  const visual = publicVisualPalette(concept)?.entries ?? [];
  const order: Array<{
    colorId?: string;
    colorName?: string;
    roleSlug: string;
    roleName: string;
    targetHex?: string;
    recommendedArea?: string;
    coverage?: { percent: number };
  }> = visual.length > 0 ? visual : plan.entries;

  return order.slice(0, MAX_HERO_PAINTS).map((entry, index) => {
    const match = plan.entries.find((candidate) =>
      entry.colorId || candidate.colorId
        ? Boolean(entry.colorId && entry.colorId === candidate.colorId)
        : entry.roleSlug === candidate.roleSlug,
    );
    const suggested = match?.suggestedPaint ?? null;
    const coverage = entry.coverage?.percent ?? match?.coverage?.percent ?? null;
    return {
      letter: PAINT_LETTERS[index],
      name: entry.colorName ?? entry.roleName,
      roleName: entry.roleName,
      hex: entry.targetHex ?? match?.targetHex ?? suggested?.hexPreview ?? null,
      area: entry.recommendedArea ?? match?.recommendedArea ?? null,
      coverage: typeof coverage === "number" ? coverage : null,
      paint: suggested
        ? { brand: suggested.brand, code: suggested.code, colorName: suggested.colorName }
        : null,
    };
  });
}

/** Resolve a public, published concept into the hero projection, or null when it cannot carry the hero. */
export async function loadHomeHero(
  ctx: QueryCtx,
  conceptId: Id<"concepts">,
  options: { callouts: HomeCallout[]; showLineArt: boolean },
): Promise<HomeHero | null> {
  const concept = await ctx.db.get(conceptId);
  if (!isHomeEligible(concept)) return null;
  const plan = readPlan(concept);
  if (!plan) return null;
  const [published, baseModel, stylePreset, owner] = await Promise.all([
    getPublishedRenditions(ctx, concept),
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    ctx.db.get(concept.userId),
  ]);
  const imageUrl = published?.master?.publicUrl ?? published?.preview?.publicUrl;
  if (!imageUrl) return null;

  const paints = heroPaints(concept, plan);
  const lineArtUrl = portraitUrl(baseModel?.fullBodyAssetKey);
  return {
    conceptId: concept._id,
    title: concept.title,
    href: `/prototype/${concept._id}`,
    kitName: baseModel?.name ?? null,
    styleName: summarizeConceptStyle(stylePreset, concept.styleIntentJson)?.name ?? null,
    creator: owner?.handle ?? null,
    imageUrl,
    lineArtUrl,
    showLineArt: options.showLineArt && lineArtUrl !== null,
    paints,
    callouts: options.callouts
      .filter((callout) => callout.paintIndex < paints.length)
      .map((callout) => ({ ...callout, letter: paints[callout.paintIndex].letter })),
    sprayNotes: plan.sprayNotes.slice(0, SPRAY_STEPS),
  };
}

async function loadHomeWork(ctx: QueryCtx, concept: Doc<"concepts">): Promise<HomeWork | null> {
  if (!isHomeEligible(concept)) return null;
  const [published, baseModel, stylePreset, owner] = await Promise.all([
    getPublishedRenditions(ctx, concept),
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    ctx.db.get(concept.userId),
  ]);
  const imageUrl = published?.preview?.publicUrl;
  if (!imageUrl) return null;
  return {
    conceptId: concept._id,
    title: concept.title,
    href: `/prototype/${concept._id}`,
    kitName: baseModel?.name ?? null,
    styleName: summarizeConceptStyle(stylePreset, concept.styleIntentJson)?.name ?? null,
    creator: owner?.handle ?? null,
    imageUrl,
  };
}

async function recentPublicConcepts(ctx: QueryCtx, limit: number) {
  const rows = await ctx.db
    .query("concepts")
    .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
    .order("desc")
    .take(limit);
  return rows.filter(isHomeEligible);
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

export const getHome = query({
  args: {},
  handler: async (ctx) => {
    const curation = await getCuration(ctx);

    let hero: HomeHero | null = null;
    let heroCurated = false;
    if (curation?.heroConceptId) {
      hero = await loadHomeHero(ctx, curation.heroConceptId, {
        callouts: curation.heroCallouts,
        showLineArt: curation.heroShowLineArt,
      });
      heroCurated = hero !== null;
    }

    const curatedWorks = curation
      ? compact(await Promise.all(curation.carouselConceptIds.map(async (id) => {
          const concept = await ctx.db.get(id);
          return concept ? loadHomeWork(ctx, concept) : null;
        })))
      : [];

    let recent: Doc<"concepts">[] | null = null;
    if (!hero) {
      // Until an admin picks one, borrow the newest public build that has a full plan.
      recent = await recentPublicConcepts(ctx, 40);
      for (const concept of recent.slice(0, 12)) {
        hero = await loadHomeHero(ctx, concept._id, { callouts: [], showLineArt: false });
        if (hero) break;
      }
    }

    let works = curatedWorks;
    if (works.length === 0) {
      recent ??= await recentPublicConcepts(ctx, 40);
      const pool = recent.filter((concept) => concept._id !== hero?.conceptId);
      works = compact(await Promise.all(
        pool.slice(0, FALLBACK_CAROUSEL_WORKS * 2).map((concept) => loadHomeWork(ctx, concept)),
      )).slice(0, FALLBACK_CAROUSEL_WORKS);
    }

    return {
      hero,
      works,
      curated: { hero: heroCurated, works: curatedWorks.length > 0 },
    };
  },
});

/* ------------------------------------------------------------------ admin */

export const adminWorkspace = query({
  args: {},
  handler: async (ctx) => {
    requireSuperAdmin(ctx);
    const curation = await getCuration(ctx);
    const recent = await recentPublicConcepts(ctx, 150);
    const candidates = compact(await Promise.all(recent.map(async (concept) => {
      const work = await loadHomeWork(ctx, concept);
      return work
        ? { ...work, createdAt: concept._creationTime, hasPaintPlan: readPlan(concept) !== null }
        : null;
    })));
    const carousel = curation
      ? compact(await Promise.all(curation.carouselConceptIds.map(async (id) => {
          const concept = await ctx.db.get(id);
          const work = concept ? await loadHomeWork(ctx, concept) : null;
          return { conceptId: id, work };
        })))
      : [];
    return {
      curation: curation
        ? {
            heroConceptId: curation.heroConceptId ?? null,
            heroShowLineArt: curation.heroShowLineArt,
            heroCallouts: curation.heroCallouts,
            updatedAt: curation.updatedAt,
          }
        : null,
      carousel,
      candidates,
    };
  },
});

export const adminHeroPreview = query({
  args: { conceptId: v.id("concepts") },
  handler: async (ctx, { conceptId }) => {
    requireSuperAdmin(ctx);
    return await loadHomeHero(ctx, conceptId, { callouts: [], showLineArt: true });
  },
});

async function upsertCuration(
  ctx: MutationCtx,
  userId: Id<"users">,
  patch: Partial<Pick<Doc<"homeCuration">, "heroConceptId" | "heroShowLineArt" | "heroCallouts" | "carouselConceptIds">>,
) {
  const existing = await ctx.db
    .query("homeCuration")
    .withIndex("by_key", (q) => q.eq("key", HOME_CURATION_KEY))
    .unique();
  const stamp = { updatedAt: Date.now(), updatedByUserId: userId };
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, ...stamp });
    return existing._id;
  }
  return await ctx.db.insert("homeCuration", {
    key: HOME_CURATION_KEY,
    heroShowLineArt: false,
    heroCallouts: [],
    carouselConceptIds: [],
    ...patch,
    ...stamp,
  });
}

export function validateCallouts(callouts: HomeCallout[], paintCount: number) {
  if (callouts.length > MAX_HERO_CALLOUTS) throw new Error(`Place at most ${MAX_HERO_CALLOUTS} markers`);
  const seen = new Set<number>();
  for (const callout of callouts) {
    if (!Number.isInteger(callout.paintIndex) || callout.paintIndex < 0 || callout.paintIndex >= paintCount) {
      throw new Error("Each marker must point at a color in this build's paint key");
    }
    if (seen.has(callout.paintIndex)) throw new Error("Each color can have only one marker");
    seen.add(callout.paintIndex);
    if (!(callout.x >= 0 && callout.x <= 1 && callout.y >= 0 && callout.y <= 1)) {
      throw new Error("Markers must sit inside the image");
    }
  }
  return callouts.map((callout) => ({
    paintIndex: callout.paintIndex,
    x: Math.round(callout.x * 1000) / 1000,
    y: Math.round(callout.y * 1000) / 1000,
  }));
}

export const saveHero = mutation({
  args: {
    conceptId: v.union(v.id("concepts"), v.null()),
    showLineArt: v.boolean(),
    callouts: v.array(vCallout),
  },
  handler: async (ctx, args) => {
    const { viewer } = requireSuperAdmin(ctx);
    if (args.conceptId === null) {
      await upsertCuration(ctx, viewer._id, { heroConceptId: undefined, heroCallouts: [], heroShowLineArt: false });
      await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: "clear-home-hero", entityType: "homeCuration" });
      return null;
    }
    const hero = await loadHomeHero(ctx, args.conceptId, { callouts: [], showLineArt: args.showLineArt });
    if (!hero) {
      throw new Error("Pick a public, published build that has a paint plan");
    }
    const callouts = validateCallouts(args.callouts, hero.paints.length);
    await upsertCuration(ctx, viewer._id, {
      heroConceptId: args.conceptId,
      heroShowLineArt: args.showLineArt && hero.lineArtUrl !== null,
      heroCallouts: callouts,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "set-home-hero",
      entityType: "homeCuration",
      entityId: args.conceptId,
      detailsJson: JSON.stringify({ callouts: callouts.length, showLineArt: args.showLineArt }),
    });
    return args.conceptId;
  },
});

export const saveCarousel = mutation({
  args: { conceptIds: v.array(v.id("concepts")) },
  handler: async (ctx, { conceptIds }) => {
    const { viewer } = requireSuperAdmin(ctx);
    if (conceptIds.length > MAX_CAROUSEL_WORKS) {
      throw new Error(`The carousel holds at most ${MAX_CAROUSEL_WORKS} builds`);
    }
    if (new Set(conceptIds).size !== conceptIds.length) {
      throw new Error("Each build can appear once");
    }
    for (const id of conceptIds) {
      const concept = await ctx.db.get(id);
      if (!concept || !(await loadHomeWork(ctx, concept))) {
        throw new Error("Only public, published builds can appear on the home page");
      }
    }
    await upsertCuration(ctx, viewer._id, { carouselConceptIds: conceptIds });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "set-home-carousel",
      entityType: "homeCuration",
      detailsJson: JSON.stringify({ count: conceptIds.length }),
    });
    return conceptIds.length;
  },
});
