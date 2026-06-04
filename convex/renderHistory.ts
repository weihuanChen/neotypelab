import { v } from "convex/values";
import { vRenderMode, vSimulationStage } from "./domain";
import { query } from "./functions";

export const listForViewerConcepts = query({
  args: {
    conceptIds: v.array(v.id("concepts")),
  },
  async handler(ctx, { conceptIds }) {
    if (ctx.viewer === null || conceptIds.length === 0) {
      return [];
    }

    const uniqueConceptIds = Array.from(new Set(conceptIds));
    const results = await Promise.all(
      uniqueConceptIds.map(async (conceptId) => {
        const concept = await ctx.db.get(conceptId);
        if (concept === null || concept.userId !== ctx.viewerX()._id) {
          return null;
        }

        const outputs = await ctx.db
          .query("renderOutputs")
          .withIndex("by_user_concept", (q) =>
            q.eq("userId", ctx.viewerX()._id).eq("conceptId", conceptId)
          )
          .collect();

        const hydratedOutputs = await Promise.all(
          outputs
            .filter((output) => output.status === "available")
            .sort((left, right) => right._creationTime - left._creationTime)
            .map(async (output) => {
              const [asset, job] = await Promise.all([
                ctx.db.get(output.assetId),
                ctx.db.get(output.generationJobId),
              ]);

              return {
                _id: output._id,
                _creationTime: output._creationTime,
                conceptId: output.conceptId,
                generationJobId: output.generationJobId,
                renderMode: output.renderMode,
                simulationStage: output.simulationStage,
                label: output.label,
                status: output.status,
                summary: safeOutputSummary(output.summaryJson),
                asset: asset
                  ? {
                      _id: asset._id,
                      key: asset.key,
                      contentType: asset.contentType,
                      publicUrl: asset.publicUrl,
                      status: asset.status,
                    }
                  : null,
                job: job
                  ? {
                      _id: job._id,
                      status: job.status,
                      provider: job.provider,
                      requestedCredits: job.requestedCredits,
                    }
                  : null,
              };
            })
        );

        return {
          conceptId,
          outputs: hydratedOutputs,
        };
      })
    );

    return results.filter((result): result is NonNullable<typeof result> => result !== null);
  },
});

export const getViewerConceptRenderHistory = query({
  args: {
    conceptId: v.id("concepts"),
    renderMode: v.optional(vRenderMode),
    simulationStage: v.optional(vSimulationStage),
  },
  async handler(ctx, { conceptId, renderMode, simulationStage }) {
    if (ctx.viewer === null) {
      return null;
    }

    const concept = await ctx.db.get(conceptId);
    if (concept === null || concept.userId !== ctx.viewerX()._id) {
      return null;
    }

    const outputs = await ctx.db
      .query("renderOutputs")
      .withIndex("by_user_concept", (q) =>
        q.eq("userId", ctx.viewerX()._id).eq("conceptId", conceptId)
      )
      .collect();

    const filteredOutputs = outputs
      .filter((output) => output.status === "available")
      .filter((output) => renderMode === undefined || output.renderMode === renderMode)
      .filter((output) => simulationStage === undefined || output.simulationStage === simulationStage)
      .sort((left, right) => right._creationTime - left._creationTime);

    const hydratedOutputs = await Promise.all(
      filteredOutputs.map(async (output) => {
        const [asset, job] = await Promise.all([
          ctx.db.get(output.assetId),
          ctx.db.get(output.generationJobId),
        ]);

        return {
          _id: output._id,
          _creationTime: output._creationTime,
          conceptId: output.conceptId,
          generationJobId: output.generationJobId,
          renderMode: output.renderMode,
          simulationStage: output.simulationStage,
          label: output.label,
          status: output.status,
          summary: safeOutputSummary(output.summaryJson),
          asset: asset
            ? {
                _id: asset._id,
                key: asset.key,
                contentType: asset.contentType,
                publicUrl: asset.publicUrl,
                status: asset.status,
              }
            : null,
          job: job
            ? {
                _id: job._id,
                status: job.status,
                provider: job.provider,
                requestedCredits: job.requestedCredits,
              }
            : null,
        };
      })
    );

    return {
      conceptId,
      conceptTitle: concept.title,
      outputs: hydratedOutputs,
    };
  },
});

function safeOutputSummary(summaryJson?: string) {
  if (!summaryJson) {
    return null;
  }
  try {
    return JSON.parse(summaryJson) as {
      generationKind?: string;
      label?: string;
      layoutSpec?: string;
      materialComparisonVariants?: Array<{
        name: string;
        slug: string;
        finishType: string;
        reflectivityLevel?: string;
        paintFinish?: string;
        difficultyLevel?: string;
        sheenLevel?: string;
        role?: "current" | "comparison";
      }>;
      mimeType?: string;
      phase?: string;
      provider?: string;
      renderMode?: string;
      revisedPrompt?: string;
      simulationStage?: string;
      templateVersion?: string;
    };
  } catch {
    return null;
  }
}
