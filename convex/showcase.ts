import { v } from "convex/values";
import {
  BaseModelWithHierarchy,
  summarizeBaseModelWithHierarchy,
} from "./baseModelHierarchy";
import { Doc, Id } from "./_generated/dataModel";
import { MoodTag } from "./domain";
import { getConceptEngagementSnapshot } from "./engagement";
import { getCreatorPackEngagementSnapshot } from "./packEngagement";
import { buildPaintPlan } from "./paintMappingEngine";
import { query } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { QueryCtx } from "./types";

type ShareableConcept = Doc<"concepts"> & {
  visibility: "public" | "unlisted";
  status: "generated" | "archived";
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
      .filter((concept) => concept.status === "generated" || concept.status === "archived")
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 24);

    return await Promise.all(
      generatedConcepts.map(async (concept) => {
        const [baseModel, stylePreset, materialPreset, previewAsset, owner, remixCount, engagement] =
          await Promise.all([
            concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
            concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
            concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
            concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
            ctx.db.get(concept.userId),
            listShareableRemixes(ctx, concept._id).then((items) => items.length),
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
          stylePreset: stylePreset
            ? {
                name: stylePreset.name,
                slug: stylePreset.slug,
                category: stylePreset.category,
                isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
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
      .filter((concept) => concept.status === "generated" || concept.status === "archived")
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
    const users = await ctx.db.query("users").collect();
    const publicProfiles = await Promise.all(
      users.map(async (user) => {
        const publicConcepts = await ctx.db
          .query("concepts")
          .withIndex("by_user_visibility", (q) => q.eq("userId", user._id).eq("visibility", "public"))
          .collect()
          .then((items) =>
            items.filter((concept) => concept.status === "generated" || concept.status === "archived")
          );

        if (publicConcepts.length === 0) {
          return null;
        }

        const lastModified = publicConcepts.reduce(
          (latest, concept) => Math.max(latest, concept._creationTime),
          0
        );

        return {
          handle: user.handle,
          lastModified,
        };
      })
    );

    return publicProfiles
      .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
      .sort((left, right) => left.handle.localeCompare(right.handle));
  },
});

export const listCreatorHubsForSitemap = query({
  args: {},
  async handler(ctx) {
    const users = await ctx.db.query("users").collect();
    const publicHubs = await Promise.all(
      users.map(async (user) => {
        const [publicConcepts, creatorPacks, creatorStyles] = await Promise.all([
          ctx.db
            .query("concepts")
            .withIndex("by_user_visibility", (q) => q.eq("userId", user._id).eq("visibility", "public"))
            .collect()
            .then((items) =>
              items.filter((concept) => concept.status === "generated" || concept.status === "archived")
            ),
          ctx.db
            .query("creatorPacks")
            .withIndex("by_creatorUserId", (q) => q.eq("creatorUserId", user._id))
            .collect()
            .then((items) => items.filter((pack) => pack.isActive)),
          ctx.db
            .query("stylePresets")
            .collect()
            .then((items) => items.filter((preset) => preset.creatorUserId === user._id && preset.isActive)),
        ]);

        if (
          publicConcepts.length === 0 &&
          creatorPacks.length === 0 &&
          creatorStyles.length === 0
        ) {
          return null;
        }

        const lastModified = Math.max(
          ...publicConcepts.map((concept) => concept._creationTime),
          ...creatorPacks.map((pack) => pack._creationTime),
          user._creationTime
        );

        return {
          handle: user.handle,
          lastModified,
        };
      })
    );

    return publicHubs
      .filter((hub): hub is NonNullable<typeof hub> => hub !== null)
      .sort((left, right) => left.handle.localeCompare(right.handle));
  },
});

export const listRankedPublicCreators = query({
  args: {},
  async handler(ctx) {
    const users = await ctx.db.query("users").collect();

    const creatorRows = await Promise.all(
      users.map(async (user) => {
        const publicConcepts = await ctx.db
          .query("concepts")
          .withIndex("by_user_visibility", (q) => q.eq("userId", user._id).eq("visibility", "public"))
          .collect()
          .then((items) =>
            items.filter((concept) => concept.status === "generated" || concept.status === "archived")
          );

        if (publicConcepts.length === 0) {
          return null;
        }

        const conceptCards = await Promise.all(
          publicConcepts.map((concept) => getConceptShareCard(ctx, concept._id))
        ).then((items) => items.filter((item): item is ConceptShareCard => item !== null));

        const totals = conceptCards.reduce(
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
          leadConcept: conceptCards.sort((a, b) => b._creationTime - a._creationTime)[0] ?? null,
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

    const shareableRemixesPromise = listShareableRemixes(ctx, concept._id);
    const [
      baseModel,
      stylePreset,
      materialPreset,
      previewAsset,
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
      concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
      ctx.db.get(concept.userId),
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      ctx.db.query("paintMappings").collect(),
      concept.sourceConceptId ? getConceptShareCard(ctx, concept.sourceConceptId) : Promise.resolve(null),
      shareableRemixesPromise,
      getConceptEngagementSnapshot(ctx, concept._id),
      getLineageChain(ctx, concept._id),
    ]);

    const paintPlan = buildPaintPlan({
      conceptId: concept._id,
      conceptTitle: concept.title,
      baseModelName: baseModel?.name,
      stylePresetName: stylePreset?.name,
      styleSlug: stylePreset?.slug,
      materialPresetName: materialPreset?.name,
      materialSlug: materialPreset?.slug,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      colorRoles,
      paintMappings,
    });

    return {
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
      stylePreset: stylePreset
        ? {
            name: stylePreset.name,
            slug: stylePreset.slug,
            category: stylePreset.category,
            shortDescription: stylePreset.shortDescription,
            isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
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
      sourceConcept,
      lineage,
      remixes: shareableRemixes.slice(0, 6),
      remixCount: shareableRemixes.length,
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
      savedInteractions,
      likeInteractions,
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
            .filter((concept) => concept.status === "generated" || concept.status === "archived")
            .sort((a, b) => b._creationTime - a._creationTime)
        ),
      ctx.db
        .query("conceptInteractions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect()
        .then((items) => items.filter((item) => item.kind === "save")),
      ctx.db
        .query("conceptInteractions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect()
        .then((items) => items.filter((item) => item.kind === "like")),
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
          items.filter((concept) => concept.status === "generated" || concept.status === "archived")
        ),
    ]);

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

        const publicConcepts = await ctx.db
          .query("concepts")
          .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
          .collect()
          .then((items) =>
            items.filter(
              (concept) =>
                (concept.status === "generated" || concept.status === "archived") &&
                pack.stylePresetIds.includes(concept.stylePresetId as Id<"stylePresets">)
            )
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
      published.map(async (concept) => ({
        conceptId: concept._id,
        conceptTitle: concept.title,
        remixCount: (await listShareableRemixes(ctx, concept._id)).length,
        remixes: (await listShareableRemixes(ctx, concept._id)).slice(0, 4),
      }))
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
      ctx.db.query("paintMappings").collect(),
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
          (concept.status === "generated" || concept.status === "archived")
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
            (concept.status === "generated" || concept.status === "archived") &&
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
    const creatorPacks = await ctx.db.query("creatorPacks").collect();
    const activePacks = creatorPacks
      .filter((pack) => pack.isActive)
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a._creationTime - b._creationTime)
      .slice(0, 12);

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

        const publicConcepts = await ctx.db
          .query("concepts")
          .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
          .collect()
          .then((items) =>
            items.filter(
              (concept) =>
                (concept.status === "generated" || concept.status === "archived") &&
                pack.stylePresetIds.includes(concept.stylePresetId as Id<"stylePresets">)
            )
          );

        const conceptCards = await Promise.all(
          publicConcepts
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
            publicConceptCount: publicConcepts.length,
            publicRemixCount: publicConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.remixCount, 0),
            publicLikeCount: publicConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.engagement.likeCount, 0),
            publicSaveCount: publicConcepts.length === 0 ? 0 : conceptCards.reduce((sum, concept) => sum + concept.engagement.saveCount, 0),
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

async function listShareableRemixes(
  ctx: QueryCtx,
  sourceConceptId: Id<"concepts">
): Promise<ConceptShareCard[]> {
  const concepts = await ctx.db
    .query("concepts")
    .withIndex("by_sourceConceptId", (q) => q.eq("sourceConceptId", sourceConceptId))
    .collect();

  const shareableConcepts = concepts
    .filter((concept) => isShareableConcept(concept))
    .sort((a, b) => b._creationTime - a._creationTime);

  return await Promise.all(
    shareableConcepts.map(async (concept) => getConceptShareCard(ctx, concept._id))
  ).then((items) => items.filter((item): item is ConceptShareCard => item !== null));
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

  const [baseModel, stylePreset, materialPreset, previewAsset, owner, engagement, remixCount]: [
    Doc<"baseModels"> | null,
    Doc<"stylePresets"> | null,
    Doc<"materialPresets"> | null,
    Doc<"assets"> | null,
    Doc<"users"> | null,
    ConceptEngagementSnapshot,
    number,
  ] = await Promise.all([
    concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
    concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
    concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
    concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
    ctx.db.get(concept.userId),
    getConceptEngagementSnapshot(ctx, concept._id) as Promise<ConceptEngagementSnapshot>,
    listShareableRemixes(ctx, concept._id).then((items: ConceptShareCard[]) => items.length),
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
    stylePreset: stylePreset
      ? {
          name: stylePreset.name,
          slug: stylePreset.slug,
          category: stylePreset.category,
          isFeaturedStyle: stylePreset.isFeaturedStyle ?? false,
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

function isPublicConcept(
  concept: Doc<"concepts"> | null
): concept is ShareableConcept & { visibility: "public" } {
  return (
    concept !== null &&
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
