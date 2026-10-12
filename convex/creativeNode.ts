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
        systemPrompt: normalizedUserIntentSystemPrompt + "\nWhen context.kit.source is custom, resolve named parts to the supplied stable part IDs in color and geometry scopes. Preserve geometry edit requirements as local part-scoped constraints. Unknown targets or whole-subject redesigns remain unresolved; the subject must remain a robot/mecha. Catalog kit geometry rules remain unchanged. Finish, material, weathering, pattern and mood use whole-kit scope unless the user explicitly restricts that property to a named part or surface group. Do not infer a local finish scope merely because the description mentions armor colors. For example, 'A clean matte finish.' means whole-kit finish=matte and whole-kit weathering=clean, even in a description listing armor colors. Original Style and Kit context are not evidence for a narrower user scope.",
        userPrompt: JSON.stringify({ notes: claimed.normalization.notes, styleDescription: claimed.normalization.styleDescription,
          context: { style: claimed.normalization.style, material: claimed.normalization.material, kit: claimed.normalization.kit,
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
