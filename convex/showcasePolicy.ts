import { z } from "zod";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { hasIndexableStyle } from "./creativeContracts";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";

export const SHOWCASE_INDEX_DELAY_MS = 72 * 60 * 60 * 1000;

const readablePaintPlan = z.object({
  entries: z.array(z.object({
    roleSlug: z.string().trim().min(1),
    roleName: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  })).min(1),
  sprayNotes: z.array(z.string().trim().min(1)).min(1),
});

export function hasReadablePaintPlan(json?: string) {
  if (!json) return false;
  try {
    return readablePaintPlan.safeParse(JSON.parse(json)).success;
  } catch {
    return false;
  }
}

export function isSharedShowcaseConcept(concept: Doc<"concepts"> | null) {
  return concept !== null && concept.activePublicationId !== undefined &&
    concept.showcaseReviewStatus !== "hidden" &&
    (concept.visibility === "public" || concept.visibility === "unlisted") &&
    (concept.status === "generated" || concept.status === "archived");
}

// Recheck mutable dependencies at read time. A materialized flag alone must never
// expose a stale sitemap entry after a catalog, rendition or review change.
export async function passesShowcaseIndexQuality(ctx: QueryCtx, concept: Doc<"concepts">): Promise<boolean> {
  if (!isSharedShowcaseConcept(concept) || concept.visibility !== "public" ||
    (concept.showcaseReviewStatus && concept.showcaseReviewStatus !== "clear") ||
    !concept.title.trim() || !hasIndexableStyle(concept) ||
    !hasReadablePaintPlan(concept.palettePlanJson) || !concept.baseModelId ||
    !concept.stylePresetId || !concept.activePublicationId) return false;

  const [model, style, publication] = await Promise.all([
    ctx.db.get(concept.baseModelId), ctx.db.get(concept.stylePresetId),
    ctx.db.get(concept.activePublicationId),
  ]);
  if (!model?.name.trim() || !isPublicModelCatalogRecord(model) ||
    !style?.isActive || !style.name.trim() || !publication ||
    publication.status !== "published" || publication.visibility !== "public" ||
    publication.conceptId !== concept._id || publication.userId !== concept.userId ||
    publication.assetVersionId !== concept.currentAssetVersionId) return false;

  const version = await ctx.db.get(publication.assetVersionId);
  const job = version?.generationJobId ? await ctx.db.get(version.generationJobId) : null;
  if (version?.status !== "ready" || job?.kind !== "hd-preview" ||
    job.status !== "succeeded" || job.conceptId !== concept._id) return false;
  const renditions = await ctx.db.query("storageObjects")
    .withIndex("by_publicationId", q => q.eq("publicationId", publication._id)).take(10);
  return ["master", "preview", "thumbnail"].every(rendition => renditions.some(object =>
    object.bucketRole === "public" && object.status === "ready" &&
    object.assetVersionId === publication.assetVersionId && object.rendition === rendition && Boolean(object.publicUrl)
  ));
}

export async function isShowcaseIndexEligible(ctx: QueryCtx, concept: Doc<"concepts">): Promise<boolean> {
  return concept.indexEligible === true && concept.publicSince !== undefined &&
    await passesShowcaseIndexQuality(ctx, concept);
}
