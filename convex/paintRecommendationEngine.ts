import { z } from "zod";
import type { ResolvedPaintMapping } from "./paintCatalogCompatibility";
import { deltaE2000, hexToLabD65 } from "./paintColor";

export const visualPaintEffectSchema = z.enum(["solid", "metallic", "transparent"]);

export const visualPaletteSchema = z.object({
  version: z.literal("visual-palette.v2"),
  entries: z.array(z.object({
    roleSlug: z.string().min(1),
    roleName: z.string().min(1),
    recommendedArea: z.string().optional(),
    targetHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    paintEffect: visualPaintEffectSchema,
    rationale: z.string().min(1),
  }).strict()).min(1),
  sprayNotes: z.array(z.string()).default([]),
}).strict();

export type VisualPalette = z.infer<typeof visualPaletteSchema>;
export type VisualPaletteEntry = VisualPalette["entries"][number];

const recommendationPaintSchema = z.object({
  _id: z.string(),
  mappingKey: z.string(),
  brand: z.string(),
  line: z.string().optional(),
  code: z.string(),
  colorName: z.string(),
  hexPreview: z.string().optional(),
  finishType: z.string().optional(),
  series: z.string().optional(),
}).passthrough();

export const paintRecommendationSetsSchema = z.object({
  version: z.union([z.literal("paint-recommendations.v1"), z.literal("paint-recommendations.v2")]),
  generatedAt: z.number(),
  sets: z.array(z.object({
    id: z.string(),
    brand: z.string(),
    line: z.string(),
    label: z.string(),
    recommended: z.boolean(),
    coverageCount: z.number().int().nonnegative(),
    roleCount: z.number().int().positive(),
    averageDeltaE: z.number().nullable(),
    maxDeltaE: z.number().nullable(),
    missingRoleSlugs: z.array(z.string()),
    warnings: z.array(z.string()),
    entries: z.array(z.object({
      roleSlug: z.string(),
      targetHex: z.string(),
      paintEffect: visualPaintEffectSchema,
      deltaE00: z.number(),
      matchBand: z.enum(["very_close", "close", "usable", "distant"]),
      warnings: z.array(z.string()),
      paint: recommendationPaintSchema,
    }).strict()),
  }).strict()),
}).strict();

export type PaintRecommendationSets = z.infer<typeof paintRecommendationSetsSchema>;

type PaintSystem = {
  id: string;
  brand: string;
  line: string;
  label: string;
  candidates: ResolvedPaintMapping[];
};

const MAX_RECOMMENDATION_DELTA_E = 10;

export function buildVisualPalette(input: {
  entries: Array<{
    roleSlug: string;
    targetHex: string;
    paintEffect: "solid" | "metallic" | "transparent";
    rationale: string;
  }>;
  roles: Array<{ slug: string; name: string; recommendedArea?: string }>;
  sprayNotes: string[];
}): VisualPalette {
  return visualPaletteSchema.parse({
    version: "visual-palette.v2",
    entries: input.entries.map((entry) => {
      const role = input.roles.find((candidate) => candidate.slug === entry.roleSlug);
      if (!role) throw new Error(`Unknown color role: ${entry.roleSlug}`);
      return {
        roleSlug: entry.roleSlug,
        roleName: role.name,
        recommendedArea: role.recommendedArea,
        targetHex: entry.targetHex.toUpperCase(),
        paintEffect: entry.paintEffect,
        rationale: entry.rationale,
      };
    }),
    sprayNotes: input.sprayNotes,
  });
}

export function buildPaintRecommendationSets(
  palette: VisualPalette,
  mappings: ResolvedPaintMapping[],
  generatedAt = Date.now()
): PaintRecommendationSets {
  const systems = groupPaintSystems(
    mappings.filter((mapping) =>
      mapping.isActive &&
      (mapping.preferredMeasurement !== null || /^#[0-9a-f]{6}$/i.test(mapping.hexPreview ?? ""))
    )
  );
  const ranked = systems
    .map((system) => matchSystem(palette, system))
    .filter((set) => set.coverageCount > 0)
    .sort(compareSets)
    .map((set, index) => ({ ...set, recommended: index === 0 }));
  if (!ranked.some((set) => set.coverageCount === set.roleCount)) {
    throw new Error("No catalog paint system can cover every approved color role");
  }
  return paintRecommendationSetsSchema.parse({
    version: "paint-recommendations.v2",
    generatedAt,
    sets: ranked,
  });
}

export function materializePrimaryPaintPlan(input: {
  palette: VisualPalette;
  recommendations: PaintRecommendationSets;
  conceptId?: string;
  conceptTitle: string;
  baseModelName?: string;
  stylePresetName?: string;
  materialPresetName?: string;
  weatheringLevel: string;
  moodTags: string[];
}) {
  const primary = input.recommendations.sets.find((set) => set.recommended)
    ?? input.recommendations.sets.find((set) => set.coverageCount === set.roleCount);
  if (!primary) throw new Error("No complete paint recommendation set is available");
  return {
    conceptId: input.conceptId,
    conceptTitle: input.conceptTitle,
    baseModelName: input.baseModelName ?? "Unknown base model",
    stylePresetName: input.stylePresetName ?? "Unknown Style DNA",
    materialPresetName: input.materialPresetName ?? "Unknown material profile",
    weatheringLevel: input.weatheringLevel,
    moodTags: input.moodTags,
    sprayNotes: input.palette.sprayNotes,
    entries: input.palette.entries.map((entry) => {
      const match = primary.entries.find((candidate) => candidate.roleSlug === entry.roleSlug);
      return {
        roleSlug: entry.roleSlug,
        roleName: entry.roleName,
        recommendedArea: entry.recommendedArea,
        targetHex: entry.targetHex,
        paintEffect: entry.paintEffect,
        rationale: entry.rationale,
        suggestedPaint: match?.paint ?? null,
        alternatePaint: null,
        match: match ? {
          deltaE00: match.deltaE00,
          matchBand: match.matchBand,
          warnings: match.warnings,
          recommendationSetId: primary.id,
        } : null,
      };
    }),
  };
}

export function visualPaletteForRender(palette: VisualPalette) {
  return {
    version: palette.version,
    entries: palette.entries.map((entry) => ({
      roleSlug: entry.roleSlug,
      roleName: entry.roleName,
      recommendedArea: entry.recommendedArea,
      targetHex: entry.targetHex,
      paintEffect: entry.paintEffect,
    })),
  };
}

export function visualPaletteFromLegacyPlan(value?: string): VisualPalette | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      entries?: Array<{
        roleSlug?: string;
        roleName?: string;
        recommendedArea?: string;
        targetHex?: string;
        paintEffect?: "solid" | "metallic" | "transparent";
        rationale?: string;
        suggestedPaint?: {
          hexPreview?: string;
          opacity?: string;
          effects?: string[];
        } | null;
      }>;
      sprayNotes?: string[];
    };
    if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) return null;
    return visualPaletteSchema.parse({
      version: "visual-palette.v2",
      entries: parsed.entries.map((entry) => {
        const rationale = entry.rationale?.trim() || "Recovered from the approved legacy palette.";
        const targetHex = entry.targetHex
          ?? rationale.match(/\bTarget\s+(#[0-9a-f]{6})\b/i)?.[1]
          ?? entry.suggestedPaint?.hexPreview;
        if (!entry.roleSlug || !entry.roleName || !targetHex) {
          throw new Error("Legacy palette is missing a recoverable visual color");
        }
        return {
          roleSlug: entry.roleSlug,
          roleName: entry.roleName,
          recommendedArea: entry.recommendedArea,
          targetHex: targetHex.toUpperCase(),
          paintEffect: entry.paintEffect ?? legacyEffect(entry.suggestedPaint),
          rationale: rationale.replace(/\s*Target\s+#[0-9a-f]{6};?\s*closest catalog sample\s+ΔE00\s+[0-9]+(?:\.[0-9]+)?\.?/i, "").trim()
            || "Recovered from the approved legacy palette.",
        };
      }),
      sprayNotes: parsed.sprayNotes ?? [],
    });
  } catch {
    return null;
  }
}

function groupPaintSystems(mappings: ResolvedPaintMapping[]) {
  const byLine = new Map<string, ResolvedPaintMapping[]>();
  for (const mapping of mappings) {
    const key = mapping.paintLineId
      ? String(mapping.paintLineId)
      : `${mapping.brandName}:${mapping.paintLineName ?? mapping.line ?? "legacy"}`;
    byLine.set(key, [...(byLine.get(key) ?? []), mapping]);
  }
  return Array.from(byLine.entries()).map(([lineId, candidates]): PaintSystem => {
    const first = candidates[0];
    const brandSlug = first.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const lineSlug = first.paintLineName?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? lineId;
    const constrained = brandSlug === "gsi-creos" && lineSlug === "mr-color"
      ? candidates.filter((candidate) => candidate.series === "C")
      : candidates;
    return {
      id: `${brandSlug}:${lineSlug}`,
      brand: first.brandName,
      line: first.paintLineName ?? first.line ?? "Catalog line",
      label: systemLabel(first.brandName, first.paintLineName ?? first.line, constrained),
      candidates: constrained,
    };
  });
}

function matchSystem(palette: VisualPalette, system: PaintSystem) {
  const candidateSets = palette.entries.map((entry) => {
    const targetLab = hexToLabD65(entry.targetHex);
    return {
      entry,
      candidates: system.candidates
        .filter((candidate) => compatibleEffect(entry.paintEffect, candidate))
        .map((paint) => ({
          paint,
          deltaE00: deltaE2000(
            targetLab,
            paint.preferredMeasurement?.lab ?? hexToLabD65(paint.hexPreview!)
          ),
        }))
        .filter((candidate) => candidate.deltaE00 <= MAX_RECOMMENDATION_DELTA_E)
        .sort((left, right) => left.deltaE00 - right.deltaE00 || left.paint.code.localeCompare(right.paint.code)),
    };
  });

  // Assign the best one-to-one mapping for this paint system. A role may be
  // left uncovered when the catalog has no distinct, sufficiently close paint.
  const ordered = [...candidateSets].sort((left, right) => left.candidates.length - right.candidates.length);
  let bestAssignment = new Map<string, { paint: ResolvedPaintMapping; deltaE00: number }>();
  let bestScore = { coverage: -1, distance: Number.POSITIVE_INFINITY };
  function search(index: number, usedPaintIds: Set<string>, assignment: typeof bestAssignment, distance: number) {
    if (index === ordered.length) {
      const coverage = assignment.size;
      if (coverage > bestScore.coverage || (coverage === bestScore.coverage && distance < bestScore.distance)) {
        bestScore = { coverage, distance };
        bestAssignment = new Map(assignment);
      }
      return;
    }
    const current = ordered[index];
    search(index + 1, usedPaintIds, assignment, distance);
    for (const candidate of current.candidates) {
      if (usedPaintIds.has(candidate.paint._id)) continue;
      usedPaintIds.add(candidate.paint._id);
      assignment.set(current.entry.roleSlug, candidate);
      search(index + 1, usedPaintIds, assignment, distance + candidate.deltaE00);
      assignment.delete(current.entry.roleSlug);
      usedPaintIds.delete(candidate.paint._id);
    }
  }
  search(0, new Set(), new Map(), 0);

  const reusedRoleSlugs = new Set<string>();
  if (bestAssignment.size < palette.entries.length) {
    for (const current of candidateSets) {
      if (bestAssignment.has(current.entry.roleSlug) || current.candidates.length === 0) continue;
      const fallback = current.candidates[0];
      bestAssignment.set(current.entry.roleSlug, fallback);
      reusedRoleSlugs.add(current.entry.roleSlug);
    }
  }

  const entries = palette.entries.flatMap((entry) => {
    const best = bestAssignment.get(entry.roleSlug);
    if (!best) return [];
    return [{
      roleSlug: entry.roleSlug,
      targetHex: entry.targetHex,
      paintEffect: entry.paintEffect,
      deltaE00: round(best.deltaE00),
      matchBand: matchBand(best.deltaE00),
      warnings: [
        ...matchWarnings(best.paint),
        ...(reusedRoleSlugs.has(entry.roleSlug) ? ["duplicate_paint_model"] : []),
      ],
      paint: serializeRecommendationPaint(best.paint),
    }];
  });
  const missingRoleSlugs = palette.entries
    .filter((entry) => !entries.some((match) => match.roleSlug === entry.roleSlug))
    .map((entry) => entry.roleSlug);
  const weights = new Map(palette.entries.map((entry) => [entry.roleSlug, roleWeight(entry.roleSlug)]));
  const totalWeight = entries.reduce((sum, entry) => sum + (weights.get(entry.roleSlug) ?? 1), 0);
  const averageDeltaE = totalWeight > 0
    ? entries.reduce((sum, entry) => sum + entry.deltaE00 * (weights.get(entry.roleSlug) ?? 1), 0) / totalWeight
    : null;
  const maxDeltaE = entries.length ? Math.max(...entries.map((entry) => entry.deltaE00)) : null;
  const warnings = Array.from(new Set([
    ...(missingRoleSlugs.length ? [`Missing ${missingRoleSlugs.length} color role${missingRoleSlugs.length === 1 ? "" : "s"}.`] : []),
    ...(entries.some((entry) => entry.warnings.includes("approximate_color_data"))
      ? ["Some matches use approximate digital color data."] : []),
    ...(entries.some((entry) => entry.warnings.includes("duplicate_paint_model"))
      ? ["Some roles reuse the same paint model because no distinct close catalog match was available."] : []),
  ]));
  return {
    id: system.id,
    brand: system.brand,
    line: system.line,
    label: system.label,
    recommended: false,
    coverageCount: entries.length,
    roleCount: palette.entries.length,
    averageDeltaE: averageDeltaE === null ? null : round(averageDeltaE),
    maxDeltaE: maxDeltaE === null ? null : round(maxDeltaE),
    missingRoleSlugs,
    warnings,
    entries,
  };
}

function compareSets(
  left: ReturnType<typeof matchSystem>,
  right: ReturnType<typeof matchSystem>
) {
  const coverageDelta = right.coverageCount - left.coverageCount;
  if (coverageDelta !== 0) return coverageDelta;
  const averageDelta = (left.averageDeltaE ?? Number.POSITIVE_INFINITY) - (right.averageDeltaE ?? Number.POSITIVE_INFINITY);
  if (averageDelta !== 0) return averageDelta;
  const worstDelta = (left.maxDeltaE ?? Number.POSITIVE_INFINITY) - (right.maxDeltaE ?? Number.POSITIVE_INFINITY);
  if (worstDelta !== 0) return worstDelta;
  return left.label.localeCompare(right.label);
}

function compatibleEffect(effect: VisualPaletteEntry["paintEffect"], paint: ResolvedPaintMapping) {
  if (effect === "transparent") return paint.opacity === "transparent";
  if (effect === "metallic") return paint.opacity !== "transparent" && paint.effects.includes("metallic");
  return paint.opacity !== "transparent" && !paint.effects.includes("metallic");
}

function legacyEffect(paint?: { opacity?: string; effects?: string[] } | null): VisualPaletteEntry["paintEffect"] {
  if (paint?.opacity === "transparent") return "transparent";
  if (paint?.effects?.includes("metallic")) return "metallic";
  return "solid";
}

function matchWarnings(paint: ResolvedPaintMapping) {
  const warnings: string[] = [];
  if (paint.preferredMeasurement?.accuracy === "approximate") warnings.push("approximate_color_data");
  if (!paint.preferredMeasurement) warnings.push("approximate_color_data");
  if (paint.opacity === "transparent") warnings.push("transparent_color_depends_on_substrate");
  if (paint.effects.some((effect) => ["metallic", "pearl", "color_shift", "prism"].includes(effect))) {
    warnings.push("effect_color_is_angle_dependent");
  }
  return warnings;
}

function systemLabel(brand: string, line: string | undefined, candidates: ResolvedPaintMapping[]) {
  const series = Array.from(new Set(candidates.map((candidate) => candidate.series).filter(Boolean))).sort();
  if (brand === "GSI Creos" && line === "Mr. Color") return "Mr. Color C Series";
  if (brand === "Tamiya" && line === "Tamiya Color Acrylic") return "Tamiya Acrylic (XF/X)";
  return `${line ?? brand}${series.length > 0 && series.length <= 3 ? ` (${series.join("/")})` : ""}`;
}

function roleWeight(roleSlug: string) {
  if (roleSlug === "primary-armor") return 4;
  if (roleSlug === "secondary-armor") return 3;
  if (roleSlug === "inner-frame") return 2;
  if (roleSlug === "accent") return 1.5;
  return 1;
}

function serializeRecommendationPaint(paint: ResolvedPaintMapping) {
  return {
    _id: paint._id,
    mappingKey: paint.mappingKey,
    brand: paint.brandName,
    line: paint.paintLineName ?? paint.line,
    series: paint.series,
    code: paint.code,
    colorName: paint.name,
    hexPreview: paint.hexPreview,
    finishType: paint.finishType,
  };
}

function matchBand(deltaE00: number) {
  if (deltaE00 <= 2) return "very_close" as const;
  if (deltaE00 <= 5) return "close" as const;
  if (deltaE00 <= 10) return "usable" as const;
  return "distant" as const;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
