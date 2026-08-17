import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { nextArchiveNumber } from "./archiveNumbers";
import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";
import { vFeedbackCategory } from "./domain";
import { mutation, query } from "./functions";
import type { QueryCtx } from "./types";

const MIN_FEEDBACK_LENGTH = 12;
const MAX_FEEDBACK_LENGTH = 500;
const MIN_TITLE_LENGTH = 4;
const MAX_TITLE_LENGTH = 80;

export const getContext = query({
  args: { conceptId: v.string() },
  async handler(ctx, { conceptId }) {
    if (ctx.viewer === null) return null;

    const normalizedConceptId = ctx.db.normalizeId("concepts", conceptId);
    const concept = normalizedConceptId ? await ctx.db.get(normalizedConceptId) : null;
    if (!isReportableConcept(concept, ctx.viewer._id)) return null;

    const [baseModel, stylePreset, materialPreset, previewAsset] = await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
    ]);
    const kitVariant = await summarizeBaseModelWithHierarchy(ctx, baseModel);

    return {
      _id: concept._id,
      recordNumber: concept.recordNumber,
      title: concept.title,
      status: concept.status,
      visibility: concept.visibility,
      kitVariant,
      baseModel: kitVariant,
      stylePreset: stylePreset ? { _id: stylePreset._id, name: stylePreset.name } : null,
      materialPreset: materialPreset
        ? { _id: materialPreset._id, name: materialPreset.name }
        : null,
      previewAsset: previewAsset
        ? {
            _id: previewAsset._id,
            publicUrl: previewAsset.publicUrl,
            contentType: previewAsset.contentType,
          }
        : null,
    };
  },
});

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) return [];
    const reports = await ctx.db
      .query("feedbackReports")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();
    return await Promise.all(reports.map((report) => enrichReport(ctx, report)));
  },
});

export const listMinePaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  async handler(ctx, { paginationOpts }) {
    if (ctx.viewer === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("feedbackReports")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((report) => enrichReport(ctx, report))),
    };
  },
});

export const getMine = query({
  args: { feedbackId: v.string() },
  async handler(ctx, { feedbackId }) {
    if (ctx.viewer === null) return null;
    const normalizedId = ctx.db.normalizeId("feedbackReports", feedbackId);
    const report = normalizedId ? await ctx.db.get(normalizedId) : null;
    if (!report || report.userId !== ctx.viewer._id) return null;
    return await enrichReport(ctx, report, true);
  },
});

export const create = mutation({
  args: {
    category: vFeedbackCategory,
    title: v.optional(v.string()),
    message: v.string(),
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    conceptId: v.optional(v.id("concepts")),
    relatedAssetId: v.optional(v.id("assets")),
    sourcePage: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const viewer = ctx.viewerX();
    const normalizedTitle = args.title?.trim() || undefined;
    const normalizedMessage = args.message.trim();
    const requestedKitVariantId = args.kitVariantId ?? args.baseModelId;

    if (normalizedTitle && normalizedTitle.length < MIN_TITLE_LENGTH) {
      throw new Error(`Report titles must be at least ${MIN_TITLE_LENGTH} characters`);
    }
    if (normalizedTitle && normalizedTitle.length > MAX_TITLE_LENGTH) {
      throw new Error(`Report titles must be ${MAX_TITLE_LENGTH} characters or fewer`);
    }
    if (normalizedMessage.length < MIN_FEEDBACK_LENGTH) {
      throw new Error(`Feedback must be at least ${MIN_FEEDBACK_LENGTH} characters`);
    }
    if (normalizedMessage.length > MAX_FEEDBACK_LENGTH) {
      throw new Error(`Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer`);
    }

    const concept = args.conceptId ? await ctx.db.get(args.conceptId) : null;
    if (args.conceptId && !isReportableConcept(concept, viewer._id)) {
      throw new Error("This prototype is not available as report context");
    }
    const relatedAsset = args.relatedAssetId
      ? await ctx.db.get(args.relatedAssetId)
      : null;
    if (
      args.relatedAssetId &&
      (!relatedAsset || relatedAsset.userId !== viewer._id || relatedAsset.status !== "active")
    ) {
      throw new Error("This screenshot is not available to attach");
    }

    const recordNumber = await nextArchiveNumber(ctx, "feedback");
    const feedbackId = await ctx.db.insert("feedbackReports", {
      userId: viewer._id,
      recordNumber,
      category: args.category,
      status: "open",
      title: normalizedTitle,
      message: normalizedMessage,
      baseModelId: concept?.baseModelId ?? requestedKitVariantId,
      stylePresetId: concept?.stylePresetId ?? args.stylePresetId,
      conceptId: args.conceptId,
      relatedGenerationJobId: concept?.generationJobId,
      relatedAssetId: args.relatedAssetId ?? concept?.previewAssetId,
      sourcePage: args.sourcePage,
    });

    await ctx.db.insert("adminQueue", {
      itemType: "feedback",
      itemId: feedbackId,
      priority: feedbackPriority(args.category),
      status: "open",
      summary: buildFeedbackSummary(
        args.category,
        concept?.title,
        normalizedTitle ?? normalizedMessage
      ),
    });

    return { feedbackId, recordNumber };
  },
});

async function enrichReport(
  ctx: QueryCtx,
  report: Doc<"feedbackReports">,
  includeDetail = false
) {
  const [baseModel, stylePreset, concept, asset, queueItem] = await Promise.all([
    report.baseModelId ? ctx.db.get(report.baseModelId) : null,
    report.stylePresetId ? ctx.db.get(report.stylePresetId) : null,
    report.conceptId ? ctx.db.get(report.conceptId) : null,
    includeDetail && report.relatedAssetId ? ctx.db.get(report.relatedAssetId) : null,
    ctx.db
      .query("adminQueue")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect()
      .then((items) =>
        items.find(
          (item) => item.itemType === "feedback" && item.itemId === report._id
        )
      ),
  ]);
  const kitVariant = await summarizeBaseModelWithHierarchy(ctx, baseModel);

  return {
    _id: report._id,
    _creationTime: report._creationTime,
    recordNumber: report.recordNumber,
    category: report.category,
    status: report.status,
    title: report.title ?? legacyTitle(report.message),
    message: report.title ? report.message : legacyMessage(report.message),
    sourcePage: report.sourcePage,
    adminNotes: report.adminNotes,
    kitVariant,
    baseModel: kitVariant,
    stylePreset: stylePreset ? { _id: stylePreset._id, name: stylePreset.name } : null,
    concept: concept
      ? {
          _id: concept._id,
          recordNumber: concept.recordNumber,
          title: concept.title,
          status: concept.status,
        }
      : null,
    attachment: asset
      ? {
          _id: asset._id,
          publicUrl: asset.publicUrl,
          contentType: asset.contentType,
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
}

function legacyTitle(message: string) {
  const [firstLine] = message.split("\n");
  return firstLine.length <= MAX_TITLE_LENGTH ? firstLine : "Feedback report";
}

function legacyMessage(message: string) {
  const parts = message.split(/\n\s*\n/);
  return parts.length > 1 ? parts.slice(1).join("\n\n") : message;
}

function buildFeedbackSummary(category: string, conceptTitle: string | undefined, text: string) {
  const context = conceptTitle ? ` / ${conceptTitle}` : "";
  return `${category.toUpperCase()}${context} / ${text.slice(0, 96)}`;
}

function feedbackPriority(category: string) {
  if (category === "generation-quality") return 10;
  if (category === "missing-base-model" || category === "paint-mapping") return 20;
  if (category === "style-request") return 30;
  return 40;
}

function isReportableConcept(
  concept: Doc<"concepts"> | null,
  viewerId: Id<"users">
): concept is Doc<"concepts"> {
  if (!concept) return false;
  if (concept.userId === viewerId) return true;
  return (
    (concept.visibility === "public" || concept.visibility === "unlisted") &&
    (concept.status === "generated" || concept.status === "archived")
  );
}
