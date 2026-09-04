"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getR2ConnectionConfig } from "./r2Config";
import {
  createPrivateR2DownloadUrl,
  PRIVATE_DOWNLOAD_URL_TTL_SECONDS,
} from "./r2Storage";

export const createPrivateDownloadUrl = action({
  args: {
    storageObjectId: v.id("storageObjects"),
  },
  handler: async (ctx, { storageObjectId }): Promise<{
    url: string;
    expiresAt: number;
    contentType?: string;
    rendition: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required");
    const authorized = await ctx.runQuery(internal.assets.authorizePrivateDownload, {
      storageObjectId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!authorized) {
      throw new Error("Private asset not found or access denied");
    }
    if (authorized.bucket !== getR2ConnectionConfig().buckets.private) {
      throw new Error("Private asset belongs to a different storage environment");
    }
    const url = await createPrivateR2DownloadUrl({ key: authorized.key });
    return {
      url,
      expiresAt: Date.now() + PRIVATE_DOWNLOAD_URL_TTL_SECONDS * 1000,
      contentType: authorized.contentType,
      rendition: authorized.rendition,
    };
  },
});
