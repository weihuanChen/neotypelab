import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./functions";
import type { MutationCtx } from "./_generated/server";
import { startShowcaseIndexWait } from "./showcaseIndexing";
import type { QueryCtx } from "./types";

const vPublicationVisibility = v.union(v.literal("public"), v.literal("unlisted"));
const vWebRendition = v.union(
  v.literal("master"),
  v.literal("preview"),
  v.literal("thumbnail")
);

const vPublicationObjects = v.array(v.object({
  storageObjectId: v.id("storageObjects"), key: v.string(), publicUrl: v.optional(v.string()),
}));

type WebRendition = "master" | "preview" | "thumbnail";
const WEB_RENDITIONS: WebRendition[] = ["master", "preview", "thumbnail"];

export async function getPublishedRenditions(
  ctx: QueryCtx,
  concept: Doc<"concepts">
) {
  if (!concept.activePublicationId) return null;
  const publication = await ctx.db.get(concept.activePublicationId);
  if (!publication || publication.status !== "published" || publication.conceptId !== concept._id || publication.userId !== concept.userId) return null;
  const objects = await ctx.db
    .query("storageObjects")
    .withIndex("by_publicationId", (q) => q.eq("publicationId", publication._id))
    .take(20);
  const readyObjects = objects.filter(
    (object) => object.bucketRole === "public" && object.status === "ready"
  );
  const result = Object.fromEntries(
    WEB_RENDITIONS.map((rendition) => [
      rendition,
      readyObjects.find((object) => object.rendition === rendition) ?? null,
    ])
  ) as Record<WebRendition, Doc<"storageObjects"> | null>;
  return WEB_RENDITIONS.every((rendition) => result[rendition]?.publicUrl)
    ? { publication, ...result }
    : null;
}

export const beginConceptPublication = internalMutation({
  args: {
    conceptId: v.id("concepts"),
    tokenIdentifier: v.string(),
    visibility: vPublicationVisibility,
    publicBucket: v.string(),
  },
  returns: v.object({
    mode: v.union(v.literal("ready"), v.literal("copy")), publicationId: v.id("assetPublications"),
    sourceObjects: v.array(v.object({ rendition: vWebRendition, key: v.string(), contentType: v.string() })),
    destinationObjects: v.array(v.object({ storageObjectId: v.id("storageObjects"), rendition: vWebRendition, key: v.string() })),
    previousPublicationId: v.union(v.id("assetPublications"), v.null()), previousObjects: vPublicationObjects,
  }),
  async handler(ctx, { conceptId, tokenIdentifier, visibility, publicBucket }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    const concept = await ctx.db.get(conceptId);
    if (!viewer || !concept || concept.userId !== viewer._id) {
      throw new Error("Concept not found or publication access denied");
    }
    if (concept.status !== "generated" && concept.status !== "archived") {
      throw new Error("Only generated or archived concepts can be published");
    }
    if (!concept.mediaAssetId || !concept.currentAssetVersionId) {
      throw new Error("Concept does not have a versioned Library asset");
    }

    const sourceObjects = await ctx.db
      .query("storageObjects")
      .withIndex("by_assetVersionId", (q) =>
        q.eq("assetVersionId", concept.currentAssetVersionId!)
      )
      .take(20)
      .then((objects) =>
        objects.filter(
          (object) =>
            object.bucketRole === "private" &&
            object.status === "ready" &&
            WEB_RENDITIONS.includes(object.rendition as WebRendition)
        )
      );
    assertCompleteSourceRenditions(sourceObjects);

    if (concept.showcaseReviewStatus === "hidden") throw new Error("Hidden works cannot be published");
    if (concept.pendingPublicationId) await queuePublicationWithdrawal(ctx, concept.pendingPublicationId, 15 * 60 * 1000);

    const activePublication = concept.activePublicationId
      ? await ctx.db.get(concept.activePublicationId)
      : null;
    const activePublicObjects = activePublication
      ? await ctx.db
          .query("storageObjects")
          .withIndex("by_publicationId", (q) =>
            q.eq("publicationId", activePublication._id)
          )
          .take(20)
      : [];
    if (
      activePublication?.status === "published" &&
      activePublication.assetVersionId === concept.currentAssetVersionId &&
      hasCompleteReadyPublicRenditions(activePublicObjects)
    ) {
      await Promise.all([
        ctx.db.patch(activePublication._id, { visibility, updatedAt: Date.now() }),
        ctx.db.patch(concept._id, {
          visibility, pendingPublicationId: undefined,
          ...(visibility === "unlisted" ? { publicSince: undefined, indexEligible: false } : {}),
        }),
      ]);
      if (visibility === "public" && (concept.visibility !== "public" || concept.publicSince === undefined)) {
        await startShowcaseIndexWait(ctx, concept._id, activePublication._id, Date.now());
      }
      return {
        mode: "ready" as const,
        publicationId: activePublication._id,
        sourceObjects: [],
        destinationObjects: [],
        previousPublicationId: null,
        previousObjects: [],
      };
    }

    const now = Date.now();
    const publicationId = await ctx.db.insert("assetPublications", {
      mediaAssetId: concept.mediaAssetId,
      assetVersionId: concept.currentAssetVersionId,
      userId: viewer._id,
      conceptId,
      kind: "showcase",
      visibility,
      status: "publishing",
      publicPrefix: "",
      createdAt: now,
      updatedAt: now,
    });
    const publicPrefix = `showcase/${conceptId}/publications/${publicationId}`;
    await ctx.db.patch(publicationId, { publicPrefix });
    await ctx.db.patch(conceptId, {
      pendingPublicationId: publicationId, indexEligible: false, publicSince: undefined,
    });

    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.publications.expirePendingPublication, { publicationId });
    const destinationObjects = [];
    for (const source of sourceObjects) {
      const rendition = source.rendition as WebRendition;
      const key = `${publicPrefix}/${rendition}.webp`;
      const existing = await ctx.db
        .query("storageObjects")
        .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
        .take(20)
        .then((objects) => objects.find((object) => object.rendition === rendition));
      const storageObjectId = existing
        ? existing._id
        : await ctx.db.insert("storageObjects", {
            mediaAssetId: concept.mediaAssetId,
            assetVersionId: concept.currentAssetVersionId,
            userId: viewer._id,
            publicationId,
            bucketRole: "public",
            accountingCategory: "unmetered",
            retentionPolicy: "publication",
            bucket: publicBucket,
            key,
            rendition,
            contentType: source.contentType,
            byteSize: source.byteSize,
            width: source.width,
            height: source.height,
            checksum: source.checksum,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          });
      if (existing) {
        await ctx.db.patch(existing._id, {
          bucket: publicBucket,
          key,
          contentType: source.contentType,
          byteSize: source.byteSize,
          width: source.width,
          height: source.height,
          checksum: source.checksum,
          publicUrl: undefined,
          status: "pending",
          updatedAt: now,
        });
      }
      destinationObjects.push({ storageObjectId, rendition, key });
    }

    const previousObjects = activePublication
      ? await ctx.db
          .query("storageObjects")
          .withIndex("by_publicationId", (q) =>
            q.eq("publicationId", activePublication._id)
          )
          .take(20)
      : [];
    return {
      mode: "copy" as const,
      publicationId,
      sourceObjects: sourceObjects.map((object) => ({
        rendition: object.rendition as WebRendition,
        key: object.key,
        contentType: object.contentType ?? "image/webp",
      })),
      destinationObjects,
      previousPublicationId: activePublication?._id ?? null,
      previousObjects: previousObjects.map((object) => ({
        storageObjectId: object._id,
        key: object.key,
        publicUrl: object.publicUrl,
      })),
    };
  },
});

export const finalizeConceptPublication = internalMutation({
  args: {
    publicationId: v.id("assetPublications"),
    objects: v.array(v.object({
      storageObjectId: v.id("storageObjects"),
      rendition: vWebRendition,
      etag: v.optional(v.string()),
      publicUrl: v.string(),
    })),
  },
  returns: v.object({ cancelled: v.boolean(), previousPublicationId: v.union(v.id("assetPublications"), v.null()), previousObjects: vPublicationObjects }),
  async handler(ctx, { publicationId, objects }) {
    const publication = await ctx.db.get(publicationId);
    if (!publication || !publication.conceptId) throw new Error("Publication not found");
    const concept = await ctx.db.get(publication.conceptId);
    if (publication.status === "published" && concept?.activePublicationId === publicationId) {
      return { cancelled: false, previousPublicationId: null, previousObjects: [] };
    }
    if (!concept || publication.status !== "publishing" || concept.pendingPublicationId !== publicationId ||
      concept.currentAssetVersionId !== publication.assetVersionId || concept.showcaseReviewStatus === "hidden") {
      await queuePublicationWithdrawal(ctx, publicationId);
      return { cancelled: true, previousPublicationId: null, previousObjects: [] };
    }
    assertCompletePublishedObjects(objects);
    const publicationObjects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
      .take(20);
    for (const object of objects) {
      const stored = publicationObjects.find((candidate) => candidate._id === object.storageObjectId);
      if (!stored || stored.rendition !== object.rendition) {
        throw new Error("Published object does not belong to this publication");
      }
    }
    const now = Date.now();
    const previousPublication = concept.activePublicationId
      ? await ctx.db.get(concept.activePublicationId)
      : null;
    const previousObjects = previousPublication && previousPublication._id !== publicationId
      ? await ctx.db
          .query("storageObjects")
          .withIndex("by_publicationId", (q) =>
            q.eq("publicationId", previousPublication._id)
          )
          .take(20)
      : [];
    const preview = objects.find((object) => object.rendition === "preview")!;

    await Promise.all([
      ...objects.map((object) =>
        ctx.db.patch(object.storageObjectId, {
          etag: object.etag,
          publicUrl: object.publicUrl,
          status: "ready",
          updatedAt: now,
        })
      ),
      ctx.db.patch(publicationId, {
        status: "published",
        publishedAt: now,
        withdrawnAt: undefined,
        errorMessage: undefined,
        updatedAt: now,
      }),
      ctx.db.patch(concept._id, {
        visibility: publication.visibility,
        activePublicationId: publicationId,
        pendingPublicationId: undefined,
        publicSince: undefined,
        indexEligible: false,
        publicContentUpdatedAt: now,
      }),
      concept.previewAssetId
        ? ctx.db.patch(concept.previewAssetId, { publicUrl: preview.publicUrl })
        : Promise.resolve(),
      previousPublication && previousPublication._id !== publicationId
        ? ctx.db.patch(previousPublication._id, {
            status: "withdrawing",
            updatedAt: now,
          })
        : Promise.resolve(),
      ...previousObjects.map((object) =>
        ctx.db.patch(object._id, { status: "deleting", updatedAt: now })
      ),
    ]);
    if (publication.visibility === "public") await startShowcaseIndexWait(ctx, concept._id, publicationId, now);
    if (previousPublication && previousPublication._id !== publicationId) await queuePublicationWithdrawal(ctx, previousPublication._id);
    return {
      cancelled: false,
      previousPublicationId:
        previousPublication && previousPublication._id !== publicationId
          ? previousPublication._id
          : null,
      previousObjects: previousObjects.map((object) => ({
        storageObjectId: object._id,
        key: object.key,
        publicUrl: object.publicUrl,
      })),
    };
  },
});

export const failConceptPublication = internalMutation({
  args: {
    publicationId: v.id("assetPublications"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  async handler(ctx, { publicationId, errorMessage }) {
    const publication = await ctx.db.get(publicationId);
    if (!publication || publication.status === "published") return null;
    const concept = publication.conceptId ? await ctx.db.get(publication.conceptId) : null;
    if (concept?.pendingPublicationId === publicationId) await ctx.db.patch(concept._id, { pendingPublicationId: undefined });
    await ctx.db.patch(publicationId, { errorMessage });
    await queuePublicationWithdrawal(ctx, publicationId);
    return null;
  },
});

export const beginConceptWithdrawal = internalMutation({
  args: {
    conceptId: v.id("concepts"),
    tokenIdentifier: v.string(),
  },
  returns: v.union(v.null(), v.object({ publicationId: v.id("assetPublications"), objects: vPublicationObjects })),
  async handler(ctx, { conceptId, tokenIdentifier }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    const concept = await ctx.db.get(conceptId);
    if (!viewer || !concept || concept.userId !== viewer._id) {
      throw new Error("Concept not found or withdrawal access denied");
    }
    if (concept.pendingPublicationId) await queuePublicationWithdrawal(ctx, concept.pendingPublicationId, 15 * 60 * 1000);
    await ctx.db.patch(conceptId, {
      visibility: "private", activePublicationId: undefined, pendingPublicationId: undefined,
      publicSince: undefined, indexEligible: false,
    });
    const publication = concept.activePublicationId
      ? await ctx.db.get(concept.activePublicationId)
      : await ctx.db.query("assetPublications")
          .withIndex("by_concept_status", q => q.eq("conceptId", conceptId).eq("status", "withdrawing"))
          .first();
    if (!publication || (publication.cleanupNotBefore ?? 0) > Date.now()) return null;
    await queuePublicationWithdrawal(ctx, publication._id, publication.status === "publishing" ? 15 * 60 * 1000 : 0);
    const objects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publication._id))
      .take(20);
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(conceptId, { visibility: "private", activePublicationId: undefined }),
      ctx.db.patch(publication._id, { status: "withdrawing", updatedAt: now }),
      concept.previewAssetId
        ? ctx.db.patch(concept.previewAssetId, { publicUrl: undefined })
        : Promise.resolve(),
      ...objects.map((object) =>
        ctx.db.patch(object._id, { status: "deleting", updatedAt: now })
      ),
    ]);
    return {
      publicationId: publication._id,
      objects: objects.map((object) => ({
        storageObjectId: object._id,
        key: object.key,
        publicUrl: object.publicUrl,
      })),
    };
  },
});

export const completePublicationWithdrawal = internalMutation({
  args: {
    publicationId: v.id("assetPublications"),
  },
  returns: v.null(),
  async handler(ctx, { publicationId }) {
    const publication = await ctx.db.get(publicationId);
    if (!publication || publication.status !== "withdrawing") return null;
    const objects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
      .take(20);
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(publicationId, {
        status: "withdrawn",
        withdrawnAt: now,
        updatedAt: now,
      }),
      ...objects.map((object) =>
        ctx.db.patch(object._id, {
          publicUrl: undefined,
          status: "deleted",
          updatedAt: now,
        })
      ),
    ]);
    return null;
  },
});

function assertCompleteSourceRenditions(objects: Doc<"storageObjects">[]) {
  const names = new Set(objects.map((object) => object.rendition));
  if (WEB_RENDITIONS.some((rendition) => !names.has(rendition))) {
    throw new Error("Master, preview, and thumbnail must be ready before publication");
  }
}

function hasCompleteReadyPublicRenditions(objects: Doc<"storageObjects">[]) {
  return WEB_RENDITIONS.every((rendition) =>
    objects.some(
      (object) =>
        object.bucketRole === "public" &&
        object.status === "ready" &&
        object.rendition === rendition &&
        Boolean(object.publicUrl)
    )
  );
}

function assertCompletePublishedObjects(
  objects: Array<{ rendition: WebRendition; publicUrl: string }>
) {
  const names = new Set(objects.map((object) => object.rendition));
  if (
    objects.length !== WEB_RENDITIONS.length ||
    WEB_RENDITIONS.some((rendition) => !names.has(rendition))
  ) {
    throw new Error("Published Master, preview, and thumbnail are required");
  }
}

async function queuePublicationWithdrawal(ctx: MutationCtx, publicationId: Doc<"assetPublications">["_id"], delayMs = 0): Promise<void> {
  const publication = await ctx.db.get(publicationId);
  if (!publication || publication.status === "withdrawn") return;
  const now = Date.now();
  const objects = await ctx.db.query("storageObjects")
    .withIndex("by_publicationId", q => q.eq("publicationId", publicationId)).take(10);
  await ctx.db.patch(publicationId, { status: "withdrawing", cleanupNotBefore: now + delayMs, updatedAt: now });
  for (const object of objects) await ctx.db.patch(object._id, { status: "deleting", updatedAt: now });
}

export const listPendingWithdrawals = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.id("assetPublications")),
  handler: async (ctx, { now }) => {
    const publications = await ctx.db.query("assetPublications")
      .withIndex("by_status_cleanupNotBefore", q => q.eq("status", "withdrawing").lte("cleanupNotBefore", now)).take(20);
    return publications.map(publication => publication._id);
  },
});

export const getWithdrawal = internalQuery({
  args: { publicationId: v.id("assetPublications"), now: v.number() },
  returns: v.union(v.null(), v.object({
    objects: v.array(v.object({ key: v.string(), publicUrl: v.optional(v.string()) })),
  })),
  handler: async (ctx, { publicationId, now }) => {
    const publication = await ctx.db.get(publicationId);
    if (!publication || publication.status !== "withdrawing" || (publication.cleanupNotBefore ?? 0) > now) return null;
    const objects = await ctx.db.query("storageObjects")
      .withIndex("by_publicationId", q => q.eq("publicationId", publicationId)).take(10);
    return { objects: objects.map(object => ({ key: object.key, publicUrl: object.publicUrl })) };
  },
});

export const deferWithdrawal = internalMutation({
  args: { publicationId: v.id("assetPublications") },
  returns: v.null(),
  handler: async (ctx, { publicationId }) => {
    const publication = await ctx.db.get(publicationId);
    if (publication?.status === "withdrawing") await ctx.db.patch(publicationId, { cleanupNotBefore: Date.now() + 15 * 60 * 1000 });
    return null;
  },
});

export const expirePendingPublication = internalMutation({
  args: { publicationId: v.id("assetPublications") },
  returns: v.null(),
  handler: async (ctx, { publicationId }) => {
    const publication = await ctx.db.get(publicationId);
    if (publication?.status !== "publishing") return null;
    const concept = publication.conceptId ? await ctx.db.get(publication.conceptId) : null;
    if (concept?.pendingPublicationId === publicationId) await ctx.db.patch(concept._id, { pendingPublicationId: undefined });
    await queuePublicationWithdrawal(ctx, publicationId);
    return null;
  },
});
