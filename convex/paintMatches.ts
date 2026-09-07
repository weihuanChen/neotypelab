import { v } from "convex/values";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { mutation, query } from "./functions";
import { listResolvedPaintMappings } from "./paintCatalogCompatibility";
import { vPaintEquivalenceMethod } from "./paintCatalogDomain";
import { deltaE2000 } from "./paintColor";
import { rankPaintMatches } from "./paintMatchingEngine";

export const findSimilarPaints = query({
  args: {
    paintMappingId: v.id("paintMappings"),
    targetBrandId: v.optional(v.id("paintBrands")),
    limit: v.optional(v.number()),
    maxDeltaE: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const paints = await listResolvedPaintMappings(ctx);
    const target = paints.find((paint) => paint._id === args.paintMappingId);
    if (!target) return null;
    const matches = rankPaintMatches(target, paints, {
      targetBrandId: args.targetBrandId,
      limit: normalizeLimit(args.limit),
      maxDeltaE: normalizeMaxDeltaE(args.maxDeltaE),
    });
    return {
      source: paintSummary(target),
      matches: matches.map((match) => ({
        ...match,
        candidate: paintSummary(match.candidate),
      })),
    };
  },
});

export const getCrossBrandConversions = query({
  args: {
    paintMappingId: v.id("paintMappings"),
    targetBrandId: v.optional(v.id("paintBrands")),
    limit: v.optional(v.number()),
    maxDeltaE: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const paints = await listResolvedPaintMappings(ctx);
    const target = paints.find((paint) => paint._id === args.paintMappingId);
    if (!target) return null;
    const paintById = new Map(paints.map((paint) => [paint._id, paint]));
    const [outboundEquivalences, inboundEquivalences] = await Promise.all([
      ctx.db
        .query("paintEquivalences")
        .withIndex("by_source_active", (q) =>
          q.eq("sourcePaintId", args.paintMappingId).eq("isActive", true)
        )
        .collect(),
      ctx.db
        .query("paintEquivalences")
        .withIndex("by_targetPaintId", (q) =>
          q.eq("targetPaintId", args.paintMappingId)
        )
        .collect(),
    ]);
    const equivalences = [
      ...outboundEquivalences.map((equivalence) => ({
        equivalence,
        candidateId: equivalence.targetPaintId,
        direction: "forward" as const,
      })),
      ...inboundEquivalences
        .filter((equivalence) => equivalence.isActive)
        .map((equivalence) => ({
          equivalence,
          candidateId: equivalence.sourcePaintId,
          direction: "reverse" as const,
        })),
    ];
    const curated = equivalences.flatMap((equivalence) => {
      const candidate = paintById.get(equivalence.candidateId);
      if (!candidate || !candidate.isActive) return [];
      if (sameBrand(target, candidate)) return [];
      if (args.targetBrandId && candidate.brandId !== args.targetBrandId) return [];
      return [
        {
          equivalenceId: equivalence.equivalence._id,
          direction: equivalence.direction,
          method: equivalence.equivalence.method,
          confidence: equivalence.equivalence.confidence,
          deltaE00:
            currentDeltaE(target, candidate) ?? equivalence.equivalence.deltaE00,
          sourceName: equivalence.equivalence.sourceName,
          sourceUrl: equivalence.equivalence.sourceUrl,
          notes: equivalence.equivalence.notes,
          candidate: paintSummary(candidate),
        },
      ];
    });
    const curatedTargetIds = new Set(
      curated.map((entry) => entry.candidate.paintMappingId)
    );
    const computed = rankPaintMatches(target, paints, {
      crossBrandOnly: true,
      targetBrandId: args.targetBrandId,
      limit: normalizeLimit(args.limit),
      maxDeltaE: normalizeMaxDeltaE(args.maxDeltaE),
    })
      .filter((match) => !curatedTargetIds.has(match.candidate._id))
      .map((match) => ({
        ...match,
        candidate: paintSummary(match.candidate),
      }));
    return {
      source: paintSummary(target),
      curated: curated.sort(
        (left, right) =>
          methodPriority(left.method) - methodPriority(right.method) ||
          right.confidence - left.confidence
      ),
      computed,
    };
  },
});

export const upsertEquivalence = mutation({
  args: {
    equivalenceId: v.optional(v.id("paintEquivalences")),
    sourcePaintId: v.id("paintMappings"),
    targetPaintId: v.id("paintMappings"),
    method: vPaintEquivalenceMethod,
    confidence: v.number(),
    sourceName: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    if (args.sourcePaintId === args.targetPaintId) {
      throw new Error("Equivalent paints must be different records");
    }
    if (!Number.isFinite(args.confidence) || args.confidence < 0 || args.confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }
    const sourceUrl = cleanOptional(args.sourceUrl);
    if (sourceUrl) assertHttpUrl(sourceUrl);
    const [sourcePaint, targetPaint] = await Promise.all([
      ctx.db.get(args.sourcePaintId),
      ctx.db.get(args.targetPaintId),
    ]);
    if (!sourcePaint || !targetPaint) throw new Error("Paint mapping not found");
    const [duplicate, reverseDuplicate] = await Promise.all([
      ctx.db
        .query("paintEquivalences")
        .withIndex("by_pair_method", (q) =>
          q
            .eq("sourcePaintId", args.sourcePaintId)
            .eq("targetPaintId", args.targetPaintId)
            .eq("method", args.method)
        )
        .unique(),
      ctx.db
        .query("paintEquivalences")
        .withIndex("by_pair_method", (q) =>
          q
            .eq("sourcePaintId", args.targetPaintId)
            .eq("targetPaintId", args.sourcePaintId)
            .eq("method", args.method)
        )
        .unique(),
    ]);
    if (duplicate && duplicate._id !== args.equivalenceId) {
      throw new Error("This paint equivalence already exists");
    }
    if (reverseDuplicate && reverseDuplicate._id !== args.equivalenceId) {
      throw new Error("This paint equivalence already exists in reverse order");
    }
    const existing = args.equivalenceId
      ? await ctx.db.get(args.equivalenceId)
      : duplicate;
    if (args.equivalenceId && !existing) {
      throw new Error("Paint equivalence not found");
    }
    const [sourceMeasurement, targetMeasurement] = await Promise.all([
      sourcePaint.preferredMeasurementId
        ? ctx.db.get(sourcePaint.preferredMeasurementId)
        : null,
      targetPaint.preferredMeasurementId
        ? ctx.db.get(targetPaint.preferredMeasurementId)
        : null,
    ]);
    const deltaE00 =
      sourceMeasurement && targetMeasurement
        ? round(deltaE2000(sourceMeasurement.lab, targetMeasurement.lab))
        : undefined;
    const now = Date.now();
    const fields = {
      sourcePaintId: args.sourcePaintId,
      targetPaintId: args.targetPaintId,
      method: args.method,
      confidence: args.confidence,
      deltaE00,
      sourceMeasurementId: sourceMeasurement?._id,
      targetMeasurementId: targetMeasurement?._id,
      sourceName: cleanOptional(args.sourceName),
      sourceUrl,
      notes: cleanOptional(args.notes),
      isActive: args.isActive,
      updatedByUserId: viewer._id,
      updatedAt: now,
    };
    const equivalenceId = existing
      ? (await ctx.db.patch(existing._id, fields), existing._id)
      : await ctx.db.insert("paintEquivalences", {
          ...fields,
          createdByUserId: viewer._id,
          createdAt: now,
        });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: existing ? "update-paint-equivalence" : "create-paint-equivalence",
      entityType: "paintEquivalence",
      entityId: equivalenceId,
      detailsJson: JSON.stringify({
        sourcePaintId: args.sourcePaintId,
        targetPaintId: args.targetPaintId,
        method: args.method,
        confidence: args.confidence,
      }),
    });
    return equivalenceId;
  },
});

function paintSummary(paint: Awaited<ReturnType<typeof listResolvedPaintMappings>>[number]) {
  return {
    paintMappingId: paint._id,
    externalKey: paint.externalKey,
    mappingKey: paint.mappingKey,
    brandId: paint.brandId,
    brand: paint.brand,
    paintLineId: paint.paintLineId,
    line: paint.line,
    series: paint.series,
    code: paint.code,
    normalizedCode: paint.normalizedCode,
    name: paint.name,
    sheen: paint.sheen,
    opacity: paint.opacity,
    effects: paint.effects,
    paintType: paint.paintType,
    hex: paint.preferredMeasurement?.hex ?? paint.hexPreview,
    lab: paint.preferredMeasurement?.lab,
    accuracy: paint.preferredMeasurement?.accuracy,
  };
}

function currentDeltaE(
  source: Awaited<ReturnType<typeof listResolvedPaintMappings>>[number],
  target: Awaited<ReturnType<typeof listResolvedPaintMappings>>[number]
) {
  if (!source.preferredMeasurement || !target.preferredMeasurement) return undefined;
  return round(deltaE2000(source.preferredMeasurement.lab, target.preferredMeasurement.lab));
}

function sameBrand(
  left: Awaited<ReturnType<typeof listResolvedPaintMappings>>[number],
  right: Awaited<ReturnType<typeof listResolvedPaintMappings>>[number]
) {
  if (left.brandId && right.brandId) return left.brandId === right.brandId;
  return left.brand.trim().toLowerCase() === right.brand.trim().toLowerCase();
}

function normalizeLimit(value?: number) {
  return Math.max(1, Math.min(50, Math.floor(value ?? 10)));
}

function normalizeMaxDeltaE(value?: number) {
  return Math.max(0, Math.min(200, value ?? 20));
}

function methodPriority(method: "official_chart" | "manual_review" | "community_chart") {
  if (method === "official_chart") return 0;
  if (method === "manual_review") return 1;
  return 2;
}

function cleanOptional(value?: string) {
  return value?.trim() || undefined;
}

function assertHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Source URL must be a valid HTTP or HTTPS URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Source URL must be a valid HTTP or HTTPS URL");
  }
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
