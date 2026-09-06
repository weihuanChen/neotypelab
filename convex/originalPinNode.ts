"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { copyR2Object, deleteR2Object, headR2Object } from "./r2Storage";

type PendingPin = {
  status: "pending";
  operationId: Id<"originalPinOperations">;
  sourceKey: string;
  destinationKey: string;
  contentType: string;
  creditCost: number;
};

export const keepOriginal = action({
  args: {
    storageObjectId: v.id("storageObjects"),
    expectedCreditCost: v.number(),
  },
  async handler(ctx, { expectedCreditCost, storageObjectId }): Promise<{
    status: "completed" | "already-pinned";
    creditCost: number;
    sourceCleaned: boolean;
  }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication is required");
    const source = await ctx.runQuery(internal.originalPin.authorizePinSource, {
      tokenIdentifier: identity.tokenIdentifier,
      storageObjectId,
    });
    if (source.status === "already-pinned") {
      return { status: "already-pinned", creditCost: 0, sourceCleaned: true };
    }
    const metadata = await headR2Object("private", source.key);
    if (typeof metadata.byteSize !== "number" || !Number.isInteger(metadata.byteSize) || metadata.byteSize <= 0) {
      throw new Error("Original file size could not be verified in storage");
    }
    const pending = await ctx.runMutation(internal.originalPin.begin, {
      tokenIdentifier: identity.tokenIdentifier,
      storageObjectId,
      verifiedByteSize: metadata.byteSize,
      expectedCreditCost,
    });
    if (pending.status === "already-pinned") {
      return { status: "already-pinned", creditCost: 0, sourceCleaned: true };
    }

    const operation = pending as PendingPin;
    let copied = false;
    try {
      const copiedObject = await copyR2Object({
        sourceRole: "private",
        sourceKey: operation.sourceKey,
        destinationRole: "private",
        destinationKey: operation.destinationKey,
        contentType: operation.contentType,
      });
      copied = true;
      await ctx.runMutation(internal.originalPin.complete, {
        operationId: operation.operationId,
        etag: copiedObject.etag,
      });
    } catch (error) {
      if (copied) {
        await deleteR2Object("private", operation.destinationKey).catch(() => undefined);
      }
      await ctx.runMutation(internal.originalPin.fail, {
        operationId: operation.operationId,
        errorMessage: error instanceof Error ? error.message : "Keep Original failed",
      });
      throw error;
    }

    let sourceCleaned = true;
    try {
      await deleteR2Object("private", operation.sourceKey);
    } catch {
      sourceCleaned = false;
    }
    return {
      status: "completed",
      creditCost: operation.creditCost,
      sourceCleaned,
    };
  },
});
