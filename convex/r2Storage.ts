"use node";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { LifecycleRule } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  getPublicR2ObjectUrl,
  getR2ConnectionConfig,
  type R2BucketRole,
} from "./r2Config";

export const PRIVATE_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
const MAX_PRIVATE_DOWNLOAD_SECONDS = 60 * 60;

export type R2UploadInput = {
  buffer: Buffer;
  contentType: string;
  key: string;
};

export type R2HealthResult = {
  role: R2BucketRole;
  bucket: string;
  ok: boolean;
  latencyMs: number;
  message: string;
};

export async function uploadR2Object(role: R2BucketRole, input: R2UploadInput) {
  const config = getR2ConnectionConfig();
  const bucket = config.buckets[role];
  const result = await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.buffer,
      ContentType: input.contentType,
    })
  );

  return {
    key: input.key,
    bucket,
    etag: result.ETag,
    publicUrl: role === "public" ? getPublicR2ObjectUrl(input.key) : undefined,
  };
}

export async function deleteR2Object(role: R2BucketRole, key: string) {
  const config = getR2ConnectionConfig();
  await createR2Client(config).send(
    new DeleteObjectCommand({
      Bucket: config.buckets[role],
      Key: key,
    })
  );
}

export async function listR2Objects({
  role,
  prefix,
  continuationToken,
  maxKeys = 100,
}: {
  role: R2BucketRole;
  prefix: string;
  continuationToken?: string;
  maxKeys?: number;
}) {
  const config = getR2ConnectionConfig();
  const result = await createR2Client(config).send(
    new ListObjectsV2Command({
      Bucket: config.buckets[role],
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: Math.min(500, Math.max(1, Math.round(maxKeys))),
    })
  );
  return {
    bucket: config.buckets[role],
    keys: (result.Contents ?? []).flatMap((object) => object.Key ? [object.Key] : []),
    nextContinuationToken: result.NextContinuationToken,
  };
}

export async function ensureTemporaryOriginalLifecycleFallback(days = 365) {
  const fallbackDays = Math.min(3650, Math.max(180, Math.round(days)));
  const config = getR2ConnectionConfig();
  const client = createR2Client(config);
  let rules: LifecycleRule[] = [];
  try {
    const current = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.buckets.private })
    );
    rules = current.Rules ?? [];
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (statusCode !== 404) throw error;
  }
  const id = "neotypelab-temporary-original-fallback";
  const retainedRules = rules.filter((rule) => rule.ID !== id);
  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: config.buckets.private,
      LifecycleConfiguration: {
        Rules: [
          ...retainedRules,
          {
            ID: id,
            Status: "Enabled",
            Filter: { Prefix: "temporary-originals/" },
            Expiration: { Days: fallbackDays },
          },
        ],
      },
    })
  );
  return { bucket: config.buckets.private, id, days: fallbackDays };
}

export async function copyR2Object({
  sourceRole,
  sourceKey,
  destinationRole,
  destinationKey,
  contentType,
  cacheControl,
}: {
  sourceRole: R2BucketRole;
  sourceKey: string;
  destinationRole: R2BucketRole;
  destinationKey: string;
  contentType: string;
  cacheControl?: string;
}) {
  const config = getR2ConnectionConfig();
  const result = await createR2Client(config).send(
    new CopyObjectCommand({
      Bucket: config.buckets[destinationRole],
      Key: destinationKey,
      CopySource: encodeCopySource(config.buckets[sourceRole], sourceKey),
      MetadataDirective: "REPLACE",
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return {
    key: destinationKey,
    bucket: config.buckets[destinationRole],
    etag: result.CopyObjectResult?.ETag,
    publicUrl:
      destinationRole === "public" ? getPublicR2ObjectUrl(destinationKey) : undefined,
  };
}

export async function purgePublicR2Urls(urls: string[]) {
  const zoneId = process.env.CLOUDFLARE_CACHE_PURGE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_CACHE_PURGE_TOKEN?.trim();
  if (urls.length === 0 || !zoneId || !token) {
    return { status: "skipped" as const };
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    }
  );
  if (!response.ok) {
    throw new Error(`Cloudflare cache purge failed with HTTP ${response.status}`);
  }
  return { status: "purged" as const };
}

export async function createPrivateR2DownloadUrl({
  key,
  expiresInSeconds = PRIVATE_DOWNLOAD_URL_TTL_SECONDS,
}: {
  key: string;
  expiresInSeconds?: number;
}) {
  const config = getR2ConnectionConfig();
  const expiresIn = Math.min(
    MAX_PRIVATE_DOWNLOAD_SECONDS,
    Math.max(1, Math.round(expiresInSeconds))
  );
  return await getSignedUrl(
    createR2Client(config),
    new GetObjectCommand({
      Bucket: config.buckets.private,
      Key: key,
    }),
    { expiresIn }
  );
}

export async function checkR2StorageConnectivity(): Promise<R2HealthResult[]> {
  const config = getR2ConnectionConfig();
  const client = createR2Client(config);
  return await Promise.all(
    (["public", "private"] as const).map(async (role) => {
      const bucket = config.buckets[role];
      const key = `_connectivity-tests/${Date.now()}-${randomUUID()}.txt`;
      const body = `NeotypeLab R2 connectivity test: ${role}`;
      const startedAt = Date.now();
      let uploaded = false;
      try {
        await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "text/plain",
            Metadata: { purpose: "connectivity-test" },
          })
        );
        uploaded = true;
        const fetched = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const fetchedBody = await fetched.Body?.transformToString();
        if (fetchedBody !== body) {
          throw new Error("Downloaded test object did not match the uploaded content");
        }
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        uploaded = false;
        return {
          role,
          bucket,
          ok: true,
          latencyMs: Date.now() - startedAt,
          message: "List, write, read, and delete succeeded",
        };
      } catch (error) {
        return {
          role,
          bucket,
          ok: false,
          latencyMs: Date.now() - startedAt,
          message: storageErrorMessage(error),
        };
      } finally {
        if (uploaded) {
          try {
            await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          } catch {
            // The health result already reports the primary failure.
          }
        }
      }
    })
  );
}

function createR2Client(config: ReturnType<typeof getR2ConnectionConfig>) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function encodeCopySource(bucket: string, key: string) {
  return `${encodeURIComponent(bucket)}/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function storageErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "R2 connection test failed";
  }
  const statusCode = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return statusCode ? `${error.message} (HTTP ${statusCode})` : error.message;
}
