import { v } from "convex/values";
import { internal } from "./_generated/api";
import { creationWorkflowManager } from "./workflowManager";

export const execute = creationWorkflowManager
  .define({
    args: {
      runId: v.id("creationRuns"),
      attempt: v.number(),
    },
    returns: v.null(),
  })
  .handler(async (step, args): Promise<null> => {
    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      const stage = await step.runMutation(
        internal.creationRuns.claimWorkflowStage,
        args,
        { name: `claim-generation-stage-${stepIndex}` }
      );
      if (!stage) return null;

      if (stage.kind === "render") {
        await step.runAction(
          internal.generationNode.executeQueuedJob,
          { generationJobId: stage.generationJobId },
          { name: `render-image-${stepIndex}`, retry: false }
        );
      } else {
        await step.runAction(
          internal.creativeNode.executeComposition,
          { promptCompositionId: stage.promptCompositionId },
          { name: `${stage.kind}-text-${stepIndex}`, retry: false }
        );
      }

      const status = await step.runMutation(
        internal.creationRuns.advanceWorkflow,
        args,
        { name: `advance-generation-stage-${stepIndex}` }
      );
      if (status !== "queued") return null;
    }

    throw new Error("Creation workflow exceeded its configured stage count");
  });
