import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { vConceptInteractionKind } from "./domain";
import { mutation } from "./functions";
import { MutationCtx, QueryCtx } from "./types";

type ShareableConcept = Doc<"concepts"> & {
  visibility: "public" | "unlisted";
  status: "generated" | "archived";
};

export const toggleConceptInteraction = mutation({
  args: {
    conceptId: v.id("concepts"),
    kind: vConceptInteractionKind,
  },
  async handler(ctx, { conceptId, kind }) {
    const viewer = ctx.viewerX();
    const concept = await ctx.db.get(conceptId);

    if (!isShareableConcept(concept)) {
      throw new Error("This concept is not available on a public share surface");
    }

    const existing = await ctx.db
      .query("conceptInteractions")
      .withIndex("by_user_concept_kind", (q) =>
        q.eq("userId", viewer._id).eq("conceptId", conceptId).eq("kind", kind)
      )
      .unique();

    if (existing !== null) {
      await ctx.db.delete(existing._id);
      return { active: false, kind };
    }

    await ctx.db.insert("conceptInteractions", {
      userId: viewer._id,
      conceptId,
      kind,
    });

    return { active: true, kind };
  },
});

export async function getConceptEngagementSnapshot(
  ctx: QueryCtx,
  conceptId: Id<"concepts">
) {
  const [likeCount, saveCount, viewerHasLiked, viewerHasSaved] = await Promise.all([
    countConceptInteractions(ctx, conceptId, "like"),
    countConceptInteractions(ctx, conceptId, "save"),
    hasViewerInteraction(ctx, conceptId, "like"),
    hasViewerInteraction(ctx, conceptId, "save"),
  ]);

  return {
    likeCount,
    saveCount,
    viewerHasLiked,
    viewerHasSaved,
  };
}

async function countConceptInteractions(
  ctx: QueryCtx,
  conceptId: Id<"concepts">,
  kind: "like" | "save"
) {
  const items = await ctx.db
    .query("conceptInteractions")
    .withIndex("by_concept_kind", (q) => q.eq("conceptId", conceptId).eq("kind", kind))
    .collect();
  return items.length;
}

async function hasViewerInteraction(
  ctx: QueryCtx,
  conceptId: Id<"concepts">,
  kind: "like" | "save"
) {
  const viewer = ctx.viewer;
  if (viewer === null) {
    return false;
  }

  const item = await ctx.db
    .query("conceptInteractions")
    .withIndex("by_user_concept_kind", (q) =>
      q.eq("userId", viewer._id).eq("conceptId", conceptId).eq("kind", kind)
    )
    .unique();

  return item !== null;
}

function isShareableConcept(
  concept: Doc<"concepts"> | null
): concept is ShareableConcept {
  return (
    concept !== null &&
    (concept.visibility === "public" || concept.visibility === "unlisted") &&
    (concept.status === "generated" || concept.status === "archived")
  );
}
