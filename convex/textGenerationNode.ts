"use node";

import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requestTextCompletion } from "./llmProtocol";

export type TextExecutionArgs = {
  templateKind: "style-suggestion" | "palette-plan" | "repaint-concept";
  promptTemplateId?: Id<"promptTemplates">;
  systemPrompt: string;
  userPrompt: string;
  jsonOutput?: boolean;
};

export async function executeTextRequest(
  ctx: ActionCtx,
  args: TextExecutionArgs
): Promise<Awaited<ReturnType<typeof requestTextCompletion>> & { profileId: string }> {
  const { route, policy } = await ctx.runQuery(internal.generation.getTextExecutionContext, {
    templateKind: args.templateKind,
    promptTemplateId: args.promptTemplateId,
  });
  const routes = policy.fallbackBehavior === "secondary-provider" && route.fallback
    ? [route.primary, route.fallback]
    : [route.primary];
  const attempts = policy.fallbackBehavior === "fail-job" ? 1 : policy.maxRetryCount + 1;
  let lastError: unknown;
  const deadline = Date.now() + 8 * 60 * 1000;

  for (const candidate of routes) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (Date.now() >= deadline) break;
      try {
        const result = await requestTextCompletion({
          ...args,
          profile: {
            ...candidate.profile,
            timeoutMs: Math.min(
              candidate.profile.timeoutMs ?? policy.timeoutMs,
              deadline - Date.now()
            ),
          },
          parameterOverridesJson: candidate.binding?.parameterOverridesJson,
        });
        return { ...result, profileId: candidate.profile._id };
      } catch (error) {
        lastError = error;
        if (error instanceof Error && /HTTP (400|401|403|404|422)\b/.test(error.message)) break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Text generation failed");
}
