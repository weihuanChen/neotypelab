"use node";

import { ConvexError, v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { executeTextRequest } from "./textGenerationNode";

export async function executeCompositionHandler(
  ctx: ActionCtx,
  { promptCompositionId }: { promptCompositionId: Id<"promptCompositions"> }
): Promise<void> {
  const claimed = await ctx.runMutation(internal.creativePipeline.claim, { promptCompositionId });
  if (!claimed) return;
  try {
    const response = await executeTextRequest(ctx, {
      templateKind: claimed.kind, promptTemplateId: claimed.composition.promptTemplateId,
      systemPrompt: claimed.systemPrompt, userPrompt: claimed.composition.composedPrompt, jsonOutput: true,
    });
    await ctx.runMutation(internal.creativePipeline.complete, {
      promptCompositionId, responseJson: JSON.stringify(response.json), executionJson: JSON.stringify(response),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0].replace(/^(?:Uncaught Error:\s*)+/, "").slice(0,500) : "Text generation failed";
    await ctx.runMutation(internal.creativePipeline.fail, { promptCompositionId, reason });
    throw new ConvexError(reason);
  }
}

export const executeComposition = internalAction({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: executeCompositionHandler,
});
