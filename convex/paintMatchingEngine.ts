import type { Id } from "./_generated/dataModel";
import type { ResolvedPaintMapping } from "./paintCatalogCompatibility";
import type { PaintColorAccuracy, PaintEffect } from "./paintCatalogDomain";
import { deltaE2000 } from "./paintColor";

export type PaintMatchBand = "very_close" | "close" | "usable" | "distant";

export type PaintMatch = {
  candidate: ResolvedPaintMapping;
  deltaE00: number;
  adjustedDistance: number;
  confidence: number;
  matchBand: PaintMatchBand;
  method: "delta_e_2000";
  warnings: string[];
};

export function rankPaintMatches(
  target: ResolvedPaintMapping,
  candidates: ResolvedPaintMapping[],
  options: {
    limit?: number;
    maxDeltaE?: number;
    crossBrandOnly?: boolean;
    targetBrandId?: Id<"paintBrands">;
  } = {}
) {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 10)));
  const maxDeltaE = Math.max(0, Math.min(200, options.maxDeltaE ?? 20));
  if (!target.preferredMeasurement) return [];

  return candidates
    .flatMap((candidate) => {
      if (!isEligibleCandidate(target, candidate, options)) return [];
      const comparison = comparePaintColors(target, candidate);
      return comparison && comparison.deltaE00 <= maxDeltaE ? [comparison] : [];
    })
    .sort(
      (left, right) =>
        left.adjustedDistance - right.adjustedDistance ||
        left.deltaE00 - right.deltaE00 ||
        left.candidate.brand.localeCompare(right.candidate.brand) ||
        left.candidate.code.localeCompare(right.candidate.code)
    )
    .slice(0, limit);
}

export function comparePaintColors(
  target: ResolvedPaintMapping,
  candidate: ResolvedPaintMapping
): PaintMatch | null {
  const targetMeasurement = target.preferredMeasurement;
  const candidateMeasurement = candidate.preferredMeasurement;
  if (!targetMeasurement || !candidateMeasurement) return null;
  if (!hasCompatibleEffects(target.effects, candidate.effects)) return null;
  if (!hasCompatibleOpacity(target.opacity, candidate.opacity)) return null;

  const deltaE00 = deltaE2000(targetMeasurement.lab, candidateMeasurement.lab);
  const warnings = matchWarnings(target, candidate);
  const accuracyPenalty =
    accuracyPenaltyFor(targetMeasurement.accuracy) +
    accuracyPenaltyFor(candidateMeasurement.accuracy);
  const opacityPenalty = target.opacity && candidate.opacity ? 0 : 0.5;
  const sheenPenalty =
    target.sheen && candidate.sheen
      ? target.sheen === candidate.sheen
        ? 0
        : 0.75
      : 0.25;
  const paintTypePenalty =
    target.paintType && candidate.paintType && target.paintType !== candidate.paintType
      ? 0.25
      : 0;
  const quality = Math.min(
    accuracyWeight(targetMeasurement.accuracy),
    accuracyWeight(candidateMeasurement.accuracy)
  );
  const colorFit = Math.exp(-deltaE00 / 10);
  const classificationCompleteness = target.opacity && candidate.opacity ? 1 : 0.9;

  return {
    candidate,
    deltaE00: round(deltaE00),
    adjustedDistance: round(
      deltaE00 +
        accuracyPenalty +
        opacityPenalty +
        sheenPenalty +
        paintTypePenalty
    ),
    confidence: round(clamp01(colorFit * quality * classificationCompleteness)),
    matchBand: matchBand(deltaE00),
    method: "delta_e_2000",
    warnings,
  };
}

function isEligibleCandidate(
  target: ResolvedPaintMapping,
  candidate: ResolvedPaintMapping,
  options: {
    crossBrandOnly?: boolean;
    targetBrandId?: Id<"paintBrands">;
  }
) {
  if (!candidate.isActive || candidate._id === target._id) return false;
  if (!candidate.preferredMeasurement) return false;
  if (options.targetBrandId && candidate.brandId !== options.targetBrandId) {
    return false;
  }
  if (options.crossBrandOnly && sameBrand(target, candidate)) return false;
  return true;
}

function sameBrand(left: ResolvedPaintMapping, right: ResolvedPaintMapping) {
  if (left.brandId && right.brandId) return left.brandId === right.brandId;
  return left.brand.trim().toLowerCase() === right.brand.trim().toLowerCase();
}

function hasCompatibleEffects(left: string[], right: string[]) {
  const leftEffects = normalizeEffects(left);
  const rightEffects = normalizeEffects(right);
  if (leftEffects.length !== rightEffects.length) return false;
  return leftEffects.every((effect, index) => effect === rightEffects[index]);
}

function normalizeEffects(effects: string[]) {
  return Array.from(new Set(effects)).sort() as PaintEffect[];
}

function hasCompatibleOpacity(left?: string, right?: string) {
  if (left === "transparent" || right === "transparent") {
    return left === "transparent" && right === "transparent";
  }
  return !left || !right || left === right;
}

function matchWarnings(
  target: ResolvedPaintMapping,
  candidate: ResolvedPaintMapping
) {
  const warnings: string[] = [];
  if (
    target.preferredMeasurement?.accuracy === "approximate" ||
    candidate.preferredMeasurement?.accuracy === "approximate"
  ) {
    warnings.push("approximate_color_data");
  }
  if (!target.opacity || !candidate.opacity) warnings.push("opacity_unknown");
  if (
    target.effects.some((effect) =>
      ["metallic", "pearl", "color_shift"].includes(effect)
    )
  ) {
    warnings.push("effect_color_is_angle_dependent");
  }
  if (target.opacity === "transparent") {
    warnings.push("transparent_color_depends_on_substrate");
  }
  return warnings;
}

function accuracyPenaltyFor(accuracy: PaintColorAccuracy) {
  if (accuracy === "measured") return 0;
  if (accuracy === "manufacturer_reported") return 0.5;
  return 1.5;
}

function accuracyWeight(accuracy: PaintColorAccuracy) {
  if (accuracy === "measured") return 1;
  if (accuracy === "manufacturer_reported") return 0.85;
  return 0.65;
}

function matchBand(deltaE00: number): PaintMatchBand {
  if (deltaE00 <= 2) return "very_close";
  if (deltaE00 <= 5) return "close";
  if (deltaE00 <= 10) return "usable";
  return "distant";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
