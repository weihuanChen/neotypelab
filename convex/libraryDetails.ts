import { v } from "convex/values";
import { query } from "./functions";
import { resolveEffectiveEntitlements } from "./entitlements";
import { repaintSchema } from "./creativeContracts";
import type { Doc } from "./_generated/dataModel";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import {
  buildPaintRecommendationSets,
  paintRecommendationSetsSchema,
  visualPaletteFromLegacyPlan,
  visualPaletteSchema,
} from "./paintRecommendationEngine";
import { styleDisplayName } from "./styleRefinements";

function objectJson(value?: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function text(value: unknown) { return typeof value === "string" ? value : null; }
function httpUrl(value?: string) { return value && /^https?:\/\//.test(value) ? value : null; }

/** Owner-only read model. Resource collections follow media assets and their versions,
 * so future reference images, masks and exports do not require new page-level queries. */
export const get = query({
  args: { conceptId: v.string() },
  handler: async (ctx, { conceptId }) => {
    if (!ctx.viewer) return null;
    const id = ctx.db.normalizeId("concepts", conceptId);
    if (!id) return null;
    const concept = await ctx.db.get(id);
    if (!concept || concept.userId !== ctx.viewer._id) return null;
    const ownerId = ctx.viewer._id;
    const [kit, style, material, assets, jobs, compositions, paletteComposition, legacy, entitlements, sprayPlans, paintMappings] = await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      ctx.db.query("mediaAssets").withIndex("by_conceptId", q => q.eq("conceptId", id)).collect(),
      ctx.db.query("generationJobs").withIndex("by_conceptId", q => q.eq("conceptId", id)).collect(),
      ctx.db.query("promptCompositions").withIndex("by_conceptId", q => q.eq("conceptId", id)).collect(),
      concept.paletteCompositionId ? ctx.db.get(concept.paletteCompositionId) : null,
      concept.previewAssetId ? ctx.db.get(concept.previewAssetId) : null,
      resolveEffectiveEntitlements(ctx, ownerId),
      ctx.db.query("sprayPlans").withIndex("by_conceptId", q => q.eq("conceptId", id)).collect(),
      listResolvedPaintMappings(ctx),
    ]);
    // Older records can have a media pointer without the reverse concept association.
    if (concept.mediaAssetId && !assets.some(asset => asset._id === concept.mediaAssetId)) {
      const attached = await ctx.db.get(concept.mediaAssetId);
      if (attached && (!attached.conceptId || attached.conceptId === id)) assets.push(attached);
    }
    const collections = await Promise.all(assets.filter(asset => asset.userId === ownerId && asset.status === "active").map(async asset => {
      const [versions, objects] = await Promise.all([
        ctx.db.query("assetVersions").withIndex("by_mediaAssetId", q => q.eq("mediaAssetId", asset._id)).collect(),
        ctx.db.query("storageObjects").withIndex("by_mediaAssetId", q => q.eq("mediaAssetId", asset._id)).collect(),
      ]);
      return {
        id: asset._id, kind: asset.kind, title: asset.title ?? (asset.kind === "generated-image" ? "Rendered images" : "Work resources"),
        versions: versions.filter(version => version.userId === ownerId && version.status !== "deleted")
          .sort((a,b) => b.version - a.version).map(version => ({
            id: version._id, version: version.version, createdAt: version.createdAt, origin: version.origin, status: version.status,
            current: version._id === (asset._id === concept.mediaAssetId ? concept.currentAssetVersionId : asset.currentVersionId),
            files: objects.filter(file => file.assetVersionId === version._id && file.userId === ownerId && file.bucketRole === "private" && file.status !== "deleted")
              .map(file => {
                const expired = Boolean(file.retainUntil && file.retainUntil <= Date.now());
                const restricted = file.rendition === "original" && !entitlements.originalDownloadAllowed;
                return { id: file._id, rendition: file.rendition, contentType: file.contentType ?? null,
                  bytes: file.byteSize ?? null, width: file.width ?? null, height: file.height ?? null,
                  retainUntil: file.retainUntil ?? null, status: file.status,
                  canDownload: version.status === "ready" && file.status === "ready" && !expired && !restricted,
                  unavailableReason: expired ? "Retention period ended" : restricted ? "Original downloads are unavailable on your plan"
                    : version.status !== "ready" || file.status !== "ready" ? "File is not ready" : null,
                };
              }),
          })),
      };
    }));
    const current = collections.find(asset => asset.id === concept.mediaAssetId)?.versions.find(version => version.current);
    const preview = current?.files.find(file => file.rendition === "master" && file.canDownload)
      ?? current?.files.find(file => file.rendition === "preview" && file.canDownload);
    const safeLegacy = legacy?.userId === ownerId && legacy.status === "active" ? legacy : null;
    // Legacy private objects still pass the same owner/readiness checks before signing.
    const legacyObject = !preview && safeLegacy?.storageObjectId ? await ctx.db.get(safeLegacy.storageObjectId) : null;
    const readableLegacyObject = legacyObject?.userId === ownerId && legacyObject.bucketRole === "private" && legacyObject.status === "ready"
      && (!legacyObject.retainUntil || legacyObject.retainUntil > Date.now())
      && (legacyObject.rendition !== "original" || entitlements.originalDownloadAllowed) ? legacyObject : null;
    const visualPaletteResult = concept.visualPaletteJson
      ? visualPaletteSchema.safeParse(objectJson(concept.visualPaletteJson))
      : null;
    const visualPalette = visualPaletteResult?.success
      ? visualPaletteResult.data
      : visualPaletteFromLegacyPlan(concept.palettePlanJson);
    const storedRecommendations = concept.paintRecommendationSetsJson
      ? paintRecommendationSetsSchema.safeParse(objectJson(concept.paintRecommendationSetsJson))
      : null;
    let paintRecommendations = storedRecommendations?.success ? storedRecommendations.data : null;
    if (visualPalette) {
      try {
        const live = buildPaintRecommendationSets(visualPalette, paintMappings);
        const liveCoverage = Math.max(0, ...live.sets.map((set) => set.coverageCount));
        if (live.sets.length > 0 && (liveCoverage > 0 || !paintRecommendations)) {
          paintRecommendations = live;
        }
      } catch {
        paintRecommendations = storedRecommendations?.success ? storedRecommendations.data : null;
      }
    }
    const rawSpec = objectJson(concept.renderSpecificationJson);
    const specResult = repaintSchema.safeParse({ summary: rawSpec.summary, panels: rawSpec.panels, material: rawSpec.material, weathering: rawSpec.weathering, decals: rawSpec.decals });
    const compositionById = new Map(compositions.filter(c => c.userId === ownerId).map(c => [c._id, c]));
    const history = jobs.filter(job => job.userId === ownerId).map(job => {
      const composition = job.promptCompositionId ? compositionById.get(job.promptCompositionId) : undefined;
      return historyEntry(job, composition);
    });
    if (paletteComposition?.userId === ownerId) {
      const output = objectJson(paletteComposition.outputSummaryJson);
      const execution = objectJson(JSON.stringify(output.execution ?? {}));
      history.push({ id: paletteComposition._id, createdAt: paletteComposition._creationTime,
        label: "Palette plan", status: paletteComposition.status === "consumed" ? "succeeded" : paletteComposition.status,
        credits: paletteComposition.reservedCredits ?? null, model: text(execution.model),
        templateVersion: text(output.templateVersion), error: paletteComposition.failureReason ?? null });
    }
    history.sort((a,b) => b.createdAt - a.createdAt);
    return {
      id: concept._id, title: concept.title, recordNumber: concept.recordNumber ?? null, createdAt: concept._creationTime,
      status: concept.status, visibility: concept.visibility, notes: concept.notes ?? null,
      mood: concept.moodTags ?? [], weathering: concept.weatheringLevel,
      kit: kit ? { name: kit.name, grade: kit.grade ?? null, scale: kit.scale ?? null, manufacturer: kit.manufacturer ?? null } : null,
      style: styleDisplayName(style, concept.styleIntentJson), material: material?.name ?? null,
      hero: { storageObjectId: preview?.id ?? readableLegacyObject?._id ?? null,
        publicUrl: preview || readableLegacyObject ? null : httpUrl(safeLegacy?.publicUrl),
        width: preview?.width ?? readableLegacyObject?.width ?? null, height: preview?.height ?? readableLegacyObject?.height ?? null,
        version: current?.version ?? null },
      palette: visualPalette,
      paintRecommendations,
      specification: specResult.success ? specResult.data : null,
      collections, history,
      documents: sprayPlans.filter(plan => plan.userId === ownerId).map(plan => ({ id: plan._id, title: plan.title, version: plan.currentVersion, status: plan.status })),
    };
  },
});

type HistoryEntry = { id: string; createdAt: number; label: string; status: string; credits: number | null; model: string | null; templateVersion: string | null; error: string | null };

function historyEntry(job: Doc<"generationJobs">, composition?: Doc<"promptCompositions">): HistoryEntry {
  const input = objectJson(job.inputSnapshotJson);
  const output = objectJson(job.outputSummaryJson);
  const composedOutput = objectJson(composition?.outputSummaryJson);
  const execution = objectJson(JSON.stringify(composedOutput.execution ?? {}));
  const route = objectJson(JSON.stringify(output.llmRoute ?? output.routeSummary ?? {}));
  const label = input.textStage === "repaint-concept" ? "Repaint specification"
    : typeof input.renderMode === "string" ? input.renderMode.replace(/-/g, " ")
    : job.kind === "hd-preview" ? "HD render" : "Concept preview";
  return { id: String(job._id), createdAt: job._creationTime, label, status: String(job.status), credits: job.requestedCredits,
    model: text(execution.model) ?? text(route.modelId) ?? text(output.modelId) ?? job.provider ?? null,
    templateVersion: text(composedOutput.templateVersion) ?? text(output.templateVersion), error: job.errorMessage ?? null };
}
