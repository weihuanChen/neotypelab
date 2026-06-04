import { v } from "convex/values";
import { vRecommendationFeedbackKind } from "./domain";
import { mutation } from "./functions";

export const setRecommendationFeedback = mutation({
  args: {
    conceptId: v.id("concepts"),
    recommendationType: v.string(),
    recommendationValue: v.string(),
    kind: vRecommendationFeedbackKind,
  },
  async handler(ctx, { conceptId, recommendationType, recommendationValue, kind }) {
    const viewer = ctx.viewerX();
    const existing = await ctx.db
      .query("recommendationFeedback")
      .withIndex("by_user_concept_recommendation", (q) =>
        q
          .eq("userId", viewer._id)
          .eq("conceptId", conceptId)
          .eq("recommendationType", recommendationType)
          .eq("recommendationValue", recommendationValue)
      )
      .collect();

    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.insert("recommendationFeedback", {
      userId: viewer._id,
      conceptId,
      recommendationType,
      recommendationValue,
      kind,
    });

    return { ok: true };
  },
});
