"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteR2Object } from "./r2Storage";

const vCleanupMode = v.union(
  v.literal("delete-original"),
  v.literal("clean-old-versions"),
  v.literal("space-saver")
);

type CleanupTarget = {
  storageObjectId: Id<"storageObjects">;
  key: string;
};

export const cleanPrivateAsset = action({
  args: {
    mediaAssetId: v.id("mediaAssets"),
    mode: vCleanupMode,
  },
  async handler(ctx, { mediaAssetId, mode }): Promise<{ deleted: number; failed: number }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required");
    const targets: CleanupTarget[] = await ctx.runMutation(
      internal.assetMaintenance.claimPrivateAssetCleanup,
      { tokenIdentifier: identity.tokenIdentifier, mediaAssetId, mode }
    );
    if (targets.length === 0) return { deleted: 0, failed: 0 };
    const deletions = await Promise.allSettled(
      targets.map((target) => deleteR2Object("private", target.key))
    );
    return await ctx.runMutation(internal.assetMaintenance.completePrivateAssetCleanup, {
      mediaAssetId,
      mode,
      results: targets.map((target, index) => {
        const deletion = deletions[index];
        return deletion.status === "fulfilled"
          ? { storageObjectId: target.storageObjectId, ok: true }
          : {
              storageObjectId: target.storageObjectId,
              ok: false,
              errorMessage: deletion.reason instanceof Error
                ? deletion.reason.message
                : "R2 deletion did not complete",
            };
      }),
    });
  },
});
