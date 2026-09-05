import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type {
  AssetRendition,
  AssetVersionOrigin,
  MediaAssetKind,
  StorageAccountingCategory,
  StorageBucketRole,
  StorageRetentionPolicy,
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
  width?: number;
  height?: number;
  checksum?: string;
  accountingCategory?: StorageAccountingCategory;
  retentionPolicy?: StorageRetentionPolicy;
  retentionDaysSnapshot?: number;
  retainUntil?: number;
  versionRetentionDaysSnapshot?: number;
  versionStatus?: "processing" | "ready" | "failed" | "deleted";
  storageStatus?: "pending" | "ready" | "deleting" | "deleted" | "failed";
};

export async function createAssetGraph(ctx: MutationCtx, input: CreateAssetGraphInput) {
  if (input.generationJobId) {
    const existingVersion = await ctx.db
      .query("assetVersions")
      .withIndex("by_generationJobId", (q) =>
        q.eq("generationJobId", input.generationJobId)
      )
      .first();
    if (existingVersion) {
      const existingObject = await ctx.db
        .query("storageObjects")
        .withIndex("by_version_rendition", (q) =>
          q.eq("assetVersionId", existingVersion._id).eq("rendition", input.rendition)
        )
        .first();
      if (existingObject?.legacyAssetId) {
        const now = Date.now();
        await Promise.all([
          input.versionStatus
            ? ctx.db.patch(existingVersion._id, {
                status: input.versionStatus,
                retentionDaysSnapshot:
                  input.versionRetentionDaysSnapshot ??
                  existingVersion.retentionDaysSnapshot,
                updatedAt: now,
              })
            : Promise.resolve(),
          input.storageStatus
            ? ctx.db.patch(existingObject._id, {
                status: input.storageStatus,
                accountingCategory:
                  input.accountingCategory ?? existingObject.accountingCategory,
                retentionPolicy:
                  input.retentionPolicy ?? existingObject.retentionPolicy,
                retentionDaysSnapshot:
                  input.retentionPolicy !== undefined
                    ? input.retentionDaysSnapshot
                    : existingObject.retentionDaysSnapshot,
                retainUntil:
                  input.retentionPolicy !== undefined
                    ? input.retainUntil
                    : existingObject.retainUntil,
                nextDeleteAttemptAt:
                  input.retentionPolicy !== undefined
                    ? input.retainUntil
                    : existingObject.nextDeleteAttemptAt,
                updatedAt: now,
              })
            : Promise.resolve(),
        ]);
        return {
          legacyAssetId: existingObject.legacyAssetId,
          mediaAssetId: existingVersion.mediaAssetId,
          assetVersionId: existingVersion._id,
          storageObjectId: existingObject._id,
          previousVersionId: existingVersion.parentVersionId,
        };
      }
    }
  }

  const now = Date.now();
  const legacyAssetId = await ctx.db.insert("assets", {
    userId: input.legacyAsset.userId,
    key: input.legacyAsset.key,
    bucket: input.legacyAsset.bucket,
    kind: input.legacyAsset.kind,
    contentType: input.legacyAsset.contentType,
    byteSize: input.legacyAsset.byteSize,
    publicUrl: input.legacyAsset.publicUrl,
    etag: input.legacyAsset.etag,
    status: input.legacyAsset.status,
  });
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
  const latestVersion = await ctx.db
    .query("assetVersions")
    .withIndex("by_media_version", (q) => q.eq("mediaAssetId", mediaAssetId))
    .order("desc")
    .first();
  const assetVersionId = await ctx.db.insert("assetVersions", {
    mediaAssetId,
    userId: input.legacyAsset.userId,
    version: (latestVersion?.version ?? 0) + 1,
    parentVersionId: existingMediaAsset?.currentVersionId ?? latestVersion?._id,
    generationJobId: input.generationJobId,
    origin: input.origin,
    status:
      input.versionStatus ??
      (input.legacyAsset.status === "active" ? "ready" : "deleted"),
    retentionDaysSnapshot: input.versionRetentionDaysSnapshot,
    createdAt: now,
    updatedAt: now,
  });
  const storageObjectId = await ctx.db.insert("storageObjects", {
    mediaAssetId,
    assetVersionId,
    userId: input.legacyAsset.userId,
    legacyAssetId,
    bucketRole: input.bucketRole,
    accountingCategory:
      input.accountingCategory ?? storageAccountingCategory(input.bucketRole, input.rendition),
    retentionPolicy:
      input.retentionPolicy ?? defaultRetentionPolicy(input.bucketRole, input.rendition),
    retentionDaysSnapshot: input.retentionDaysSnapshot,
    retainUntil: input.retainUntil,
    nextDeleteAttemptAt: input.retainUntil,
    bucket: input.legacyAsset.bucket,
    key: input.legacyAsset.key,
    rendition: input.rendition,
    contentType: input.legacyAsset.contentType,
    byteSize: input.legacyAsset.byteSize,
    width: input.width,
    height: input.height,
    checksum: input.checksum,
    etag: input.legacyAsset.etag,
    publicUrl: input.bucketRole === "public" ? input.legacyAsset.publicUrl : undefined,
    status:
      input.storageStatus ??
      (input.legacyAsset.status === "active" ? "ready" : "deleted"),
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    input.versionStatus === "processing"
      ? ctx.db.patch(mediaAssetId, { updatedAt: now })
      : ctx.db.patch(mediaAssetId, {
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
    previousVersionId: existingMediaAsset?.currentVersionId ?? latestVersion?._id,
  };
}

export type VersionStorageObjectInput = {
  bucketRole: StorageBucketRole;
  bucket: string;
  key: string;
  rendition: AssetRendition;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  checksum: string;
  etag?: string;
  accountingCategory?: StorageAccountingCategory;
  retentionPolicy?: StorageRetentionPolicy;
  retentionDaysSnapshot?: number;
  retainUntil?: number;
  status: "pending" | "ready" | "deleting" | "deleted" | "failed";
};

export async function upsertVersionStorageObjects(
  ctx: MutationCtx,
  input: {
    mediaAssetId: Id<"mediaAssets">;
    assetVersionId: Id<"assetVersions">;
    userId: Id<"users">;
    objects: VersionStorageObjectInput[];
  }
) {
  const now = Date.now();
  const objectIds: Id<"storageObjects">[] = [];
  for (const object of input.objects) {
    const existing = await ctx.db
      .query("storageObjects")
      .withIndex("by_version_role_rendition", (q) =>
        q
          .eq("assetVersionId", input.assetVersionId)
          .eq("bucketRole", object.bucketRole)
          .eq("rendition", object.rendition)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...object,
        accountingCategory:
          object.accountingCategory ??
          storageAccountingCategory(object.bucketRole, object.rendition),
        retentionPolicy:
          object.retentionPolicy ?? defaultRetentionPolicy(object.bucketRole, object.rendition),
        nextDeleteAttemptAt: object.retainUntil,
        publicUrl: object.bucketRole === "public" ? existing.publicUrl : undefined,
        updatedAt: now,
      });
      objectIds.push(existing._id);
      continue;
    }
    objectIds.push(
      await ctx.db.insert("storageObjects", {
        mediaAssetId: input.mediaAssetId,
        assetVersionId: input.assetVersionId,
        userId: input.userId,
        ...object,
        accountingCategory:
          object.accountingCategory ??
          storageAccountingCategory(object.bucketRole, object.rendition),
        retentionPolicy:
          object.retentionPolicy ?? defaultRetentionPolicy(object.bucketRole, object.rendition),
        nextDeleteAttemptAt: object.retainUntil,
        createdAt: now,
        updatedAt: now,
      })
    );
  }
  return objectIds;
}

function storageAccountingCategory(
  bucketRole: StorageBucketRole,
  rendition: AssetRendition
): StorageAccountingCategory {
  if (bucketRole !== "private") return "unmetered";
  return rendition === "original" ? "temporary-original" : "optimized";
}

function defaultRetentionPolicy(
  bucketRole: StorageBucketRole,
  rendition: AssetRendition
): StorageRetentionPolicy {
  if (bucketRole === "public") return "publication";
  if (bucketRole !== "private") return "unmanaged";
  return rendition === "original" ? "temporary-original" : "current-version";
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
