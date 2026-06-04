import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getConceptEngagementSnapshot } from "./engagement";
import {
  vConceptStatus,
  vConceptVisibility,
  vMoodTag,
  vWeatheringLevel,
} from "./domain";
import { internalQuery, mutation, query } from "./functions";
import { QueryCtx } from "./types";

export const listMine = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", ctx.viewerX()._id).eq("status", "generated")
      )
      .order("desc")
      .collect();

    return concepts.map((concept) => ({
      _id: concept._id,
      title: concept.title,
      status: concept.status,
      visibility: concept.visibility,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      previewAssetId: concept.previewAssetId,
    }));
  },
});

export const listLibrary = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const conceptGroups = await Promise.all([
      ctx.db
        .query("concepts")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", ctx.viewerX()._id).eq("status", "draft")
        )
        .collect(),
      ctx.db
        .query("concepts")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", ctx.viewerX()._id).eq("status", "generated")
        )
        .collect(),
      ctx.db
        .query("concepts")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", ctx.viewerX()._id).eq("status", "archived")
        )
        .collect(),
    ]);

    const concepts = conceptGroups.flat().sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      concepts.map(async (concept) => {
        const [
          baseModel,
          stylePreset,
          materialPreset,
          generationJob,
          previewAsset,
          sourceConcept,
          remixCount,
        ] =
          await Promise.all([
            concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
            concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
            concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
            concept.generationJobId ? ctx.db.get(concept.generationJobId) : null,
            concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
            concept.sourceConceptId ? getConceptSourceSummary(ctx, concept.sourceConceptId) : null,
            ctx.db
              .query("concepts")
              .withIndex("by_sourceConceptId", (q) => q.eq("sourceConceptId", concept._id))
              .collect()
              .then((items) => items.length),
          ]);

        return {
          _id: concept._id,
          _creationTime: concept._creationTime,
          title: concept.title,
          notes: concept.notes,
          status: concept.status,
          visibility: concept.visibility,
          moodTags: concept.moodTags ?? [],
          weatheringLevel: concept.weatheringLevel,
          sourceConceptId: concept.sourceConceptId,
          baseModelId: concept.baseModelId,
          stylePresetId: concept.stylePresetId,
          materialPresetId: concept.materialPresetId,
          sourceConcept,
          remixCount,
          baseModel: baseModel
            ? {
                _id: baseModel._id,
                name: baseModel.name,
                slug: baseModel.slug,
                grade: baseModel.grade,
                series: baseModel.series,
              }
            : null,
          stylePreset: stylePreset
            ? {
                _id: stylePreset._id,
                name: stylePreset.name,
                slug: stylePreset.slug,
                category: stylePreset.category,
              }
            : null,
          materialPreset: materialPreset
            ? {
                _id: materialPreset._id,
                name: materialPreset.name,
                slug: materialPreset.slug,
                finishType: materialPreset.finishType,
              }
            : null,
              generationJob: generationJob
              ? {
                _id: generationJob._id,
                kind: generationJob.kind,
                renderMode: safeRenderMode(
                  generationJob.inputSnapshotJson,
                  generationJob.outputSummaryJson
                ),
                status: generationJob.status,
                provider: generationJob.provider,
                  requestedCredits: generationJob.requestedCredits,
                errorMessage: generationJob.errorMessage,
                outputAssetId: generationJob.outputAssetId,
                outputSummaryJson: generationJob.outputSummaryJson,
              }
            : null,
          previewAsset: previewAsset
            ? {
                _id: previewAsset._id,
                key: previewAsset.key,
                contentType: previewAsset.contentType,
                publicUrl: previewAsset.publicUrl,
                status: previewAsset.status,
              }
            : null,
        };
      })
    );
  },
});

export const listSavedPublicConcepts = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const saveInteractions = await ctx.db
      .query("conceptInteractions")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .collect()
      .then((items) => items.filter((item) => item.kind === "save"));

    const savedConcepts = await Promise.all(
      saveInteractions.map(async (interaction) => {
        const concept = await ctx.db.get(interaction.conceptId);
        if (
          concept === null ||
          concept.visibility !== "public" ||
          (concept.status !== "generated" && concept.status !== "archived")
        ) {
          return null;
        }

        const [
          baseModel,
          stylePreset,
          materialPreset,
          previewAsset,
          owner,
          engagement,
          remixCount,
        ] = await Promise.all([
          concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
          concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
          concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
          concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
          ctx.db.get(concept.userId),
          getConceptEngagementSnapshot(ctx, concept._id),
          ctx.db
            .query("concepts")
            .withIndex("by_sourceConceptId", (q) => q.eq("sourceConceptId", concept._id))
            .collect()
            .then(
              (items) =>
                items.filter(
                  (item) =>
                    item.visibility !== "private" &&
                    (item.status === "generated" || item.status === "archived")
                ).length
            ),
        ]);

        return {
          _id: concept._id,
          _creationTime: concept._creationTime,
          title: concept.title,
          status: concept.status,
          visibility: concept.visibility,
          weatheringLevel: concept.weatheringLevel,
          moodTags: concept.moodTags ?? [],
          owner: owner
            ? {
                handle: owner.handle,
                fullName: owner.fullName,
              }
            : null,
          baseModel: baseModel
            ? {
                name: baseModel.name,
                slug: baseModel.slug,
                grade: baseModel.grade,
              }
            : null,
          stylePreset: stylePreset
            ? {
                name: stylePreset.name,
                slug: stylePreset.slug,
                category: stylePreset.category,
              }
            : null,
          materialPreset: materialPreset
            ? {
                name: materialPreset.name,
                slug: materialPreset.slug,
                finishType: materialPreset.finishType,
              }
            : null,
          previewAsset: previewAsset
            ? {
                publicUrl: previewAsset.publicUrl,
                key: previewAsset.key,
                contentType: previewAsset.contentType,
              }
            : null,
          remixCount,
          engagement,
        };
      })
    );

    const seen = new Set<string>();
    return savedConcepts
      .filter((concept): concept is NonNullable<typeof concept> => concept !== null)
      .filter((concept) => {
        const key = concept._id.toString();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getViewerConceptPreviewAsset = internalQuery({
  args: {
    conceptId: v.id("concepts"),
    tokenIdentifier: v.string(),
  },
  async handler(ctx, { conceptId, tokenIdentifier }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (viewer === null) {
      return null;
    }

    const concept = await ctx.db.get(conceptId);
    if (concept === null || concept.userId !== viewer._id || concept.previewAssetId === undefined) {
      return null;
    }

    const previewAsset = await ctx.db.get(concept.previewAssetId);
    if (previewAsset === null) {
      return null;
    }

    return {
      conceptId: concept._id,
      conceptTitle: concept.title,
      assetId: previewAsset._id,
      key: previewAsset.key,
      publicUrl: previewAsset.publicUrl,
      visibility: concept.visibility,
      status: concept.status,
    };
  },
});

function safeRenderMode(inputSnapshotJson?: string, outputSummaryJson?: string) {
  for (const payload of [outputSummaryJson, inputSnapshotJson]) {
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as {
        renderMode?:
          | "hd-render"
          | "multi-angle-preview"
          | "high-fidelity-render"
          | "build-stage-visualization"
          | "weathering-simulation";
      };
      if (parsed.renderMode) {
        return parsed.renderMode;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

export const createDraft = mutation({
  args: {
    title: v.string(),
    baseModelId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: v.optional(vWeatheringLevel),
    notes: v.optional(v.string()),
  },
  async handler(
    ctx,
    { title, baseModelId, stylePresetId, materialPresetId, moodTags, weatheringLevel, notes }
  ) {
    const viewer = ctx.viewerX();
    const sanitizedMoodTags = Array.from(new Set(moodTags ?? []));
    return await ctx.db.insert("concepts", {
      userId: viewer._id,
      title,
      baseModelId,
      stylePresetId,
      materialPresetId,
      moodTags: sanitizedMoodTags,
      weatheringLevel: weatheringLevel ?? "clean",
      notes,
      status: "draft",
      visibility: "private",
      searchText: [title, notes ?? "", sanitizedMoodTags.join(" ")].join(" ").trim(),
    });
  },
});

export const update = mutation({
  args: {
    conceptId: v.id("concepts"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: v.optional(vWeatheringLevel),
    status: v.optional(vConceptStatus),
    visibility: v.optional(vConceptVisibility),
    previewAssetId: v.optional(v.id("assets")),
  },
  async handler(ctx, args) {
    const concept = await ctx.db.get(args.conceptId);
    if (concept === null) {
      throw new Error("Concept not found");
    }
    if (concept.userId !== ctx.viewerX()._id) {
      throw new Error("You can only update your own concepts");
    }
    if (
      args.visibility !== undefined &&
      args.visibility !== "private" &&
      concept.status !== "generated" &&
      concept.status !== "archived"
    ) {
      throw new Error("Only generated or archived concepts can be published to shared surfaces");
    }
    if (
      args.visibility !== undefined &&
      args.visibility !== "private" &&
      concept.previewAssetId === undefined
    ) {
      throw new Error("Publishable concepts require a stabilized preview asset first");
    }
    if (
      args.visibility !== undefined &&
      args.visibility !== "private" &&
      concept.previewAssetId !== undefined
    ) {
      const previewAsset = await ctx.db.get(concept.previewAssetId);
      if (previewAsset?.publicUrl === undefined) {
        throw new Error("Publishable concepts require a public preview URL before they can be shared");
      }
    }

    const nextTitle = args.title ?? concept.title;
    const nextNotes = args.notes ?? concept.notes;
    const nextMoodTags = args.moodTags ?? concept.moodTags ?? [];
    await ctx.db.patch(args.conceptId, {
      title: args.title,
      notes: args.notes,
      moodTags: args.moodTags,
      weatheringLevel: args.weatheringLevel,
      status: args.status,
      visibility: args.visibility,
      previewAssetId: args.previewAssetId,
      searchText: [nextTitle, nextNotes ?? "", nextMoodTags.join(" ")].join(" ").trim(),
    });
  },
});

async function getConceptSourceSummary(
  ctx: QueryCtx,
  conceptId: Id<"concepts">
) {
  const concept = await ctx.db.get(conceptId);
  if (concept === null) {
    return null;
  }

  const [baseModel, stylePreset, owner] = await Promise.all([
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    ctx.db.get(concept.userId),
  ]);

  return {
    _id: concept._id,
    title: concept.title,
    visibility: concept.visibility,
    status: concept.status,
    baseModel: baseModel
      ? {
          name: baseModel.name,
          slug: baseModel.slug,
        }
      : null,
    stylePreset: stylePreset
      ? {
          name: stylePreset.name,
          slug: stylePreset.slug,
        }
      : null,
    owner: owner
      ? {
          handle: owner.handle,
          fullName: owner.fullName,
        }
      : null,
  };
}
