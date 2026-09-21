import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const creationWorkflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 4,
    retryActionsByDefault: false,
  },
});
