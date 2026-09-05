import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./functions";
import type { QueryCtx } from "./types";

const vPublicationVisibility = v.union(v.literal("public"), v.literal("unlisted"));
const vWebRendition = v.union(
  v.literal("master"),
  v.literal("preview"),
  v.literal("thumbnail")
);

type WebRendition = "master" | "preview" | "thumbnail";
const WEB_RENDITIONS: WebRendition[] = ["master", "preview", "thumbnail"];

export async function getPublishedRenditions(
  ctx: QueryCtx,
  concept: Doc<"concepts">
) {
  if (!concept.activePublicationId) return null;
  const publication = await ctx.db.get(concept.activePublicationId);
  if (!publication || publication.status !== "published") return null;
  const objects = await ctx.db
    .query("storageObjects")
    .withIndex("by_publicationId", (q) => q.eq("publicationId", publication._id))
    .collect();
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
      .collect()
      .then((objects) =>
        objects.filter(
          (object) =>
            object.bucketRole === "private" &&
            object.status === "ready" &&
            WEB_RENDITIONS.includes(object.rendition as WebRendition)
        )
      );
    assertCompleteSourceRenditions(sourceObjects);

    const activePublication = concept.activePublicationId
      ? await ctx.db.get(concept.activePublicationId)
      : null;
    const activePublicObjects = activePublication
      ? await ctx.db
          .query("storageObjects")
          .withIndex("by_publicationId", (q) =>
            q.eq("publicationId", activePublication._id)
          )
          .collect()
      : [];
    if (
      activePublication?.status === "published" &&
      activePublication.assetVersionId === concept.currentAssetVersionId &&
      hasCompleteReadyPublicRenditions(activePublicObjects)
    ) {
      await Promise.all([
        ctx.db.patch(activePublication._id, { visibility, updatedAt: Date.now() }),
        ctx.db.patch(concept._id, { visibility }),
      ]);
      return {
        mode: "ready" as const,
        publicationId: activePublication._id,
        sourceObjects: [],
        destinationObjects: [],
        previousPublicationId: null,
        previousObjects: [],
      };
    }

    const existingPublishing = await ctx.db
      .query("assetPublications")
      .withIndex("by_concept_status", (q) =>
        q.eq("conceptId", conceptId).eq("status", "publishing")
      )
      .collect()
      .then((items) =>
        items.find((item) => item.assetVersionId === concept.currentAssetVersionId)
      );
    const existingFailed = existingPublishing
      ? null
      : await ctx.db
          .query("assetPublications")
          .withIndex("by_concept_status", (q) =>
            q.eq("conceptId", conceptId).eq("status", "failed")
          )
          .collect()
          .then((items) =>
            items.find((item) => item.assetVersionId === concept.currentAssetVersionId)
          );
    const reusablePublication = existingPublishing ?? existingFailed;
    const now = Date.now();
    const publicPrefix = `showcase/${conceptId}/versions/${concept.currentAssetVersionId}`;
    const publicationId = reusablePublication
      ? reusablePublication._id
      : await ctx.db.insert("assetPublications", {
          mediaAssetId: concept.mediaAssetId,
          assetVersionId: concept.currentAssetVersionId,
          userId: viewer._id,
          conceptId,
          kind: "showcase",
          visibility,
          status: "publishing",
          publicPrefix,
          createdAt: now,
          updatedAt: now,
        });
    if (reusablePublication) {
      await ctx.db.patch(reusablePublication._id, {
        visibility,
        status: "publishing",
        errorMessage: undefined,
        updatedAt: now,
      });
    }

    const destinationObjects = [];
    for (const source of sourceObjects) {
      const rendition = source.rendition as WebRendition;
      const key = `${publicPrefix}/${rendition}.webp`;
      const existing = await ctx.db
        .query("storageObjects")
        .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
        .collect()
        .then((objects) => objects.find((object) => object.rendition === rendition));
      const storageObjectId = existing
        ? existing._id
        : await ctx.db.insert("storageObjects", {
            mediaAssetId: concept.mediaAssetId,
            assetVersionId: concept.currentAssetVersionId,
            userId: viewer._id,
            publicationId,
            bucketRole: "public",
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
          .collect()
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
  async handler(ctx, { publicationId, objects }) {
    const publication = await ctx.db.get(publicationId);
    if (publication?.status === "published") {
      return { previousPublicationId: null, previousObjects: [] };
    }
    if (!publication || publication.status !== "publishing" || !publication.conceptId) {
      throw new Error("Publication is not ready to finalize");
    }
    assertCompletePublishedObjects(objects);
    const concept = await ctx.db.get(publication.conceptId);
    if (!concept) throw new Error("Published concept no longer exists");
    const publicationObjects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
      .collect();
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
          .collect()
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
    return {
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
  async handler(ctx, { publicationId, errorMessage }) {
    const publication = await ctx.db.get(publicationId);
    if (!publication || publication.status === "published") return;
    const objects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
      .collect();
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(publicationId, { status: "failed", errorMessage, updatedAt: now }),
      ...objects.map((object) =>
        ctx.db.patch(object._id, { status: "failed", updatedAt: now })
      ),
    ]);
  },
});

export const beginConceptWithdrawal = internalMutation({
  args: {
    conceptId: v.id("concepts"),
    tokenIdentifier: v.string(),
  },
  async handler(ctx, { conceptId, tokenIdentifier }) {
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();
    const concept = await ctx.db.get(conceptId);
    if (!viewer || !concept || concept.userId !== viewer._id) {
      throw new Error("Concept not found or withdrawal access denied");
    }
    let publication = concept.activePublicationId
      ? await ctx.db.get(concept.activePublicationId)
      : null;
    if (!publication) {
      publication = await ctx.db
        .query("assetPublications")
        .withIndex("by_concept_status", (q) =>
          q.eq("conceptId", conceptId).eq("status", "withdrawing")
        )
        .first();
    }
    if (!publication) {
      if (concept.visibility !== "private") {
        await ctx.db.patch(conceptId, { visibility: "private", activePublicationId: undefined });
      }
      return null;
    }
    const objects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publication._id))
      .collect();
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
  async handler(ctx, { publicationId }) {
    const publication = await ctx.db.get(publicationId);
    if (!publication) return;
    const objects = await ctx.db
      .query("storageObjects")
      .withIndex("by_publicationId", (q) => q.eq("publicationId", publicationId))
      .collect();
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
