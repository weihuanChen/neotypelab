"use node";

import { ConvexError, v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { executeTextRequest } from "./textGenerationNode";
import { normalizedUserIntentSystemPrompt } from "./creativeContracts";

export async function executeCompositionHandler(
  ctx: ActionCtx,
  { promptCompositionId }: { promptCompositionId: Id<"promptCompositions"> }
): Promise<void> {
  const claimed = await ctx.runMutation(internal.creativePipeline.claim, { promptCompositionId });
  if (!claimed) return;
  try {
    let userPrompt = claimed.composition.composedPrompt;
    let systemPrompt = claimed.systemPrompt;
    if (claimed.normalization) {
      const normalization = await executeTextRequest(ctx, {
        templateKind: "palette-plan", promptTemplateId: claimed.composition.promptTemplateId,
        systemPrompt: normalizedUserIntentSystemPrompt,
        userPrompt: JSON.stringify({ notes: claimed.normalization.notes, styleDescription: claimed.normalization.styleDescription,
          context: { style: claimed.normalization.style, material: claimed.normalization.material,
            weatheringLevel: claimed.normalization.weatheringLevel, selectionSources: claimed.normalization.selectionSources } }),
        jsonOutput: true, safetyReference: { table: "promptCompositions", id: promptCompositionId },
      });
      const resolved = await ctx.runMutation(internal.creativePipeline.resolveIntent, {
        promptCompositionId, normalizedNotesJson: JSON.stringify(normalization.json), executionJson: JSON.stringify(normalization),
      });
      if (!resolved) return;
      if ("error" in resolved) throw new Error(resolved.error);
      userPrompt = resolved.userPrompt;
      systemPrompt = resolved.systemPrompt;
    }
    const response = await executeTextRequest(ctx, {
      templateKind: claimed.kind, promptTemplateId: claimed.composition.promptTemplateId,
      systemPrompt, userPrompt, jsonOutput: true,
      safetyReference: { table: "promptCompositions", id: promptCompositionId },
    });
    const recorded = await ctx.runMutation(internal.creativePipeline.recordExecutionAttempt, {
      promptCompositionId, responseJson: JSON.stringify(response.json), executionJson: JSON.stringify(response),
    });
    if (!recorded) return;
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
