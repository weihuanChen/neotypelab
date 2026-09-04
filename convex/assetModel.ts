import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type {
  AssetRendition,
  AssetVersionOrigin,
  MediaAssetKind,
  StorageBucketRole,
} from "./domain";

type LegacyAssetInput = {
  userId: Id<"users">;
  key: string;
  bucket: string;
  kind: "preview" | "reference" | "mask" | "export" | "source";
  contentType?: string;
  byteSize?: number;
  publicUrl?: string;
  etag?: string;
  status: "active" | "deleted";
};

export type CreateAssetGraphInput = {
  legacyAsset: LegacyAssetInput;
  mediaKind: MediaAssetKind;
  rendition: AssetRendition;
  origin: AssetVersionOrigin;
  bucketRole: StorageBucketRole;
  conceptId?: Id<"concepts">;
  generationJobId?: Id<"generationJobs">;
  title?: string;
};

export async function createAssetGraph(ctx: MutationCtx, input: CreateAssetGraphInput) {
  const now = Date.now();
  const legacyAssetId = await ctx.db.insert("assets", input.legacyAsset);
  const existingMediaAsset = input.conceptId
    ? await ctx.db
        .query("mediaAssets")
        .withIndex("by_concept_status", (q) =>
          q.eq("conceptId", input.conceptId).eq("status", "active")
        )
        .first()
    : null;
  const mediaAssetId = existingMediaAsset
    ? existingMediaAsset._id
    : await ctx.db.insert("mediaAssets", {
        userId: input.legacyAsset.userId,
        kind: input.mediaKind,
        conceptId: input.conceptId,
        title: input.title,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
  const previousVersion = await ctx.db
    .query("assetVersions")
    .withIndex("by_media_version", (q) => q.eq("mediaAssetId", mediaAssetId))
    .order("desc")
    .first();
  const assetVersionId = await ctx.db.insert("assetVersions", {
    mediaAssetId,
    userId: input.legacyAsset.userId,
    version: (previousVersion?.version ?? 0) + 1,
    parentVersionId: previousVersion?._id,
    generationJobId: input.generationJobId,
    origin: input.origin,
    status: input.legacyAsset.status === "active" ? "ready" : "deleted",
    createdAt: now,
    updatedAt: now,
  });
  const storageObjectId = await ctx.db.insert("storageObjects", {
    mediaAssetId,
    assetVersionId,
    userId: input.legacyAsset.userId,
    legacyAssetId,
    bucketRole: input.bucketRole,
    bucket: input.legacyAsset.bucket,
    key: input.legacyAsset.key,
    rendition: input.rendition,
    contentType: input.legacyAsset.contentType,
    byteSize: input.legacyAsset.byteSize,
    etag: input.legacyAsset.etag,
    publicUrl: input.bucketRole === "public" ? input.legacyAsset.publicUrl : undefined,
    status: input.legacyAsset.status === "active" ? "ready" : "deleted",
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    ctx.db.patch(mediaAssetId, {
      currentVersionId: assetVersionId,
      updatedAt: now,
    }),
    ctx.db.patch(legacyAssetId, {
      mediaAssetId,
      assetVersionId,
      storageObjectId,
    }),
  ]);

  return {
    legacyAssetId,
    mediaAssetId,
    assetVersionId,
    storageObjectId,
  };
}

export function legacyKindToMediaKind(
  kind: LegacyAssetInput["kind"]
): MediaAssetKind {
  if (kind === "mask") return "mask";
  if (kind === "export") return "export";
  return "reference-image";
}

export function legacyKindToRendition(
  kind: LegacyAssetInput["kind"]
): AssetRendition {
  if (kind === "preview") return "preview";
  if (kind === "mask") return "mask";
  if (kind === "export") return "export";
  return "source";
}
