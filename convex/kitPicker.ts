import { v } from "convex/values";
import { mutation, query } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { getPublicR2ObjectUrl } from "./r2Config";
import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";

export function normalizeKitSearch(text: string) { return text.toLowerCase().replace(new RegExp("[^\\p{L}\\p{N}]", "gu"), ""); }
export function kitTypes(kit: { tags: string[]; silhouetteType?: string }) {
  const text = `${kit.tags.join(" ")} ${kit.silhouetteType ?? ""}`;
  return [text.includes("hero") ? "Hero" : null, text.includes("heavy") ? "Heavy" : null,
    /transform/.test(text) ? "Transformable" : null, /full-inner-frame/.test(text) ? "Full inner frame" : null].filter((item): item is string => item !== null);
}
export function portraitUrl(key?: string) {
  if (!key) return null;
  if (/^https:\/\//.test(key)) return key;
  return getPublicR2ObjectUrl(key) ?? null;
}
const filters = { universes: v.array(v.string()), grades: v.array(v.string()), types: v.array(v.string()), manufacturers: v.array(v.string()) };
export const browse = query({
  args: { search: v.string(), scope: v.union(v.literal("all"), v.literal("recent"), v.literal("favorites"), v.literal("featured")), page: v.number(), ...filters },
  handler: async (ctx, args) => {
    // Bounded catalog scan provides infix/alias search and facet counts. Only one page
    // of display records reaches the browser; replace with an external index beyond 5k kits.
    const [kits, units, series, favorites, concepts] = await Promise.all([
      ctx.db.query("baseModels").take(5000), ctx.db.query("baseUnits").take(5000), ctx.db.query("ipSeries").take(1000),
      ctx.viewer ? ctx.db.query("kitFavorites").withIndex("by_user", q => q.eq("userId", ctx.viewer!._id)).collect() : [],
      ctx.viewer ? Promise.all((["draft", "generated", "archived"] as const).map(status => ctx.db.query("concepts").withIndex("by_user_status", q => q.eq("userId", ctx.viewer!._id).eq("status", status)).order("desc").take(40))).then(groups => groups.flat()) : [],
    ]);
    const unitMap = new Map(units.map(unit => [unit._id, unit]));
    const seriesMap = new Map(series.map(row => [row._id, row]));
    const recent = Array.from(new Set(concepts.sort((a,b) => b._creationTime - a._creationTime).flatMap(c => c.baseModelId ? [c.baseModelId] : [])));
    const favoriteIds = new Set(favorites.map(row => row.kitId));
    const records = kits.filter(isPublicModelCatalogRecord).flatMap(kit => {
      const unit = kit.baseUnitId ? unitMap.get(kit.baseUnitId) : null;
      const ip = unit ? seriesMap.get(unit.ipSeriesId) : null;
      if ((unit && !isPublicModelCatalogRecord(unit)) || (ip && !isPublicModelCatalogRecord(ip))) return [];
      return [{ id: kit._id, name: kit.name, grade: kit.grade ?? "", scale: kit.scale ?? "", releaseVersion: kit.releaseVersion ?? "",
        universe: ip?.universe ?? ip?.name ?? kit.series ?? "", manufacturer: kit.primaryModelBrand ?? kit.manufacturer ?? "",
        types: kitTypes(kit), portrait: portraitUrl(kit.thumbnailAssetKey), favorite: favoriteIds.has(kit._id),
        searchText: normalizeKitSearch([kit.name, kit.slug, kit.grade, kit.scale, kit.series, kit.primaryModelBrand, kit.manufacturer,
          kit.releaseVersion, ...kit.aliases, ...kit.tags, unit?.name, unit?.unitCode, ...(unit?.aliases ?? []), ip?.name, ip?.universe].filter(Boolean).join(" ")),
      }];
    });
    const selected = (values: string[], value: string) => !values.length || values.includes(value);
    const term = normalizeKitSearch(args.search.slice(0, 200));
    const terms = args.search.slice(0, 200).trim().split(/\s+/).map(normalizeKitSearch).filter(Boolean);
    const scoped = records.filter(row =>
      (args.scope !== "favorites" || row.favorite) && (args.scope !== "recent" || recent.includes(row.id)) &&
      terms.every(value => row.searchText.includes(value)) && selected(args.universes, row.universe) && selected(args.grades, row.grade) &&
      selected(args.manufacturers, row.manufacturer) && (!args.types.length || row.types.some(type => args.types.includes(type))));
    scoped.sort((a,b) => args.scope === "recent" ? recent.indexOf(a.id) - recent.indexOf(b.id)
      : Number(normalizeKitSearch(b.name) === term) - Number(normalizeKitSearch(a.name) === term) || a.name.localeCompare(b.name));
    // Featured is the small seeded/editorial collection until explicit popularity exists.
    const pool = args.scope === "featured" ? scoped.slice(0, 18) : scoped;
    const pages = Math.max(1, Math.ceil(pool.length / 18));
    const page = Math.min(pages, Math.max(1, Math.floor(args.page)));
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();
    return { page, pages, total: pool.length, items: pool.slice((page - 1) * 18, page * 18).map(({ searchText: _search, ...row }) => row),
      facets: { universes: unique(records.map(row => row.universe)), grades: unique(records.map(row => row.grade)),
        manufacturers: unique(records.map(row => row.manufacturer)), types: unique(records.flatMap(row => row.types)) } };
  },
});

export const selected = query({ args: { kitId: v.optional(v.id("baseModels")), slug: v.optional(v.string()) }, handler: async (ctx, args) => {
  const kit = args.kitId ? await ctx.db.get(args.kitId) : args.slug ? await ctx.db.query("baseModels").withIndex("by_slug", q => q.eq("slug", args.slug!)).unique() : null;
  if (!kit || !isPublicModelCatalogRecord(kit)) return null;
  return { ...await summarizeBaseModelWithHierarchy(ctx, kit), portrait: portraitUrl(kit.thumbnailAssetKey) };
} });

export const favorite = mutation({ args: { kitId: v.id("baseModels"), selected: v.boolean() }, handler: async (ctx, args) => {
  const viewer = ctx.viewerX();
  const kit = await ctx.db.get(args.kitId);
  if (!kit || !isPublicModelCatalogRecord(kit)) throw new Error("Kit unavailable");
  const existing = await ctx.db.query("kitFavorites").withIndex("by_user_kit", q => q.eq("userId", viewer._id).eq("kitId", args.kitId)).unique();
  if (args.selected && !existing) await ctx.db.insert("kitFavorites", { userId: viewer._id, kitId: args.kitId, createdAt: Date.now() });
  if (!args.selected && existing) await ctx.db.delete(existing._id);
} });
