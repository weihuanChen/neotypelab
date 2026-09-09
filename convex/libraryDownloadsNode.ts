"use node";

import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client, type CORSRule } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { getR2ConnectionConfig } from "./r2Config";

export const inspectCors = internalAction({
  args: {},
  handler: async () => {
    const config = getR2ConnectionConfig();
    const client = new S3Client({ region: "auto", endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
    try {
      const result = await client.send(new GetBucketCorsCommand({ Bucket: config.buckets.private }));
      return result.CORSRules ?? [];
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return [];
      throw new Error(`Could not inspect download CORS (HTTP ${status ?? "unknown"})`);
    }
  },
});

/** Deployment-only configuration: preserves other rules, adds exact app origins,
 * and permits only reads. Signed object URLs still enforce access. */
export const configureCors = internalAction({
  args: { origins: v.array(v.string()) },
  handler: async (_, { origins }) => {
    if (!origins.length) throw new Error("At least one exact application origin is required");
    const allowed = Array.from(new Set(origins.map(origin => {
      const url = new URL(origin);
      if (url.origin !== origin || url.username || url.password ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
        throw new Error("Use exact HTTPS application origins (HTTP is supported only on localhost)");
      }
      return url.origin;
    })));
    const config = getR2ConnectionConfig();
    const client = new S3Client({ region: "auto", endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
    let rules: CORSRule[];
    try {
      rules = (await client.send(new GetBucketCorsCommand({ Bucket: config.buckets.private }))).CORSRules ?? [];
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      rules = [];
    }
    const ruleId = "neotypelab-library-downloads";
    const previous = rules.find(rule => rule.ID === ruleId);
    const rule = { ID: ruleId, AllowedOrigins: Array.from(new Set([...(previous?.AllowedOrigins ?? []), ...allowed])),
      AllowedMethods: ["GET", "HEAD"], ExposeHeaders: ["Content-Length", "Content-Type", "Content-Disposition"], MaxAgeSeconds: 3600 };
    await client.send(new PutBucketCorsCommand({ Bucket: config.buckets.private, CORSConfiguration: { CORSRules: [...rules.filter(item => item.ID !== ruleId), rule] } }));
    return { origins: rule.AllowedOrigins, methods: rule.AllowedMethods };
  },
});
