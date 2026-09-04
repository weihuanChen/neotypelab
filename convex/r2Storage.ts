"use node";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  getPublicR2ObjectUrl,
  getR2ConnectionConfig,
  type R2BucketRole,
} from "./r2Config";

const DEFAULT_PRIVATE_DOWNLOAD_SECONDS = 15 * 60;
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

export async function createPrivateR2DownloadUrl({
  key,
  expiresInSeconds = DEFAULT_PRIVATE_DOWNLOAD_SECONDS,
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

function storageErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "R2 connection test failed";
  }
  const statusCode = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return statusCode ? `${error.message} (HTTP ${statusCode})` : error.message;
}
