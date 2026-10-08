import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  BASE_BLOCKLIST,
  normalizeForBlocklist,
  type BlocklistTerm,
} from "./contentBlocklistPolicy";

export const vBlocklistCategory = v.union(
  v.literal("sexual"),
  v.literal("child-safety"),
  v.literal("violence"),
  v.literal("hate"),
  v.literal("deepfake"),
  v.literal("ip"),
  v.literal("extremism")
);

/** Active terms for screening; falls back to the base list until the table is seeded. */
export const activeTerms = internalQuery({
  args: {},
  handler: async (ctx): Promise<BlocklistTerm[]> => {
    const rows = await ctx.db.query("contentBlocklistTerms").collect();
    if (rows.length === 0) return [...BASE_BLOCKLIST];
    return rows
      .filter((row) => row.isActive)
      .map((row) => ({ term: row.term, category: row.category }));
  },
});

/**
 * Idempotently insert any base terms not yet in the table. Never reactivates a
 * term an operator switched off. Run after deploy:
 * `npx convex run contentBlocklist:seedBaseTerms` (add `--prod`).
 */
export const seedBaseTerms = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    const now = Date.now();
    for (const entry of BASE_BLOCKLIST) {
      const term = normalizeForBlocklist(entry.term);
      const existing = await ctx.db
        .query("contentBlocklistTerms")
        .withIndex("by_term", (q) => q.eq("term", term))
        .unique();
      if (existing) continue;
      await ctx.db.insert("contentBlocklistTerms", {
        term, category: entry.category, isActive: true, source: "base", updatedAt: now,
      });
      inserted += 1;
    }
    return { inserted, total: BASE_BLOCKLIST.length };
  },
});

/** Add or re-enable a term: `npx convex run contentBlocklist:addTerm '{"term":"…","category":"ip","note":"…"}'`. */
export const addTerm = internalMutation({
  args: { term: v.string(), category: vBlocklistCategory, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const term = normalizeForBlocklist(args.term);
    if (term.length < 2 || term.length > 80) throw new Error("Term must be 2–80 characters after normalization");
    const existing = await ctx.db
      .query("contentBlocklistTerms")
      .withIndex("by_term", (q) => q.eq("term", term))
      .unique();
    const fields = { category: args.category, isActive: true, note: args.note, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("contentBlocklistTerms", { term, source: "admin", ...fields });
  },
});

/** Switch a term off (or back on) after reviewing false positives in contentSafetyScans. */
export const setTermActive = internalMutation({
  args: { term: v.string(), isActive: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const term = normalizeForBlocklist(args.term);
    const existing = await ctx.db
      .query("contentBlocklistTerms")
      .withIndex("by_term", (q) => q.eq("term", term))
      .unique();
    if (!existing) throw new Error(`Blocklist term not found: ${term}`);
    await ctx.db.patch(existing._id, {
      isActive: args.isActive, note: args.note ?? existing.note, updatedAt: Date.now(),
    });
  },
});

export const listTerms = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("contentBlocklistTerms").collect();
    return rows
      .map(({ term, category, isActive, source, note, updatedAt }) => ({ term, category, isActive, source, note, updatedAt }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term));
  },
});
