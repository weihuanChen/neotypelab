import type { MutationCtx, QueryCtx } from "./types";
import type { PipelineAction } from "./domain";
import type { Doc, Id } from "./_generated/dataModel";

type ReadCtx = MutationCtx | QueryCtx;

export async function resolvePipelineTemplate(ctx: ReadCtx, action: PipelineAction) {
  const bindings = await ctx.db
    .query("pipelineTemplateBindings")
    .withIndex("by_action", (q) => q.eq("action", action))
    .collect();
  const binding = bindings
    .filter((item) => item.isActive && item.effectiveFrom <= Date.now())
    .sort((a, b) => b.effectiveFrom - a.effectiveFrom || b.updatedAt - a.updatedAt)[0];

  if (binding) {
    const candidateIds = [
      binding.promptTemplateId,
      binding.fallbackPromptTemplateId,
    ].filter((id): id is NonNullable<typeof id> => id !== undefined);
    for (const templateId of candidateIds) {
      const template = await ctx.db.get(templateId);
      if (template === null || !template.isActive || template.kind !== action) continue;

      if (
        templateId === binding.promptTemplateId &&
        binding.versionPolicy === "pin-version" &&
        binding.promptTemplateVersionId
      ) {
        const pinned = await ctx.db.get(binding.promptTemplateVersionId);
        if (pinned && pinned.promptTemplateId === template._id) {
          return mergeTemplateVersion(template, pinned);
        }
      }

      if (template.publishedVersionId) {
        const published = await ctx.db.get(template.publishedVersionId);
        if (published && published.promptTemplateId === template._id) {
          return mergeTemplateVersion(template, published);
        }
      }
      return { ...template, promptTemplateVersionId: undefined };
    }
  }

  const fallback = await ctx.db
    .query("promptTemplates")
    .withIndex("by_kind", (q) => q.eq("kind", action))
    .collect()
    .then((items) => items.find((item) => item.isActive) ?? null);
  if (fallback?.publishedVersionId) {
    const published = await ctx.db.get(fallback.publishedVersionId);
    if (published && published.promptTemplateId === fallback._id) {
      return mergeTemplateVersion(fallback, published);
    }
  }
  return fallback ? { ...fallback, promptTemplateVersionId: undefined } : null;
}

export async function assertGenerationCapacity(ctx: ReadCtx, userId: Id<"users">) {
  const [jobs, settings] = await Promise.all([
    ctx.db
      .query("generationJobs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "generation"))
      .collect(),
  ]);
  const current = settings.sort(
    (a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt
  )[0];
  let limit = 2;
  if (current) {
    try {
      const parsed = JSON.parse(current.valueJson) as Record<string, unknown>;
      if (
        typeof parsed.concurrentJobsPerUser === "number" &&
        Number.isFinite(parsed.concurrentJobsPerUser)
      ) {
        limit = Math.min(10, Math.max(1, Math.round(parsed.concurrentJobsPerUser)));
      }
    } catch {
      limit = 2;
    }
  }
  const activeCount = jobs.filter(
    (job) => job.status === "queued" || job.status === "running"
  ).length;
  if (activeCount >= limit) {
    throw new Error(
      `This account already has ${activeCount} active generation job${activeCount === 1 ? "" : "s"}. The current limit is ${limit}.`
    );
  }
}

function mergeTemplateVersion(
  template: Doc<"promptTemplates">,
  version: Doc<"promptTemplateVersions">
) {
  return {
    ...template,
    version: version.version,
    systemPrompt: version.systemPrompt,
    userPromptTemplate: version.userPromptTemplate,
    negativePromptTemplate: version.negativePromptTemplate,
    notePolicy: version.notePolicy,
    promptTemplateVersionId: version._id,
  };
}
