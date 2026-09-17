"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const execute = internalAction({
  args: { runId: v.id("creationRuns"), attempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.runMutation(internal.creationRuns.claim, args);
    if (!run) return;
    try {
      if (run.stage === "render") {
        if (!run.renderJobId) throw new Error("Render task missing");
        await ctx.runAction(internal.generationNode.executeQueuedJob, { generationJobId: run.renderJobId });
      } else {
        const id = run.stage === "palette" ? run.paletteId : run.specificationId;
        if (!id) throw new Error("Planning task missing");
        await ctx.runAction(internal.creativeNode.executeComposition, { promptCompositionId: id });
      }
      await ctx.runMutation(internal.creationRuns.advance, args);
    } catch (error) {
      const reason = error instanceof Error ? error.message.split("\n")[0].replace(/^(?:Uncaught Error:\s*)+/, "") : "Preview failed";
      await ctx.runMutation(internal.creationRuns.fail, { ...args, reason });
    }
  },
});
