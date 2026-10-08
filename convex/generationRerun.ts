import { v } from "convex/values";
import { internalMutation } from "./functions";
import { debitCredits, listGenerationJobDebits } from "./creditLedger";
import { assertGenerationCapacity } from "./pipelineSettings";
import { internal } from "./_generated/api";

/**
 * Authorize and claim a retry of a failed standalone render job.
 *
 * Only the job owner may retry, and only a failed `hd-preview` job that is not
 * part of a creation run (runs retry through `creationRuns.retry`). If the
 * failed attempt was refunded, the retry is charged again; a retry that fails
 * is then refunded through the normal failure path. Claiming moves the job to
 * `queued` and schedules execution in the same transaction (as a new render
 * does), so a concurrent second retry is a no-op and a charged retry can never
 * be left without an execution.
 */
export const claimJobRerun = internalMutation({
  args: { generationJobId: v.id("generationJobs") },
  handler: async (ctx, { generationJobId }): Promise<{ claimed: boolean }> => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
    const job = await ctx.db.get(generationJobId);
    if (!job || job.userId !== viewer._id) throw new Error("Generation job not found");
    if (job.creationRunId) throw new Error("Retry this build from its preview run");
    if (job.kind !== "hd-preview") throw new Error("This generation cannot be retried. Start a new build instead.");
    if (job.status !== "failed") return { claimed: false };

    await assertGenerationCapacity(ctx, viewer._id);

    const debits = await listGenerationJobDebits(ctx, viewer._id, generationJobId);
    const stillCharged = debits.some((entry) => !entry.refunded);
    if (!stillCharged && job.requestedCredits > 0) {
      const latest = debits.at(-1)?.debit;
      await debitCredits(ctx, {
        userId: viewer._id,
        // Reuse the original tariff's action type; legacy jobs without a linked debit fall back to HD render.
        actionType: latest?.actionType ?? "generate-hd-render",
        amount: job.requestedCredits,
        insufficientMessage: `Insufficient credits. ${job.requestedCredits} credits required to retry.`,
        metadata: {
          referenceTable: "generationJobs",
          referenceId: generationJobId,
          description: "Retried failed generation job",
          generationJobId,
          conceptId: job.conceptId,
          sourceType: "generation-spend",
        },
      });
    }

    await ctx.db.patch(generationJobId, { status: "queued", errorMessage: undefined });
    await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, { generationJobId });
    return { claimed: true };
  },
});
