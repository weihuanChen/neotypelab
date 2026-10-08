import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const vContentSafetyReferenceTable = v.union(
  v.literal("promptCompositions"),
  v.literal("generationJobs")
);

/** Audit trail for prompt safety screening. Stores a hash, never the prompt text. */
export const recordScan = internalMutation({
  args: {
    subject: v.union(v.literal("text"), v.literal("image")),
    stage: v.string(),
    mode: v.union(v.literal("monitor"), v.literal("enforce")),
    blocked: v.boolean(),
    action: v.union(v.literal("allow"), v.literal("review"), v.literal("block")),
    reasonCode: v.string(),
    matchedCategories: v.array(v.string()),
    requestIds: v.array(v.string()),
    semanticStatus: v.optional(v.string()),
    promptSha256: v.string(),
    promptLength: v.number(),
    chunkCount: v.number(),
    blocklistTerms: v.optional(v.array(v.string())),
    referenceTable: v.optional(vContentSafetyReferenceTable),
    referenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: Id<"users"> | undefined;
    if (args.referenceId && args.referenceTable === "promptCompositions") {
      const id = ctx.db.normalizeId("promptCompositions", args.referenceId);
      userId = id ? (await ctx.db.get(id))?.userId : undefined;
    } else if (args.referenceId && args.referenceTable === "generationJobs") {
      const id = ctx.db.normalizeId("generationJobs", args.referenceId);
      userId = id ? (await ctx.db.get(id))?.userId : undefined;
    }
    await ctx.db.insert("contentSafetyScans", { ...args, userId });
  },
});
