import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { vConceptInteractionKind } from "./domain";
import { mutation } from "./functions";
import { QueryCtx } from "./types";

export const togglePackInteraction = mutation({
  args: {
    creatorPackId: v.id("creatorPacks"),
    kind: vConceptInteractionKind,
  },
  async handler(ctx, { creatorPackId, kind }) {
    const viewer = ctx.viewerX();
    const creatorPack = await ctx.db.get(creatorPackId);

    if (!isShareableCreatorPack(creatorPack)) {
      throw new Error("This creator pack is not available on a public surface");
    }

    const existing = await ctx.db
      .query("packInteractions")
      .withIndex("by_user_pack_kind", (q) =>
        q.eq("userId", viewer._id).eq("creatorPackId", creatorPackId).eq("kind", kind)
      )
      .unique();

    if (existing !== null) {
      await ctx.db.delete(existing._id);
      return { active: false, kind };
    }

    await ctx.db.insert("packInteractions", {
      userId: viewer._id,
      creatorPackId,
      kind,
    });

    return { active: true, kind };
  },
});

export async function getCreatorPackEngagementSnapshot(
  ctx: QueryCtx,
  creatorPackId: Id<"creatorPacks">
) {
  const [likeCount, saveCount, viewerHasLiked, viewerHasSaved] = await Promise.all([
    countPackInteractions(ctx, creatorPackId, "like"),
    countPackInteractions(ctx, creatorPackId, "save"),
    hasViewerInteraction(ctx, creatorPackId, "like"),
    hasViewerInteraction(ctx, creatorPackId, "save"),
  ]);

  return {
    likeCount,
    saveCount,
    viewerHasLiked,
    viewerHasSaved,
  };
}

async function countPackInteractions(
  ctx: QueryCtx,
  creatorPackId: Id<"creatorPacks">,
  kind: "like" | "save"
) {
  const items = await ctx.db
    .query("packInteractions")
    .withIndex("by_pack_kind", (q) => q.eq("creatorPackId", creatorPackId).eq("kind", kind))
    .collect();
  return items.length;
}

async function hasViewerInteraction(
  ctx: QueryCtx,
  creatorPackId: Id<"creatorPacks">,
  kind: "like" | "save"
) {
  const viewer = ctx.viewer;
  if (viewer === null) {
    return false;
  }

  const item = await ctx.db
    .query("packInteractions")
    .withIndex("by_user_pack_kind", (q) =>
      q.eq("userId", viewer._id).eq("creatorPackId", creatorPackId).eq("kind", kind)
    )
    .unique();

  return item !== null;
}

function isShareableCreatorPack(
  creatorPack: Doc<"creatorPacks"> | null
): creatorPack is Doc<"creatorPacks"> {
  return creatorPack !== null && creatorPack.isActive;
}
