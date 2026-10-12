import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation } from "./functions";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { passesShowcaseIndexQuality, SHOWCASE_INDEX_DELAY_MS } from "./showcasePolicy";

export async function startShowcaseIndexWait(ctx: MutationCtx, conceptId: Id<"concepts">, publicationId: Id<"assetPublications">, now: number): Promise<void> {
  await ctx.db.patch(conceptId, { publicSince: now, indexEligible: false, publicContentUpdatedAt: now });
  await ctx.scheduler.runAt(now + SHOWCASE_INDEX_DELAY_MS, internal.showcaseIndexing.evaluate, {
    conceptId, publicationId, publicSince: now,
  });
}

export const evaluate = internalMutation({
  args: { conceptId: v.id("concepts"), publicationId: v.id("assetPublications"), publicSince: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const concept = await ctx.db.get(args.conceptId);
    if (!concept || concept.visibility !== "public" || concept.publicSince !== args.publicSince ||
      concept.activePublicationId !== args.publicationId) return null;
    const indexEligible = Date.now() >= args.publicSince + SHOWCASE_INDEX_DELAY_MS &&
      await passesShowcaseIndexQuality(ctx, concept);
    if (concept.indexEligible !== indexEligible) await ctx.db.patch(concept._id, { indexEligible });
    return null;
  },
});

// Bounded reconciliation also initializes existing public records conservatively:
// old asset timestamps cannot prove that a work has been continuously public.
export const reconcile = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db.query("concepts").withIndex("by_visibility", q => q.eq("visibility", "public"))
      .paginate({ cursor: cursor ?? null, numItems: 20 });
    const now = Date.now();
    for (const concept of result.page) {
      if (!concept.activePublicationId) continue;
      if (concept.publicSince === undefined) {
        await startShowcaseIndexWait(ctx, concept._id, concept.activePublicationId, now);
      } else {
        const indexEligible = now >= concept.publicSince + SHOWCASE_INDEX_DELAY_MS &&
          await passesShowcaseIndexQuality(ctx, concept);
        if (concept.indexEligible !== indexEligible) await ctx.db.patch(concept._id, { indexEligible });
      }
    }
    if (!result.isDone) await ctx.scheduler.runAfter(0, internal.showcaseIndexing.reconcile, { cursor: result.continueCursor });
    return null;
  },
});

// A human triage decision, not an automatic consequence of a raw user report.
export const setReviewStatus = mutation({
  args: {
    conceptId: v.id("concepts"),
    status: v.union(v.literal("clear"), v.literal("pending-review"), v.literal("hidden"), v.literal("duplicate"), v.literal("low-quality")),
  },
  returns: v.null(),
  handler: async (ctx, { conceptId, status }) => {
    const { viewer } = requireSuperAdmin(ctx);
    const concept = await ctx.db.get(conceptId);
    if (!concept) throw new Error("Concept not found");
    await ctx.db.patch(conceptId, { showcaseReviewStatus: status, indexEligible: false });
    if (status === "hidden") {
      const owner = await ctx.db.get(concept.userId);
      if (owner) await ctx.runMutation(internal.publications.beginConceptWithdrawal, { conceptId, tokenIdentifier: owner.tokenIdentifier });
    }
    if (status === "clear" && concept.publicSince !== undefined && concept.activePublicationId) {
      await ctx.scheduler.runAt(Math.max(Date.now(), concept.publicSince + SHOWCASE_INDEX_DELAY_MS), internal.showcaseIndexing.evaluate, {
        conceptId, publicationId: concept.activePublicationId, publicSince: concept.publicSince,
      });
    }
    await writeAdminAuditLog(ctx, { actorUserId: viewer._id, action: "review-showcase-indexing", entityType: "concept", entityId: conceptId, detailsJson: JSON.stringify({ status }) });
    return null;
  },
});
