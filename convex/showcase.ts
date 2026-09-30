import { v } from "convex/values";
import { hasIndexableStyle } from "./creativeContracts";
import { styleDisplayName, summarizeConceptStyle } from "./styleRefinements";
import {
  BaseModelWithHierarchy,
  summarizeBaseModelWithHierarchy,
} from "./baseModelHierarchy";
import { Doc, Id } from "./_generated/dataModel";
import { MoodTag } from "./domain";
import { getConceptEngagementCounts, getConceptEngagementSnapshot } from "./engagement";
import { getCreatorPackEngagementSnapshot } from "./packEngagement";
import { buildPaintPlan, readStoredPaintPlan } from "./paintMappingEngine";
import {
  visualPaletteFromLegacyPlan,
  visualPaletteSchema,
} from "./paintRecommendationEngine";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { query } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { QueryCtx } from "./types";
import { getPublishedRenditions } from "./publications";

type ShareableConcept = Doc<"concepts"> & {
  visibility: "public" | "unlisted";
  status: "generated" | "archived";
  activePublicationId: Id<"assetPublications">;
};

type ConceptEngagementSnapshot = {
  likeCount: number;
  saveCount: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
};

type ConceptShareCard = {
  _id: Id<"concepts">;
  _creationTime: number;
  title: string;
  visibility: "public" | "unlisted";
  status: "generated" | "archived";
  moodTags: MoodTag[];
  weatheringLevel: Doc<"concepts">["weatheringLevel"];
  owner: {
    handle: string;
    fullName: string;
  } | null;
  baseModel: BaseModelWithHierarchy | null;
  stylePreset: {
    name: string;
    slug: string;
    category?: string;
    isFeaturedStyle?: boolean;
  } | null;
  materialPreset: {
    name: string;
    slug: string;
    finishType: string;
  } | null;
  previewAsset: {
    publicUrl?: string;
    thumbnailUrl?: string;
    masterUrl?: string;
    key: string;
    contentType?: string;
  } | null;
  remixCount: number;
  engagement: ConceptEngagementSnapshot;
};

export const listPublicConcepts = query({
  args: {},
  async handler(ctx) {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();

    const generatedConcepts = concepts
      .filter(isPublicConcept)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 24);

    return await Promise.all(
      generatedConcepts.map(async (concept) => {
        const [baseModel, stylePreset, materialPreset, publishedAssets, owner, remixCount, engagement] =
          await Promise.all([
            concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
            concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
            concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
            getPublishedRenditions(ctx, concept),
            ctx.db.get(concept.userId),
            countShareableRemixes(ctx, concept._id),
            getConceptEngagementSnapshot(ctx, concept._id),
          ]);

        return {
          _id: concept._id,
          _creationTime: concept._creationTime,
          title: concept.title,
          visibility: concept.visibility,
          status: concept.status,
          moodTags: concept.moodTags ?? [],
          weatheringLevel: concept.weatheringLevel,
          owner: owner
            ? {
                handle: owner.handle,
                fullName: owner.fullName,
              }
            : null,
          baseModel: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
          stylePreset: summarizeConceptStyle(stylePreset, concept.styleIntentJson),
          materialPreset: materialPreset
            ? {
                name: materialPreset.name,
                slug: materialPreset.slug,
                finishType: materialPreset.finishType,
              }
            : null,
          previewAsset: publishedAssets?.preview
            ? {
                publicUrl: publishedAssets.preview.publicUrl,
                thumbnailUrl: publishedAssets.thumbnail?.publicUrl,
                masterUrl: publishedAssets.master?.publicUrl,
                key: publishedAssets.preview.key,
                contentType: publishedAssets.preview.contentType,
              }
            : null,
          remixCount,
          engagement,
        };
      })
    );
  },
});

export const listPublicConceptsForSitemap = query({
  args: {},
  async handler(ctx) {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();

    return concepts
      .filter(isPublicConcept)
      .filter(hasIndexableStyle)
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((concept) => ({
        _id: concept._id,
        _creationTime: concept._creationTime,
      }));
  },
});

export const listPublicProfilesForSitemap = query({
  args: {},
  async handler(ctx) {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();
    const conceptsByUser = new Map<Id<"users">, Doc<"concepts">[]>();
    for (const concept of concepts) {
      if (!isPublicConcept(concept)) continue;
      const group = conceptsByUser.get(concept.userId) ?? [];
      group.push(concept);
      conceptsByUser.set(concept.userId, group);
    }

    const publicProfiles = await Promise.all(
      [...conceptsByUser.entries()].map(async ([userId, publicConcepts]) => {
        const user = await ctx.db.get(userId);
        if (user === null || publicConcepts.length === 0) return null;
        return {
          handle: user.handle,
          lastModified: publicConcepts.reduce(
            (latest, concept) => Math.max(latest, concept._creationTime),
            0,
          ),
        };
      }),
    );

    return publicProfiles
      .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
      .sort((left, right) => left.handle.localeCompare(right.handle));
  },
});

export const listCreatorHubsForSitemap = query({
  args: {},
  async handler(ctx) {
    const [concepts, creatorPacks, stylePresets] = await Promise.all([
      ctx.db.query("concepts").withIndex("by_visibility", (q) => q.eq("visibility", "public")).collect(),
      ctx.db.query("creatorPacks").collect(),
      ctx.db.query("stylePresets").collect(),
    ]);
    const conceptsByUser = new Map<Id<"users">, Doc<"concepts">[]>();
    for (const concept of concepts) {
      if (!isPublicConcept(concept)) continue;
      const group = conceptsByUser.get(concept.userId) ?? [];
      group.push(concept);
      conceptsByUser.set(concept.userId, group);
    }
    const packsByUser = new Map<Id<"users">, Doc<"creatorPacks">[]>();
    for (const pack of creatorPacks) {
      if (!pack.isActive) continue;
      const group = packsByUser.get(pack.creatorUserId) ?? [];
      group.push(pack);
      packsByUser.set(pack.creatorUserId, group);
    }
    const styleCounts = new Map<Id<"users">, number>();
    for (const preset of stylePresets) {
      if (!preset.creatorUserId || !preset.isActive) continue;
      styleCounts.set(preset.creatorUserId, (styleCounts.get(preset.creatorUserId) ?? 0) + 1);
    }
    const userIds = new Set<Id<"users">>([
      ...conceptsByUser.keys(),
      ...packsByUser.keys(),
      ...styleCounts.keys(),
    ]);
    const publicHubs = await Promise.all(
      [...userIds].map(async (userId) => {
        const publicConcepts = conceptsByUser.get(userId) ?? [];
        const packs = packsByUser.get(userId) ?? [];
        const styleCount = styleCounts.get(userId) ?? 0;
        if (publicConcepts.length === 0 && packs.length === 0 && styleCount === 0) return null;
        const user = await ctx.db.get(userId);
        if (user === null) return null;
        return {
          handle: user.handle,
          lastModified: Math.max(
            ...publicConcepts.map((concept) => concept._creationTime),
            ...packs.map((pack) => pack._creationTime),
            user._creationTime,
          ),
        };
      }),
    );

    return publicHubs
      .filter((hub): hub is NonNullable<typeof hub> => hub !== null)
      .sort((left, right) => left.handle.localeCompare(right.handle));
  },
});

export const listRankedPublicCreators = query({
  args: {},
  async handler(ctx) {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();
    const conceptsByUser = new Map<Id<"users">, Doc<"concepts">[]>();
    for (const concept of concepts) {
      if (!isPublicConcept(concept)) continue;
      const group = conceptsByUser.get(concept.userId) ?? [];
      group.push(concept);
      conceptsByUser.set(concept.userId, group);
    }

    const creatorRows = await Promise.all(
      [...conceptsByUser.entries()].map(async ([userId, publicConcepts]) => {
        const user = await ctx.db.get(userId);
        if (user === null) return null;

        const counted = await Promise.all(publicConcepts.map(async (concept) => {
          const [engagement, remixCount] = await Promise.all([
            getConceptEngagementCounts(ctx, concept._id),
            countShareableRemixes(ctx, concept._id),
          ]);
          return {
            likes: engagement.likeCount,
            saves: engagement.saveCount,
            remixes: remixCount,
          };
        }));
        const totals = {
          publicConcepts: publicConcepts.length,
          likes: counted.reduce((sum, concept) => sum + concept.likes, 0),
          saves: counted.reduce((sum, concept) => sum + concept.saves, 0),
          remixes: counted.reduce((sum, concept) => sum + concept.remixes, 0),
        };
        const newest = [...publicConcepts].sort((a, b) => b._creationTime - a._creationTime)[0];

        const score =
          (user.isFeaturedCreator ? 120 : 0) +
          (user.isVerifiedCreator ? 80 : 0) +
          totals.remixes * 20 +
          totals.saves * 12 +
          totals.likes * 6 +
          totals.publicConcepts * 10;

        return {
          _id: user._id,
          handle: user.handle,
          fullName: user.fullName,
          pictureUrl: user.pictureUrl,
          isVerifiedCreator: user.isVerifiedCreator ?? false,
          isFeaturedCreator: user.isFeaturedCreator ?? false,
          creatorTagline: user.creatorTagline,
          creatorSpecialties: user.creatorSpecialties ?? [],
          totals,
          leadConcept: newest ? await getConceptShareCard(ctx, newest._id) : null,
          score,
        };
      })
    );

    return creatorRows
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => right.score - left.score || right.totals.remixes - left.totals.remixes)
      .slice(0, 8);
  },
});

export const getSharedConcept = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    const concept = await ctx.db.get(conceptId);
    if (!isShareableConcept(concept)) {
      return null;
    }

    const storedPlan = readStoredPaintPlan(concept.palettePlanJson, concept._id, concept.title);
    const [
      baseModel,
      stylePreset,
      materialPreset,
      publishedAssets,
      owner,
      colorRoles,
      paintMappings,
      sourceConcept,
      shareableRemixes,
      engagement,
      lineage,
    ] = await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      getPublishedRenditions(ctx, concept),
      ctx.db.get(concept.userId),
      storedPlan ? [] : ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      storedPlan ? [] : listResolvedPaintMappings(ctx),
      concept.sourceConceptId ? getConceptShareCard(ctx, concept.sourceConceptId) : Promise.resolve(null),
      loadShareableRemixes(ctx, concept._id, 6),
      getConceptEngagementSnapshot(ctx, concept._id),
      getLineageChain(ctx, concept._id),
    ]);

    const paintPlan = storedPlan ?? buildPaintPlan({
      approvedPlanJson: concept.palettePlanJson,
      conceptId: concept._id,
      conceptTitle: concept.title,
      baseModelName: baseModel?.name,
      stylePresetName: styleDisplayName(stylePreset, concept.styleIntentJson) ?? undefined,
      styleSlug: stylePreset?.slug,
      materialPresetName: materialPreset?.name,
      materialSlug: materialPreset?.slug,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      colorRoles,
      paintMappings,
    });

    return {
      indexable: concept.visibility === "public" && hasIndexableStyle(concept) && Boolean(publishedAssets?.preview?.publicUrl) && Boolean(stylePreset?.isActive),
      visualPalette: publicVisualPalette(concept),
      _id: concept._id,
      _creationTime: concept._creationTime,
      recordNumber: concept.recordNumber,
      title: concept.title,
      notes: concept.notes,
      visibility: concept.visibility,
      status: concept.status,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      owner: owner
        ? {
            handle: owner.handle,
            fullName: owner.fullName,
          }
        : null,
      baseModel: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
      stylePreset: summarizeConceptStyle(
        stylePreset
          ? {
              name: stylePreset.name,
              slug: stylePreset.slug,
              category: stylePreset.category,
              shortDescription: stylePreset.shortDescription,
              isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
            }
          : null,
        concept.styleIntentJson,
      ),
      materialPreset: materialPreset
        ? {
            name: materialPreset.name,
            slug: materialPreset.slug,
            finishType: materialPreset.finishType,
          }
        : null,
      previewAsset: publishedAssets?.preview
        ? {
            publicUrl: publishedAssets.preview.publicUrl,
            thumbnailUrl: publishedAssets.thumbnail?.publicUrl,
            masterUrl: publishedAssets.master?.publicUrl,
            key: publishedAssets.preview.key,
            contentType: publishedAssets.preview.contentType,
          }
        : null,
      sourceConcept,
      lineage,
      remixes: shareableRemixes.remixes,
      remixCount: shareableRemixes.count,
      engagement,
      paintPlan,
    };
  },
});

export const getRemixSeed = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    const concept = await ctx.db.get(conceptId);
    if (!isShareableConcept(concept)) {
      return null;
    }

    const [baseModel, stylePreset, materialPreset, owner] = await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      ctx.db.get(concept.userId),
    ]);

    if (baseModel === null || stylePreset === null || materialPreset === null) {
      return null;
    }

    return {
      _id: concept._id,
      title: concept.title,
      notes: concept.notes,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      visibility: concept.visibility,
      kitVariantId: baseModel._id,
      baseModelId: baseModel._id,
      stylePresetId: stylePreset._id,
      materialPresetId: materialPreset._id,
      kitVariant: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
      baseModel: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
      stylePreset: {
        name: stylePreset.name,
        slug: stylePreset.slug,
        isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
      },
      materialPreset: {
        name: materialPreset.name,
        slug: materialPreset.slug,
      },
      owner: owner
        ? {
            handle: owner.handle,
            fullName: owner.fullName,
          }
        : null,
    };
  },
});

export const getPublicProfile = query({
  args: {
    handle: v.string(),
  },
  async handler(ctx, { handle }) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    if (user === null) {
      return null;
    }

    const [
      publishedConcepts,
      interactions,
      creatorStylePresets,
      creatorPacks,
      publicConceptCorpus,
    ] =
      await Promise.all([
      ctx.db
        .query("concepts")
        .withIndex("by_user_visibility", (q) => q.eq("userId", user._id).eq("visibility", "public"))
        .collect()
        .then((items) =>
          items
            .filter(isPublicConcept)
            .sort((a, b) => b._creationTime - a._creationTime)
        ),
      ctx.db
        .query("conceptInteractions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("stylePresets")
        .collect()
        .then((items) =>
          items
            .filter((preset) => preset.creatorUserId === user._id && preset.isActive)
            .sort((a, b) => a.name.localeCompare(b.name))
        ),
      ctx.db
        .query("creatorPacks")
        .withIndex("by_creatorUserId", (q) => q.eq("creatorUserId", user._id))
        .collect()
        .then((items) =>
          items
            .filter((pack) => pack.isActive)
            .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
        ),
      ctx.db
        .query("concepts")
        .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
        .collect()
        .then((items) =>
          items.filter(isPublicConcept)
        ),
    ]);
    const savedInteractions = interactions.filter((item) => item.kind === "save");
    const likeInteractions = interactions.filter((item) => item.kind === "like");

    const savedConcepts = await Promise.all(
      savedInteractions.map(async (interaction) => {
        const concept = await ctx.db.get(interaction.conceptId);
        if (!isPublicConcept(concept)) {
          return null;
        }
        return concept;
      })
    ).then((items) =>
      items
        .filter((concept): concept is NonNullable<typeof concept> => concept !== null)
        .sort((a, b) => b._creationTime - a._creationTime)
    );

    const likedConcepts = await Promise.all(
      likeInteractions.map(async (interaction) => {
        const concept = await ctx.db.get(interaction.conceptId);
        if (!isPublicConcept(concept)) {
          return null;
        }
        return concept;
      })
    ).then((items) =>
      items
        .filter((concept): concept is NonNullable<typeof concept> => concept !== null)
        .sort((a, b) => b._creationTime - a._creationTime)
    );

    const [publishedCards, savedCards, likedCards] = await Promise.all([
      Promise.all(publishedConcepts.map((concept) => getConceptShareCard(ctx, concept._id))),
      Promise.all(savedConcepts.map((concept) => getConceptShareCard(ctx, concept._id))),
      Promise.all(likedConcepts.map((concept) => getConceptShareCard(ctx, concept._id))),
    ]);

    const published = publishedCards.filter(
      (concept): concept is NonNullable<typeof concept> => concept !== null
    );
    const saved = dedupeShareCards(
      savedCards.filter((concept): concept is NonNullable<typeof concept> => concept !== null)
    );
    const liked = dedupeShareCards(
      likedCards.filter((concept): concept is NonNullable<typeof concept> => concept !== null)
    );
    const publishedIds = new Set(published.map((concept) => concept._id));
    const savedOnly = saved.filter((concept) => !publishedIds.has(concept._id));
    const likedOnly = liked.filter((concept) => !publishedIds.has(concept._id));
    const styleCollection: Array<{
      _id: Id<"stylePresets">;
      name: string;
      slug: string;
      category?: string;
      shortDescription?: string;
      isFeaturedStyle: boolean;
      creatorConceptCount: number;
      communityConceptCount: number;
      hasLeadBaseModel: boolean;
      leadBaseModel: {
        slug: string;
        name: string;
        conceptCount: number;
      };
    }> = creatorStylePresets
      .map((stylePreset) => {
        const creatorConcepts = published.filter(
          (concept) => concept.stylePreset?.slug === stylePreset.slug
        );
        const communityConceptCount = publicConceptCorpus.filter(
          (concept) => concept.stylePresetId === stylePreset._id
        ).length;
        const baseModelUsage = new Map<
          string,
          {
            slug: string;
            name: string;
            conceptCount: number;
          }
        >();

        for (const concept of creatorConcepts) {
          if (!concept.baseModel?.slug || !concept.baseModel?.name) {
            continue;
          }
          const current = baseModelUsage.get(concept.baseModel.slug);
          if (current) {
            current.conceptCount += 1;
          } else {
            baseModelUsage.set(concept.baseModel.slug, {
              slug: concept.baseModel.slug,
              name: concept.baseModel.name,
              conceptCount: 1,
            });
          }
        }

        const leadBaseModel =
          Array.from(baseModelUsage.values()).sort(
            (left, right) => right.conceptCount - left.conceptCount || left.name.localeCompare(right.name)
          )[0] ?? null;

        return {
          _id: stylePreset._id,
          name: stylePreset.name,
          slug: stylePreset.slug,
          category: stylePreset.category,
          shortDescription: stylePreset.shortDescription,
          isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
          creatorConceptCount: creatorConcepts.length,
          communityConceptCount,
          hasLeadBaseModel: leadBaseModel !== null,
          leadBaseModel: leadBaseModel ?? {
            slug: "",
            name: "Not established yet",
            conceptCount: 0,
          },
        };
      })
      .sort(
        (left, right) =>
          Number(right.isFeaturedStyle) - Number(left.isFeaturedStyle) ||
          right.communityConceptCount - left.communityConceptCount ||
          right.creatorConceptCount - left.creatorConceptCount ||
          left.name.localeCompare(right.name)
      );
    const creatorPackCollection = await Promise.all(
      creatorPacks.map(async (pack) => {
        const [creator, styles, baseModels, materials, engagement] = await Promise.all([
          ctx.db.get(pack.creatorUserId),
          Promise.all(pack.stylePresetIds.map((stylePresetId) => ctx.db.get(stylePresetId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          Promise.all(pack.baseModelIds.map((baseModelId) => ctx.db.get(baseModelId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          Promise.all(pack.materialPresetIds.map((materialPresetId) => ctx.db.get(materialPresetId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          getCreatorPackEngagementSnapshot(ctx, pack._id),
        ]);

        const publicConcepts = publicConceptCorpus.filter((concept) =>
          concept.stylePresetId !== undefined &&
          pack.stylePresetIds.includes(concept.stylePresetId),
        );

        const previewConcept = await Promise.all(
          publicConcepts
            .sort((a, b) => b._creationTime - a._creationTime)
            .slice(0, 1)
            .map((concept) => getConceptShareCard(ctx, concept._id))
        ).then((items) => items.find((item): item is ConceptShareCard => item !== null) ?? null);

        return {
          _id: pack._id,
          _creationTime: pack._creationTime,
          name: pack.name,
          slug: pack.slug,
          description: pack.description,
          tagline: pack.tagline,
          packType: pack.packType,
          isFeatured: pack.isFeatured,
          engagement,
          creator: creator
            ? {
                handle: creator.handle,
                fullName: creator.fullName,
              }
            : null,
          stats: {
            styleCount: styles.length,
            baseModelCount: baseModels.length,
            materialCount: materials.length,
            publicConceptCount: publicConcepts.length,
            publicRemixCount: previewConcept?.remixCount ?? 0,
            publicLikeCount: previewConcept?.engagement.likeCount ?? 0,
            publicSaveCount: previewConcept?.engagement.saveCount ?? 0,
          },
          previewConcept,
        };
      })
    );

    const remixHistory = await Promise.all(
      published.map(async (concept) => {
        const remixes = await loadShareableRemixes(ctx, concept._id, 4);
        return {
          conceptId: concept._id,
          conceptTitle: concept.title,
          remixCount: remixes.count,
          remixes: remixes.remixes,
        };
      })
    ).then((items) =>
      items
        .filter((item) => item.remixCount > 0)
        .sort((a, b) => b.remixCount - a.remixCount || a.conceptTitle.localeCompare(b.conceptTitle))
        .slice(0, 8)
    );

    const activityFeed = [
      ...published.slice(0, 12).map((concept) => ({
        type: "published" as const,
        timestamp: concept._creationTime,
        concept,
      })),
      ...savedOnly.slice(0, 12).map((concept) => ({
        type: "saved" as const,
        timestamp: concept._creationTime,
        concept,
      })),
      ...likedOnly.slice(0, 12).map((concept) => ({
        type: "liked" as const,
        timestamp: concept._creationTime,
        concept,
      })),
    ]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 12);

    const totals = published.reduce(
      (accumulator, concept) => {
        accumulator.publicConcepts += 1;
        accumulator.likes += concept.engagement.likeCount;
        accumulator.saves += concept.engagement.saveCount;
        accumulator.remixes += concept.remixCount;
        return accumulator;
      },
      {
        publicConcepts: 0,
        likes: 0,
        saves: 0,
        remixes: 0,
      }
    );

    return {
      pilot: {
        _id: user._id,
        handle: user.handle,
        fullName: user.fullName,
        pictureUrl: user.pictureUrl,
        isVerifiedCreator: user.isVerifiedCreator ?? false,
        isFeaturedCreator: user.isFeaturedCreator ?? false,
        creatorTagline: user.creatorTagline,
        creatorSpecialties: user.creatorSpecialties ?? [],
      },
      totals,
      published,
      saved: savedOnly,
      liked: likedOnly,
      styleCollection,
      creatorPackCollection,
      remixHistory,
      activityFeed,
    };
  },
});

export const getSeoLandingPage = query({
  args: {
    baseModelSlug: v.string(),
    stylePresetSlug: v.string(),
  },
  async handler(ctx, { baseModelSlug, stylePresetSlug }) {
    const [baseModel, stylePreset, publicConcepts, colorRoles, paintMappings] = await Promise.all([
      ctx.db
        .query("baseModels")
        .withIndex("by_slug", (q) => q.eq("slug", baseModelSlug))
        .unique(),
      ctx.db
        .query("stylePresets")
        .withIndex("by_slug", (q) => q.eq("slug", stylePresetSlug))
        .unique(),
      ctx.db
        .query("concepts")
        .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
        .collect(),
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      listResolvedPaintMappings(ctx),
    ]);

    if (
      baseModel === null ||
      stylePreset === null ||
      !isPublicModelCatalogRecord(baseModel) ||
      !stylePreset.isActive
    ) {
      return null;
    }

    const matchingConcepts = publicConcepts
      .filter(
        (concept) =>
          concept.baseModelId === baseModel._id &&
          concept.stylePresetId === stylePreset._id &&
          hasIndexableStyle(concept) && isPublicConcept(concept)
      )
      .sort((a, b) => b._creationTime - a._creationTime);

    const conceptCards = await Promise.all(
      matchingConcepts.slice(0, 12).map((concept) => getConceptShareCard(ctx, concept._id))
    ).then((items) => items.filter((item): item is ConceptShareCard => item !== null));

    if (conceptCards.length === 0) {
      return null;
    }

    const featuredConcept = conceptCards[0];
    const aggregate = conceptCards.reduce(
      (accumulator, concept) => {
        accumulator.likes += concept.engagement.likeCount;
        accumulator.saves += concept.engagement.saveCount;
        accumulator.remixes += concept.remixCount;
        return accumulator;
      },
      {
        likes: 0,
        saves: 0,
        remixes: 0,
      }
    );

    const paintPlan =
      featuredConcept === null
        ? null
        : buildPaintPlan({
      approvedPlanJson: (await ctx.db.get(featuredConcept._id))?.palettePlanJson,
            conceptId: featuredConcept._id,
            conceptTitle: featuredConcept.title,
            baseModelName: baseModel.name,
            stylePresetName: stylePreset.name,
            styleSlug: stylePreset.slug,
            materialPresetName: featuredConcept.materialPreset?.name,
            materialSlug: featuredConcept.materialPreset?.slug,
            moodTags: featuredConcept.moodTags,
            weatheringLevel: featuredConcept.weatheringLevel,
            colorRoles,
            paintMappings,
          });

    return {
      baseModel: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
      stylePreset: {
        _id: stylePreset._id,
        name: stylePreset.name,
        slug: stylePreset.slug,
        category: stylePreset.category,
        shortDescription: stylePreset.shortDescription,
        contrastLevel: stylePreset.contrastLevel,
        weatheringProfile: stylePreset.weatheringProfile,
        seoKeywords: stylePreset.seoKeywords,
        isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
      },
      featuredConcept,
      concepts: conceptCards,
      conceptCount: matchingConcepts.length,
      aggregate,
      paintPlan,
    };
  },
});

export const getCreatorPackBySlug = query({
  args: {
    slug: v.string(),
  },
  async handler(ctx, { slug }) {
    const creatorPack = await ctx.db
      .query("creatorPacks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (creatorPack === null || !creatorPack.isActive) {
      return null;
    }

    const [creator, stylePresets, baseModels, materialPresets, engagement] = await Promise.all([
      ctx.db.get(creatorPack.creatorUserId),
      Promise.all(creatorPack.stylePresetIds.map((stylePresetId) => ctx.db.get(stylePresetId))).then((items) =>
        items.filter((item): item is NonNullable<typeof item> => item !== null)
      ),
      Promise.all(creatorPack.baseModelIds.map((baseModelId) => ctx.db.get(baseModelId))).then((items) =>
        items.filter((item): item is NonNullable<typeof item> => item !== null)
      ),
      Promise.all(creatorPack.materialPresetIds.map((materialPresetId) => ctx.db.get(materialPresetId))).then((items) =>
        items.filter((item): item is NonNullable<typeof item> => item !== null)
      ),
      getCreatorPackEngagementSnapshot(ctx, creatorPack._id),
    ]);

    if (creator === null) {
      return null;
    }

    const publicConcepts = await ctx.db
      .query("concepts")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect()
      .then((items) =>
        items.filter(
          (concept) =>
            isPublicConcept(concept) &&
            creatorPack.stylePresetIds.includes(concept.stylePresetId as Id<"stylePresets">)
        )
      );

    const conceptCards = await Promise.all(
      publicConcepts
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 8)
        .map((concept) => getConceptShareCard(ctx, concept._id))
    ).then((items) => items.filter((item): item is ConceptShareCard => item !== null));
    const analytics = conceptCards.reduce(
      (accumulator, concept) => {
        accumulator.publicConceptCount += 1;
        accumulator.publicRemixCount += concept.remixCount;
        accumulator.publicLikeCount += concept.engagement.likeCount;
        accumulator.publicSaveCount += concept.engagement.saveCount;
        return accumulator;
      },
      {
        publicConceptCount: 0,
        publicRemixCount: 0,
        publicLikeCount: 0,
        publicSaveCount: 0,
      }
    );

    return {
      _id: creatorPack._id,
      name: creatorPack.name,
      slug: creatorPack.slug,
      description: creatorPack.description,
      tagline: creatorPack.tagline,
      packType: creatorPack.packType,
      isFeatured: creatorPack.isFeatured,
      engagement,
      analytics: {
        ...analytics,
        featuredStyleCount: stylePresets.filter((stylePreset) => stylePreset.isFeaturedStyle).length,
      },
      creator: {
        handle: creator.handle,
        fullName: creator.fullName,
        pictureUrl: creator.pictureUrl,
      },
      styles: stylePresets.map((stylePreset) => ({
        _id: stylePreset._id,
        name: stylePreset.name,
        slug: stylePreset.slug,
        category: stylePreset.category,
        shortDescription: stylePreset.shortDescription,
        isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
      })),
      baseModels: await Promise.all(
        baseModels
          .filter(isPublicModelCatalogRecord)
          .map((baseModel) => summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }))
      ).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null)),
      materials: materialPresets.map((materialPreset) => ({
        _id: materialPreset._id,
        name: materialPreset.name,
        slug: materialPreset.slug,
        finishType: materialPreset.finishType,
      })),
      concepts: conceptCards,
    };
  },
});

export const listPublicCreatorPacks = query({
  args: {},
  async handler(ctx) {
    const [creatorPacks, publicConcepts] = await Promise.all([
      ctx.db.query("creatorPacks").collect(),
      ctx.db.query("concepts").withIndex("by_visibility", (q) => q.eq("visibility", "public")).collect(),
    ]);
    const activePacks = creatorPacks
      .filter((pack) => pack.isActive)
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a._creationTime - b._creationTime)
      .slice(0, 12);
    const shareableConcepts = publicConcepts.filter(isPublicConcept);

    return await Promise.all(
      activePacks.map(async (pack) => {
        const [creator, styles, baseModels, materials, engagement] = await Promise.all([
          ctx.db.get(pack.creatorUserId),
          Promise.all(pack.stylePresetIds.map((stylePresetId) => ctx.db.get(stylePresetId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          Promise.all(pack.baseModelIds.map((baseModelId) => ctx.db.get(baseModelId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          Promise.all(pack.materialPresetIds.map((materialPresetId) => ctx.db.get(materialPresetId))).then((items) =>
            items.filter((item): item is NonNullable<typeof item> => item !== null)
          ),
          getCreatorPackEngagementSnapshot(ctx, pack._id),
        ]);

        const matchingConcepts = shareableConcepts.filter((concept) =>
          concept.stylePresetId !== undefined &&
          pack.stylePresetIds.includes(concept.stylePresetId),
        );

        const conceptCards = await Promise.all(
          [...matchingConcepts]
            .sort((a, b) => b._creationTime - a._creationTime)
            .slice(0, 1)
            .map((concept) => getConceptShareCard(ctx, concept._id))
        ).then((items) => items.filter((item): item is ConceptShareCard => item !== null));

        return {
          _id: pack._id,
          _creationTime: pack._creationTime,
          name: pack.name,
          slug: pack.slug,
          description: pack.description,
          tagline: pack.tagline,
          packType: pack.packType,
          isFeatured: pack.isFeatured,
          engagement,
          creator: creator
            ? {
                handle: creator.handle,
                fullName: creator.fullName,
              }
            : null,
          stats: {
            styleCount: styles.length,
            baseModelCount: baseModels.length,
            materialCount: materials.length,
            publicConceptCount: matchingConcepts.length,
            publicRemixCount: matchingConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.remixCount, 0),
            publicLikeCount: matchingConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.engagement.likeCount, 0),
            publicSaveCount: matchingConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.engagement.saveCount, 0),
          },
          previewConcept: conceptCards[0] ?? null,
        };
      })
    );
  },
});

export const listSeoLandingPagesForSitemap = query({
  args: {},
  async handler(ctx) {
    const [baseModels, stylePresets, publicConcepts] = await Promise.all([
      ctx.db.query("baseModels").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db
        .query("concepts")
        .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
        .collect(),
    ]);

    const activeBaseModels = new Map(
      baseModels.filter(isPublicModelCatalogRecord).map((model) => [model._id, model])
    );
    const activeStyles = new Map(
      stylePresets.filter((preset) => preset.isActive).map((preset) => [preset._id, preset])
    );

    const pages = new Map<
      string,
      {
        baseModelSlug: string;
        stylePresetSlug: string;
        lastModified: number;
      }
    >();

    for (const concept of publicConcepts) {
      if (
        concept.status !== "generated" &&
        concept.status !== "archived"
      ) {
        continue;
      }
      if (!concept.baseModelId || !concept.stylePresetId) {
        continue;
      }
      const baseModel = activeBaseModels.get(concept.baseModelId);
      const stylePreset = activeStyles.get(concept.stylePresetId);
      if (!baseModel || !stylePreset) {
        continue;
      }

      const key = `${baseModel.slug}/${stylePreset.slug}`;
      const current = pages.get(key);
      if (!current || concept._creationTime > current.lastModified) {
        pages.set(key, {
          baseModelSlug: baseModel.slug,
          stylePresetSlug: stylePreset.slug,
          lastModified: concept._creationTime,
        });
      }
    }

    return Array.from(pages.values()).sort((left, right) =>
      left.baseModelSlug === right.baseModelSlug
        ? left.stylePresetSlug.localeCompare(right.stylePresetSlug)
        : left.baseModelSlug.localeCompare(right.baseModelSlug)
    );
  },
});

export const listCreatorPacksForSitemap = query({
  args: {},
  async handler(ctx) {
    const creatorPacks = await ctx.db.query("creatorPacks").collect();

    return creatorPacks
      .filter((pack) => pack.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pack) => ({
        slug: pack.slug,
        lastModified: pack._creationTime,
      }));
  },
});

async function shareableRemixDocuments(ctx: QueryCtx, sourceConceptId: Id<"concepts">) {
  const concepts = await ctx.db
    .query("concepts")
    .withIndex("by_sourceConceptId", (q) => q.eq("sourceConceptId", sourceConceptId))
    .collect();
  return concepts
    .filter((concept) => isShareableConcept(concept))
    .sort((a, b) => b._creationTime - a._creationTime);
}

async function countShareableRemixes(ctx: QueryCtx, sourceConceptId: Id<"concepts">) {
  return (await shareableRemixDocuments(ctx, sourceConceptId)).length;
}

async function loadShareableRemixes(
  ctx: QueryCtx,
  sourceConceptId: Id<"concepts">,
  limit: number,
) {
  const shareableConcepts = await shareableRemixDocuments(ctx, sourceConceptId);
  const remixes = await Promise.all(
    shareableConcepts.slice(0, limit).map((concept) => getConceptShareCard(ctx, concept._id)),
  );
  return {
    count: shareableConcepts.length,
    remixes: remixes.filter((item): item is ConceptShareCard => item !== null),
  };
}

async function getLineageChain(
  ctx: QueryCtx,
  conceptId: Id<"concepts">
): Promise<ConceptShareCard[]> {
  const chain: ConceptShareCard[] = [];
  let currentId: Id<"concepts"> | undefined = conceptId;
  let hops = 0;

  while (currentId && hops < 8) {
    const concept: Doc<"concepts"> | null = await ctx.db.get(currentId);
    if (!isShareableConcept(concept)) {
      break;
    }

    const card = await getConceptShareCard(ctx, concept._id);
    if (card === null) {
      break;
    }

    chain.unshift(card);
    currentId = concept.sourceConceptId;
    hops += 1;
  }

  return chain;
}

async function getConceptShareCard(
  ctx: QueryCtx,
  conceptId: Id<"concepts">
): Promise<ConceptShareCard | null> {
  const concept = await ctx.db.get(conceptId);
  if (!isShareableConcept(concept)) {
    return null;
  }

  const [baseModel, stylePreset, materialPreset, publishedAssets, owner, engagement, remixCount] =
    await Promise.all([
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
    getPublishedRenditions(ctx, concept),
    ctx.db.get(concept.userId),
    getConceptEngagementSnapshot(ctx, concept._id) as Promise<ConceptEngagementSnapshot>,
    countShareableRemixes(ctx, concept._id),
  ]);

  return {
    _id: concept._id,
    _creationTime: concept._creationTime,
    title: concept.title,
    visibility: concept.visibility,
    status: concept.status,
    moodTags: concept.moodTags ?? [],
    weatheringLevel: concept.weatheringLevel,
    owner: owner
      ? {
          handle: owner.handle,
          fullName: owner.fullName,
        }
      : null,
    baseModel: await summarizeBaseModelWithHierarchy(ctx, baseModel, { publicOnly: true }),
    stylePreset: summarizeConceptStyle(stylePreset, concept.styleIntentJson),
    materialPreset: materialPreset
      ? {
          name: materialPreset.name,
          slug: materialPreset.slug,
          finishType: materialPreset.finishType,
        }
      : null,
    previewAsset: publishedAssets?.preview
      ? {
          publicUrl: publishedAssets.preview.publicUrl,
          thumbnailUrl: publishedAssets.thumbnail?.publicUrl,
          masterUrl: publishedAssets.master?.publicUrl,
          key: publishedAssets.preview.key,
          contentType: publishedAssets.preview.contentType,
        }
      : null,
    remixCount,
    engagement,
  };
}

function isShareableConcept(
  concept: Doc<"concepts"> | null
): concept is ShareableConcept {
  return (
    concept !== null &&
    concept.activePublicationId !== undefined &&
    (concept.visibility === "public" || concept.visibility === "unlisted") &&
    (concept.status === "generated" || concept.status === "archived")
  );
}

function isPublicConcept(
  concept: Doc<"concepts"> | null
): concept is ShareableConcept & { visibility: "public" } {
  return (
    concept !== null &&
    concept.activePublicationId !== undefined &&
    concept.visibility === "public" &&
    (concept.status === "generated" || concept.status === "archived")
  );
}

function dedupeShareCards<
  T extends {
    _id: Id<"concepts">;
  },
>(items: T[]) {
  const seen = new Set<Id<"concepts">>();
  return items.filter((item) => {
    if (seen.has(item._id)) {
      return false;
    }
    seen.add(item._id);
    return true;
  });
}

function publicVisualPalette(concept: Doc<"concepts">) {
  const parsed = parseStoredVisualPalette(concept.visualPaletteJson)
    ?? visualPaletteFromLegacyPlan(concept.palettePlanJson);
  if (parsed === null) {
    return null;
  }

  return {
    entries: parsed.entries.map((entry) => ({
      roleSlug: entry.roleSlug,
      roleName: entry.roleName,
      targetHex: entry.targetHex,
      recommendedArea: entry.recommendedArea,
    })),
  };
}

function parseStoredVisualPalette(value?: string) {
  if (!value) {
    return null;
  }
  try {
    const parsed = visualPaletteSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
