import { v } from "convex/values";
import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";
import { vFeedbackCategory } from "./domain";
import { mutation, query } from "./functions";

const MIN_FEEDBACK_LENGTH = 12;
const MAX_FEEDBACK_LENGTH = 500;

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const reports = (
      await Promise.all([
        ctx.db
          .query("feedbackReports")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", ctx.viewerX()._id).eq("status", "open")
          )
          .collect(),
        ctx.db
          .query("feedbackReports")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", ctx.viewerX()._id).eq("status", "triaged")
          )
          .collect(),
        ctx.db
          .query("feedbackReports")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", ctx.viewerX()._id).eq("status", "resolved")
          )
          .collect(),
      ])
    )
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      reports.map(async (report) => {
        const [baseModel, stylePreset, concept, queueItem] = await Promise.all([
          report.baseModelId ? ctx.db.get(report.baseModelId) : null,
          report.stylePresetId ? ctx.db.get(report.stylePresetId) : null,
          report.conceptId ? ctx.db.get(report.conceptId) : null,
          ctx.db
            .query("adminQueue")
            .withIndex("by_status", (q) => q.eq("status", "open"))
            .collect()
            .then((items) => items.find((item) => item.itemType === "feedback" && item.itemId === report._id)),
        ]);

        const kitVariantSummary = await summarizeBaseModelWithHierarchy(ctx, baseModel);

        return {
          _id: report._id,
          _creationTime: report._creationTime,
          category: report.category,
          status: report.status,
          message: report.message,
          sourcePage: report.sourcePage,
          adminNotes: report.adminNotes,
          kitVariant: kitVariantSummary,
          baseModel: kitVariantSummary,
          stylePreset: stylePreset
            ? {
                _id: stylePreset._id,
                name: stylePreset.name,
              }
            : null,
          concept: concept
            ? {
                _id: concept._id,
                title: concept.title,
                status: concept.status,
              }
            : null,
          queue: queueItem
            ? {
                _id: queueItem._id,
                priority: queueItem.priority,
                status: queueItem.status,
              }
            : null,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    category: vFeedbackCategory,
    message: v.string(),
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    conceptId: v.optional(v.id("concepts")),
    sourcePage: v.optional(v.string()),
  },
  async handler(
    ctx,
    { category, message, baseModelId, kitVariantId, stylePresetId, conceptId, sourcePage }
  ) {
    const viewer = ctx.viewerX();
    const normalizedMessage = message.trim();
    const selectedKitVariantId = kitVariantId ?? baseModelId;

    if (normalizedMessage.length < MIN_FEEDBACK_LENGTH) {
      throw new Error(`Feedback must be at least ${MIN_FEEDBACK_LENGTH} characters`);
    }
    if (normalizedMessage.length > MAX_FEEDBACK_LENGTH) {
      throw new Error(`Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer`);
    }

    const concept = conceptId ? await ctx.db.get(conceptId) : null;
    if (conceptId && (concept === null || concept.userId !== viewer._id)) {
      throw new Error("You can only attach feedback to your own concepts");
    }

    const feedbackId = await ctx.db.insert("feedbackReports", {
      userId: ctx.viewerX()._id,
      category,
      status: "open",
      message: normalizedMessage,
      baseModelId: selectedKitVariantId,
      stylePresetId,
      conceptId,
      relatedGenerationJobId: concept?.generationJobId,
      sourcePage,
    });

    await ctx.db.insert("adminQueue", {
      itemType: "feedback",
      itemId: feedbackId,
      priority: feedbackPriority(category),
      status: "open",
      summary: buildFeedbackSummary(category, concept?.title, normalizedMessage),
    });

    return feedbackId;
  },
});

function buildFeedbackSummary(category: string, conceptTitle: string | undefined, message: string) {
  const context = conceptTitle ? ` / ${conceptTitle}` : "";
  return `${category.toUpperCase()}${context} / ${message.slice(0, 96)}`;
}

function feedbackPriority(category: string) {
  if (category === "generation-quality") {
    return 10;
  }
  if (category === "missing-base-model" || category === "paint-mapping") {
    return 20;
  }
  if (category === "style-request") {
    return 30;
  }
  return 40;
}
