"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getPublicR2ObjectUrl, getR2ConnectionConfig } from "./r2Config";
import {
  copyR2Object,
  deleteR2Object,
  purgePublicR2Urls,
} from "./r2Storage";

const SHOWCASE_CACHE_CONTROL = "no-store";
const vConceptVisibility = v.union(
  v.literal("private"),
  v.literal("unlisted"),
  v.literal("public")
);

type PublicationRendition = "master" | "preview" | "thumbnail";
type BeginPublicationResult =
  | {
      mode: "ready";
      publicationId: Id<"assetPublications">;
      sourceObjects: never[];
      destinationObjects: never[];
      previousPublicationId: null;
      previousObjects: never[];
    }
  | {
      mode: "copy";
      publicationId: Id<"assetPublications">;
      sourceObjects: Array<{
        rendition: PublicationRendition;
        key: string;
        contentType: string;
      }>;
      destinationObjects: Array<{
        storageObjectId: Id<"storageObjects">;
        rendition: PublicationRendition;
        key: string;
      }>;
      previousPublicationId: Id<"assetPublications"> | null;
      previousObjects: Array<{
        storageObjectId: Id<"storageObjects">;
        key: string;
        publicUrl?: string;
      }>;
    };

export const setConceptVisibility = action({
  args: {
    conceptId: v.id("concepts"),
    visibility: vConceptVisibility,
  },
  returns: v.object({ visibility: vConceptVisibility, status: v.union(v.literal("published"), v.literal("withdrawn")), cleanupPending: v.boolean() }),
  async handler(ctx, { conceptId, visibility }): Promise<{
    visibility: "private" | "unlisted" | "public";
    status: "published" | "withdrawn";
    cleanupPending: boolean;
  }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required");

    if (visibility === "private") {
      const withdrawal = await ctx.runMutation(internal.publications.beginConceptWithdrawal, {
        conceptId,
        tokenIdentifier: identity.tokenIdentifier,
      });
      if (!withdrawal) {
        return { visibility, status: "withdrawn", cleanupPending: false };
      }
      const cleaned = await cleanupPublication(ctx, withdrawal.publicationId, withdrawal.objects);
      if (!cleaned) {
        throw new Error("Concept is private, but public asset cleanup must be retried");
      }
      return { visibility, status: "withdrawn", cleanupPending: false };
    }

    if (!getPublicR2ObjectUrl("configuration-check")) {
      throw new Error("R2_PUBLIC_BASE_URL must be configured before publishing");
    }
    const publicBucket = getR2ConnectionConfig().buckets.public;
    const publication: BeginPublicationResult = await ctx.runMutation(
      internal.publications.beginConceptPublication,
      {
      conceptId,
      tokenIdentifier: identity.tokenIdentifier,
      visibility,
      publicBucket,
      }
    );
    if (publication.mode === "ready") {
      return { visibility, status: "published", cleanupPending: false };
    }

    const sourceByRendition = new Map(
      publication.sourceObjects.map((object) => [object.rendition, object])
    );
    const copyResults = await Promise.allSettled(
      publication.destinationObjects.map(async (destination) => {
        const source = sourceByRendition.get(destination.rendition);
        if (!source) throw new Error(`Missing ${destination.rendition} source object`);
        const copied = await copyR2Object({
          sourceRole: "private",
          sourceKey: source.key,
          destinationRole: "public",
          destinationKey: destination.key,
          contentType: source.contentType,
          cacheControl: SHOWCASE_CACHE_CONTROL,
        });
        const publicUrl = copied.publicUrl;
        if (!publicUrl) throw new Error("Public asset URL could not be resolved");
        return {
          storageObjectId: destination.storageObjectId,
          rendition: destination.rendition,
          etag: copied.etag,
          publicUrl,
        };
      })
    );
    const failedCopy = copyResults.find(
      (result: PromiseSettledResult<{
        storageObjectId: Id<"storageObjects">;
        rendition: PublicationRendition;
        etag?: string;
        publicUrl: string;
      }>): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failedCopy) {
      await Promise.allSettled(
        publication.destinationObjects.map((object) => deleteR2Object("public", object.key))
      );
      await ctx.runMutation(internal.publications.failConceptPublication, {
        publicationId: publication.publicationId,
        errorMessage:
          failedCopy.reason instanceof Error
            ? failedCopy.reason.message
            : "Showcase asset copy failed",
      });
      throw failedCopy.reason;
    }
    const publishedObjects = copyResults.map((result) => {
      if (result.status !== "fulfilled") throw new Error("Showcase copy did not complete");
      return result.value;
    });
    const finalized = await ctx.runMutation(internal.publications.finalizeConceptPublication, {
      publicationId: publication.publicationId,
      objects: publishedObjects,
    });
    if (finalized.cancelled) {
      await cleanupPublication(ctx, publication.publicationId, publishedObjects.map(object => ({
        key: publication.destinationObjects.find(destination => destination.storageObjectId === object.storageObjectId)!.key,
        publicUrl: object.publicUrl,
      })));
      throw new Error("Publication was cancelled by a newer visibility change");
    }
    const cleanupPending = finalized.previousPublicationId
      ? !(await cleanupPublication(
          ctx,
          finalized.previousPublicationId,
          finalized.previousObjects
        ))
      : false;
    return { visibility, status: "published", cleanupPending };
  },
});

async function cleanupPublication(
  ctx: ActionCtx,
  publicationId: Id<"assetPublications">,
  objects: Array<{ key: string; publicUrl?: string }>
) {
  const deletions = await Promise.allSettled(
    objects.map((object) => deleteR2Object("public", object.key))
  );
  if (deletions.some((result) => result.status === "rejected")) {
    await ctx.runMutation(internal.publications.deferWithdrawal, { publicationId });
    return false;
  }
  try {
    const urls = objects.flatMap(object => {
      const url = object.publicUrl ?? getPublicR2ObjectUrl(object.key);
      return url ? [url] : [];
    });
    const purge = await purgePublicR2Urls(urls);
    if (urls.length > 0 && purge.status === "skipped") {
      await ctx.runMutation(internal.publications.deferWithdrawal, { publicationId });
      return false;
    }
  } catch {
    await ctx.runMutation(internal.publications.deferWithdrawal, { publicationId });
    return false;
  }
  await ctx.runMutation(internal.publications.completePublicationWithdrawal, {
    publicationId,
  });
  return true;
}


export const retryWithdrawals = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ids: Id<"assetPublications">[] = await ctx.runQuery(internal.publications.listPendingWithdrawals, { now: Date.now() });
    for (const publicationId of ids) {
      const manifest: { objects: Array<{ key: string; publicUrl?: string }> } | null =
        await ctx.runQuery(internal.publications.getWithdrawal, { publicationId, now: Date.now() });
      if (manifest) await cleanupPublication(ctx, publicationId, manifest.objects);
    }
    return null;
  },
});
