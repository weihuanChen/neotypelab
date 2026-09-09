import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { buildPaintPlan } from "./paintMappingEngine";
import {
  listResolvedPaintMappings,
  type ResolvedPaintMapping,
} from "./paintCatalogCompatibility";
import { rankPaintMatches, type PaintMatchBand } from "./paintMatchingEngine";
import { query } from "./functions";
import { QueryCtx } from "./types";

type BrandAlternative = {
  mappingKey: string;
  brand: string;
  line?: string;
  code: string;
  colorName: string;
  availabilityRegion?: string;
  affiliateUrl?: string;
  procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
  purchaseSearchUrl: string;
  deltaE00: number;
  adjustedDistance: number;
  confidence: number;
  matchBand: PaintMatchBand;
  method: "delta_e_2000";
  warnings: string[];
};

export const getPublicConceptShoppingList = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    const concept = await ctx.db.get(conceptId);
    if (
      concept === null ||
      (concept.visibility !== "public" && concept.visibility !== "unlisted") ||
      (concept.status !== "generated" && concept.status !== "archived")
    ) {
      return null;
    }

    return await buildShoppingListSnapshot(ctx, concept);
  },
});

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

        const snapshot = await buildShoppingListSnapshot(ctx, concept);
        return snapshot
          ? {
              ...snapshot,
            }
          : null;
      })
    );

    return results.filter((result): result is NonNullable<typeof result> => result !== null);
  },
});

export const getViewerConceptShoppingList = query({
  args: {
    conceptId: v.id("concepts"),
  },
  async handler(ctx, { conceptId }) {
    if (ctx.viewer === null) {
      return null;
    }

    const concept = await ctx.db.get(conceptId);
    if (concept === null || concept.userId !== ctx.viewerX()._id) {
      return null;
    }

    return await buildShoppingListSnapshot(ctx, concept);
  },
});

export async function getShoppingListSnapshotForRecommendations(
  ctx: QueryCtx,
  concept: Doc<"concepts">
) {
  return await buildShoppingListSnapshot(ctx, concept);
}

async function buildShoppingListSnapshot(
  ctx: QueryCtx,
  concept: Doc<"concepts">
) {
  const [baseModel, stylePreset, materialPreset, colorRoles, paintMappings] = await Promise.all([
      concept.baseModelId ? ctx.db.get(concept.baseModelId) : null,
      concept.stylePresetId ? ctx.db.get(concept.stylePresetId) : null,
      concept.materialPresetId ? ctx.db.get(concept.materialPresetId) : null,
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      listResolvedPaintMappings(ctx),
    ]);

    const paintPlan = buildPaintPlan({
      approvedPlanJson: concept.palettePlanJson,
      conceptId: concept._id,
      conceptTitle: concept.title,
      baseModelName: baseModel?.name,
      stylePresetName: stylePreset?.name,
      styleSlug: stylePreset?.slug,
      materialPresetName: materialPreset?.name,
      materialSlug: materialPreset?.slug,
      moodTags: concept.moodTags ?? [],
      weatheringLevel: concept.weatheringLevel,
      colorRoles,
      paintMappings,
    });

    const primaryItemMap = new Map<
      string,
      {
        mappingKey: string;
        brand: string;
        line?: string;
        code: string;
        colorName: string;
        finishType?: string;
        paintType?: string;
        availabilityRegion?: string;
        affiliateUrl?: string;
        hexPreview?: string;
        recommendedRoles: string[];
        roleAreas: string[];
        purchasePriority: "core" | "support";
        procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
        purchaseSearchUrl: string;
        brandAlternatives: BrandAlternative[];
        sourcingAdvice: string;
      }
    >();
    const alternateItemMap = new Map<
      string,
      {
        mappingKey: string;
        brand: string;
        line?: string;
        code: string;
        colorName: string;
        finishType?: string;
        paintType?: string;
        availabilityRegion?: string;
        affiliateUrl?: string;
        hexPreview?: string;
        recommendedRoles: string[];
        roleAreas: string[];
        purchasePriority: "backup";
        procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
        purchaseSearchUrl: string;
        brandAlternatives: BrandAlternative[];
        sourcingAdvice: string;
      }
    >();

    for (const entry of paintPlan.entries) {
      if (entry.suggestedPaint) {
        const paint = entry.suggestedPaint;
        const existing = primaryItemMap.get(paint.mappingKey);
        if (existing) {
          existing.recommendedRoles = dedupe([...existing.recommendedRoles, entry.roleName]);
          existing.roleAreas = dedupe([
            ...existing.roleAreas,
            entry.recommendedArea ?? "Controlled application zone",
          ]);
        } else {
          const brandAlternatives = findBrandAlternatives(
            paint.mappingKey,
            paintMappings
          );
          primaryItemMap.set(paint.mappingKey, {
            mappingKey: paint.mappingKey,
            brand: paint.brand,
            line: paint.line,
            code: paint.code,
            colorName: paint.colorName,
            finishType: paint.finishType,
            paintType: paint.paintType,
            availabilityRegion: paint.availabilityRegion,
            affiliateUrl: paint.affiliateUrl,
            hexPreview: paint.hexPreview,
            recommendedRoles: [entry.roleName],
            roleAreas: [entry.recommendedArea ?? "Controlled application zone"],
            purchasePriority:
              entry.roleSlug === "primary-armor" || entry.roleSlug === "secondary-armor"
                ? "core"
                : "support",
            procurementStatus: classifyProcurementStatus(paint.availabilityRegion, paint.affiliateUrl),
            purchaseSearchUrl: buildPurchaseSearchUrl({
              brand: paint.brand,
              line: paint.line,
              code: paint.code,
              colorName: paint.colorName,
            }),
            brandAlternatives,
            sourcingAdvice: buildSourcingAdvice({
              availabilityRegion: paint.availabilityRegion,
              affiliateUrl: paint.affiliateUrl,
              alternateCount: brandAlternatives.length,
            }),
          });
        }
      }

      if (entry.alternatePaint) {
        const paint = entry.alternatePaint;
        const existing = alternateItemMap.get(paint.mappingKey);
        if (existing) {
          existing.recommendedRoles = dedupe([...existing.recommendedRoles, entry.roleName]);
          existing.roleAreas = dedupe([
            ...existing.roleAreas,
            entry.recommendedArea ?? "Controlled application zone",
          ]);
        } else {
          const brandAlternatives = findBrandAlternatives(
            paint.mappingKey,
            paintMappings
          );
          alternateItemMap.set(paint.mappingKey, {
            mappingKey: paint.mappingKey,
            brand: paint.brand,
            line: paint.line,
            code: paint.code,
            colorName: paint.colorName,
            finishType: paint.finishType,
            paintType: paint.paintType,
            availabilityRegion: paint.availabilityRegion,
            affiliateUrl: paint.affiliateUrl,
            hexPreview: paint.hexPreview,
            recommendedRoles: [entry.roleName],
            roleAreas: [entry.recommendedArea ?? "Controlled application zone"],
            purchasePriority: "backup",
            procurementStatus: classifyProcurementStatus(paint.availabilityRegion, paint.affiliateUrl),
            purchaseSearchUrl: buildPurchaseSearchUrl({
              brand: paint.brand,
              line: paint.line,
              code: paint.code,
              colorName: paint.colorName,
            }),
            brandAlternatives,
            sourcingAdvice: buildSourcingAdvice({
              availabilityRegion: paint.availabilityRegion,
              affiliateUrl: paint.affiliateUrl,
              alternateCount: brandAlternatives.length,
            }),
          });
        }
      }
    }

    const primaryItems = Array.from(primaryItemMap.values()).sort((left, right) =>
      left.purchasePriority === right.purchasePriority
        ? left.brand === right.brand
          ? left.code.localeCompare(right.code)
          : left.brand.localeCompare(right.brand)
        : left.purchasePriority === "core"
          ? -1
          : 1
    );
    const alternateItems = Array.from(alternateItemMap.values())
      .filter((item) => !primaryItemMap.has(item.mappingKey))
      .sort((left, right) =>
      left.brand === right.brand ? left.code.localeCompare(right.code) : left.brand.localeCompare(right.brand)
    );
    const allItems = [...primaryItems, ...alternateItems];
    const purchaseSummary = {
      affiliateReadyCount: allItems.filter((item) => item.procurementStatus === "affiliate-ready").length,
      searchReadyCount: allItems.filter((item) => item.procurementStatus === "search-ready").length,
      regionLimitedCount: allItems.filter((item) => item.procurementStatus === "region-limited").length,
    };
    const procurementConfidence = classifyProcurementConfidence(purchaseSummary);
    const featuredPurchasePath = pickFeaturedPurchasePath(primaryItems, alternateItems);
    const bundles = {
      core: primaryItems.filter((item) => item.purchasePriority === "core"),
      support: primaryItems.filter((item) => item.purchasePriority === "support"),
      backup: alternateItems,
    };

    return {
      conceptId: concept._id,
      conceptTitle: concept.title,
      baseModelName: baseModel?.name ?? "Unknown base model",
      stylePresetName: stylePreset?.name ?? "Unknown Style DNA",
      materialPresetName: materialPreset?.name ?? "Unknown material profile",
      estimatedItemCount: primaryItems.length + alternateItems.length,
      purchaseSummary,
      procurementConfidence,
      featuredPurchasePath,
      notes: [
        "Primary items are the strongest purchase candidates for the current concept and should be sourced first.",
        "Alternate items give fallback options when region, stock, or finish preference makes the main pick harder to buy.",
        "Role areas highlight where each paint is expected to land in the build.",
      ],
      bundles,
      primaryItems,
      alternateItems,
    };
}

function dedupe(items: string[]) {
  return Array.from(new Set(items));
}

function classifyProcurementStatus(
  availabilityRegion?: string,
  affiliateUrl?: string
): "affiliate-ready" | "search-ready" | "region-limited" {
  if (affiliateUrl) {
    return "affiliate-ready";
  }
  if (availabilityRegion === "global" || availabilityRegion === undefined) {
    return "search-ready";
  }
  return "region-limited";
}

function buildPurchaseSearchUrl(input: {
  brand: string;
  line?: string;
  code: string;
  colorName: string;
}) {
  const query = [input.brand, input.line, input.code, input.colorName, "model paint"]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function classifyProcurementConfidence(input: {
  affiliateReadyCount: number;
  searchReadyCount: number;
  regionLimitedCount: number;
}) {
  if (input.regionLimitedCount >= 2) {
    return "fragile";
  }
  if (input.affiliateReadyCount >= 2 || input.searchReadyCount >= 3) {
    return "strong";
  }
  return "moderate";
}

function findBrandAlternatives(
  targetMappingKey: string,
  paintMappings: ResolvedPaintMapping[]
) {
  const target = paintMappings.find(
    (mapping) => mapping.mappingKey === targetMappingKey
  );
  if (!target) return [];
  return rankPaintMatches(target, paintMappings, {
    crossBrandOnly: true,
    limit: 2,
    maxDeltaE: 20,
  }).map((match) => ({
      mappingKey: match.candidate.mappingKey,
      brand: match.candidate.brand,
      line: match.candidate.line,
      code: match.candidate.code,
      colorName: match.candidate.colorName,
      availabilityRegion: match.candidate.availabilityRegion,
      affiliateUrl: match.candidate.affiliateUrl,
      procurementStatus: classifyProcurementStatus(
        match.candidate.availabilityRegion,
        match.candidate.affiliateUrl
      ),
      purchaseSearchUrl: buildPurchaseSearchUrl({
        brand: match.candidate.brand,
        line: match.candidate.line,
        code: match.candidate.code,
        colorName: match.candidate.colorName,
      }),
      deltaE00: match.deltaE00,
      adjustedDistance: match.adjustedDistance,
      confidence: match.confidence,
      matchBand: match.matchBand,
      method: match.method,
      warnings: match.warnings,
    }));
}

function pickFeaturedPurchasePath<
  T extends {
    affiliateUrl?: string;
    purchaseSearchUrl: string;
    brand: string;
    code: string;
    procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
  },
  U extends {
    affiliateUrl?: string;
    purchaseSearchUrl: string;
    brand: string;
    code: string;
    procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
  },
>(primaryItems: T[], alternateItems: U[]) {
  const affiliateFirst = [...primaryItems, ...alternateItems].find((item) => item.affiliateUrl);
  if (affiliateFirst) {
    return {
      label: `${affiliateFirst.brand} ${affiliateFirst.code}`,
      url: affiliateFirst.affiliateUrl!,
      status: affiliateFirst.procurementStatus,
      type: "affiliate" as const,
    };
  }

  const searchFirst = primaryItems[0] ?? alternateItems[0];
  if (!searchFirst) {
    return null;
  }

  return {
    label: `${searchFirst.brand} ${searchFirst.code}`,
    url: searchFirst.purchaseSearchUrl,
    status: searchFirst.procurementStatus,
    type: "search" as const,
  };
}

function buildSourcingAdvice(input: {
  availabilityRegion?: string;
  affiliateUrl?: string;
  alternateCount: number;
}) {
  if (input.affiliateUrl) {
    return input.alternateCount > 0
      ? "A direct purchase path is configured, and backup brand alternatives are also available."
      : "A direct purchase path is configured for this item."
  }
  if (input.availabilityRegion === "global" || input.availabilityRegion === undefined) {
    return input.alternateCount > 0
      ? "Search by brand and code first. Global availability looks reasonable and backup brands exist."
      : "Search by brand and code first. This item appears broadly sourceable but does not yet have a direct purchase link."
  }
  return input.alternateCount > 0
    ? "Region coverage may be limited. Review backup brands before locking the final shopping list."
    : "Region coverage may be limited and no strong backup brand has been attached yet."
}
