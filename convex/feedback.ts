import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { nextArchiveNumber } from "./archiveNumbers";
import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";
import { vFeedbackCategory, vFeedbackSource } from "./domain";
import { mutation, query } from "./functions";
import type { MutationCtx, QueryCtx } from "./types";

const MIN_FEEDBACK_LENGTH = 12;
const MAX_FEEDBACK_LENGTH = 500;
const MIN_TITLE_LENGTH = 4;
const MAX_TITLE_LENGTH = 80;

export const getContext = query({
  args: {
    conceptId: v.optional(v.string()),
    generationJobId: v.optional(v.string()),
  },
  async handler(ctx, { conceptId, generationJobId }) {
    if (ctx.viewer === null) return null;

    const normalizedGenerationJobId = generationJobId
      ? ctx.db.normalizeId("generationJobs", generationJobId)
      : null;
    const requestedGenerationJob = normalizedGenerationJobId
      ? await ctx.db.get(normalizedGenerationJobId)
      : null;
    if (generationJobId && (!requestedGenerationJob || requestedGenerationJob.userId !== ctx.viewer._id)) {
      return null;
    }

    const normalizedConceptId = conceptId
      ? ctx.db.normalizeId("concepts", conceptId)
      : requestedGenerationJob?.conceptId;
    const concept = normalizedConceptId ? await ctx.db.get(normalizedConceptId) : null;
    if (conceptId && !isReportableConcept(concept, ctx.viewer._id)) return null;
    if (!concept && !requestedGenerationJob) return null;

    const generationJob = requestedGenerationJob ?? (
      concept?.generationJobId ? await ctx.db.get(concept.generationJobId) : null
    );
    const baseModelId = concept?.baseModelId ?? generationJob?.baseModelId;
    const stylePresetId = concept?.stylePresetId ?? generationJob?.stylePresetId;
    const materialPresetId = concept?.materialPresetId ?? generationJob?.materialPresetId;

    const [baseModel, stylePreset, materialPreset, previewAsset] = await Promise.all([
      baseModelId ? ctx.db.get(baseModelId) : null,
      stylePresetId ? ctx.db.get(stylePresetId) : null,
      materialPresetId ? ctx.db.get(materialPresetId) : null,
      concept?.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
    ]);
    const kitVariant = await summarizeBaseModelWithHierarchy(ctx, baseModel);

    return {
      concept: concept
        ? {
            _id: concept._id,
            recordNumber: concept.recordNumber,
            title: concept.title,
            status: concept.status,
            visibility: concept.visibility,
          }
        : null,
      generationJob: generationJob
        ? {
            _id: generationJob._id,
            status: generationJob.status,
            provider: generationJob.provider,
          }
        : null,
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
    relatedGenerationJobId: v.optional(v.id("generationJobs")),
    relatedAssetId: v.optional(v.id("assets")),
    source: v.optional(vFeedbackSource),
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

    const requestedGenerationJob = args.relatedGenerationJobId
      ? await ctx.db.get(args.relatedGenerationJobId)
      : null;
    if (
      args.relatedGenerationJobId &&
      (!requestedGenerationJob || requestedGenerationJob.userId !== viewer._id)
    ) {
      throw new Error("This generation run is not available as report context");
    }
    const concept = args.conceptId
      ? await ctx.db.get(args.conceptId)
      : requestedGenerationJob?.conceptId
        ? await ctx.db.get(requestedGenerationJob.conceptId)
        : null;
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

    const generationJob = requestedGenerationJob ?? (
      concept?.generationJobId ? await ctx.db.get(concept.generationJobId) : null
    );
    const baseModelId = concept?.baseModelId ?? generationJob?.baseModelId ?? requestedKitVariantId;
    const stylePresetId = concept?.stylePresetId ?? generationJob?.stylePresetId ?? args.stylePresetId;
    const materialPresetId = concept?.materialPresetId ?? generationJob?.materialPresetId;
    const source = args.source ?? (generationJob
      ? "generation-result"
      : concept
        ? "prototype"
        : "standalone");
    const contextSnapshotJson = await buildContextSnapshot(ctx, {
      concept,
      generationJob,
      baseModelId,
      stylePresetId,
      materialPresetId,
    });
    const recordNumber = await nextArchiveNumber(ctx, "feedback");
    const feedbackId = await ctx.db.insert("feedbackReports", {
      userId: viewer._id,
      recordNumber,
      category: args.category,
      status: "open",
      priority: "normal",
      title: normalizedTitle,
      message: normalizedMessage,
      baseModelId,
      stylePresetId,
      materialPresetId,
      conceptId: concept?._id,
      relatedGenerationJobId: generationJob?._id,
      relatedAssetId: args.relatedAssetId ?? concept?.previewAssetId,
      source,
      sourcePage: args.sourcePage,
      contextSnapshotJson,
    });

    await ctx.db.insert("adminQueue", {
      itemType: "feedback",
      itemId: feedbackId,
      priority: 20,
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
  const [baseModel, stylePreset, materialPreset, concept, generationJob, asset, queueItem] = await Promise.all([
    report.baseModelId ? ctx.db.get(report.baseModelId) : null,
    report.stylePresetId ? ctx.db.get(report.stylePresetId) : null,
    report.materialPresetId ? ctx.db.get(report.materialPresetId) : null,
    report.conceptId ? ctx.db.get(report.conceptId) : null,
    report.relatedGenerationJobId ? ctx.db.get(report.relatedGenerationJobId) : null,
    includeDetail && report.relatedAssetId ? ctx.db.get(report.relatedAssetId) : null,
    ctx.db
      .query("adminQueue")
      .withIndex("by_itemType_itemId", (q) =>
        q.eq("itemType", "feedback").eq("itemId", report._id)
      )
      .unique(),
  ]);
  const kitVariant = await summarizeBaseModelWithHierarchy(ctx, baseModel);

  return {
    _id: report._id,
    _creationTime: report._creationTime,
    recordNumber: report.recordNumber,
    category: report.category,
    status: normalizeFeedbackStatus(report.status),
    priority: report.priority ?? priorityFromQueue(queueItem?.priority),
    title: report.title ?? legacyTitle(report.message),
    message: report.title ? report.message : legacyMessage(report.message),
    sourcePage: report.sourcePage,
    source: report.source ?? inferLegacySource(report),
    userResponse: report.userResponse,
    responseSentAt: report.responseSentAt,
    resolvedAt: report.resolvedAt,
    resolutionOutcome: report.resolutionOutcome,
    kitVariant,
    baseModel: kitVariant,
    stylePreset: stylePreset ? { _id: stylePreset._id, name: stylePreset.name } : null,
    materialPreset: materialPreset
      ? { _id: materialPreset._id, name: materialPreset.name }
      : null,
    concept: concept
      ? {
          _id: concept._id,
          recordNumber: concept.recordNumber,
          title: concept.title,
          status: concept.status,
        }
      : null,
    generationJob: generationJob
      ? {
          _id: generationJob._id,
          status: generationJob.status,
          provider: generationJob.provider,
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

function normalizeFeedbackStatus(status: string) {
  return status === "triaged" ? "reviewing" as const : status;
}

function priorityFromQueue(priority?: number) {
  if (priority === undefined) return "normal" as const;
  if (priority <= 10) return "high" as const;
  if (priority >= 30) return "low" as const;
  return "normal" as const;
}

function inferLegacySource(report: Doc<"feedbackReports">) {
  if (report.relatedGenerationJobId) return "generation-result" as const;
  if (report.conceptId) return "prototype" as const;
  return "standalone" as const;
}

async function buildContextSnapshot(
  ctx: MutationCtx,
  input: {
    concept: Doc<"concepts"> | null;
    generationJob: Doc<"generationJobs"> | null;
    baseModelId?: Id<"baseModels">;
    stylePresetId?: Id<"stylePresets">;
    materialPresetId?: Id<"materialPresets">;
  }
) {
  const [baseModel, stylePreset, materialPreset, composition] = await Promise.all([
    input.baseModelId ? ctx.db.get(input.baseModelId) : null,
    input.stylePresetId ? ctx.db.get(input.stylePresetId) : null,
    input.materialPresetId ? ctx.db.get(input.materialPresetId) : null,
    input.generationJob?.promptCompositionId
      ? ctx.db.get(input.generationJob.promptCompositionId)
      : null,
  ]);
  return JSON.stringify({
    capturedAt: Date.now(),
    prototype: input.concept
      ? {
          id: input.concept._id,
          recordNumber: input.concept.recordNumber,
          title: input.concept.title,
        }
      : null,
    kitVariant: baseModel?.name ?? null,
    styleDna: stylePreset?.name ?? null,
    material: materialPreset?.name ?? null,
    generation: input.generationJob
      ? {
          id: input.generationJob._id,
          provider: input.generationJob.provider ?? null,
          status: input.generationJob.status,
          inputSnapshotJson: input.generationJob.inputSnapshotJson ?? null,
        }
      : null,
    prompt: composition
      ? {
          compositionId: composition._id,
          templateId: composition.promptTemplateId ?? null,
          templateVersionId: composition.promptTemplateVersionId ?? null,
          composedPrompt: composition.composedPrompt,
          negativePrompt: composition.negativePrompt ?? null,
          inputSnapshotJson: composition.inputSnapshotJson,
        }
      : null,
  });
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
