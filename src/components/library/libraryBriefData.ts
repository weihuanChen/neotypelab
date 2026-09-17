export interface BriefPaletteEntry {
  roleSlug: string;
  roleName: string;
  targetHex: string;
  paintEffect: "solid" | "metallic" | "transparent";
  recommendedArea?: string;
  rationale?: string;
}

export interface BriefVisualPalette {
  entries: BriefPaletteEntry[];
  sprayNotes: string[];
}

export interface BriefPaintMatch {
  roleSlug: string;
  targetHex: string;
  paintEffect: string;
  deltaE00: number;
  matchBand: "very_close" | "close" | "usable" | "distant";
  paint: {
    brand: string;
    line?: string;
    code: string;
    colorName: string;
    hexPreview?: string;
    finishType?: string;
  };
}

export interface BriefPaintSystem {
  id: string;
  brand: string;
  line: string;
  label: string;
  recommended: boolean;
  coverageCount: number;
  roleCount: number;
  averageDeltaE: number | null;
  entries: BriefPaintMatch[];
}

export interface BriefRepaintPanel {
  roleSlug: string;
  areas: string[];
  maskingNotes: string;
}

export interface BriefRepaintSpecification {
  summary: string;
  panels: BriefRepaintPanel[];
  material: {
    surfaceTexture: string;
    reflectivity: string;
    coating: string;
  };
  weathering: {
    level: "clean" | "light" | "heavy";
    applicationNotes: string;
  };
  decals: {
    density: "none" | "low" | "medium";
    placementNotes: string;
  };
}

export interface MaskingSummary {
  difficulty: "Low" | "Medium" | "High";
  zoneCount: number;
  keyAreas: Array<{ area: string; note: string }>;
  finishingAdvice: string | null;
}

function safeJson(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseVisualPalette(
  paletteJson?: string | null,
  legacyPlanJson?: string | null
): BriefVisualPalette | null {
  const json = safeJson(paletteJson);
  if (Array.isArray(json.entries) && json.entries.length > 0) {
    const entries: BriefPaletteEntry[] = [];
    for (const item of json.entries) {
      if (item && typeof item === "object") {
        const raw = item as Record<string, unknown>;
        if (typeof raw.roleSlug === "string" && typeof raw.targetHex === "string") {
          entries.push({
            roleSlug: raw.roleSlug,
            roleName: typeof raw.roleName === "string" ? raw.roleName : humanizeSlug(raw.roleSlug),
            targetHex: raw.targetHex,
            paintEffect: (raw.paintEffect === "metallic" || raw.paintEffect === "transparent")
              ? raw.paintEffect
              : "solid",
            recommendedArea: typeof raw.recommendedArea === "string" ? raw.recommendedArea : undefined,
            rationale: typeof raw.rationale === "string" ? raw.rationale : undefined,
          });
        }
      }
    }
    const sprayNotes = Array.isArray(json.sprayNotes)
      ? json.sprayNotes.filter((n): n is string => typeof n === "string")
      : [];
    if (entries.length > 0) {
      return { entries, sprayNotes };
    }
  }

  // Fallback to legacy plan
  const legacy = safeJson(legacyPlanJson);
  if (Array.isArray(legacy.entries) && legacy.entries.length > 0) {
    const entries: BriefPaletteEntry[] = [];
    for (const item of legacy.entries) {
      if (item && typeof item === "object") {
        const raw = item as Record<string, unknown>;
        const suggested = raw.suggestedPaint as Record<string, unknown> | undefined;
        const hex = typeof raw.targetHex === "string"
          ? raw.targetHex
          : typeof suggested?.hexPreview === "string"
            ? suggested.hexPreview
            : null;
        if (typeof raw.roleSlug === "string" && hex) {
          entries.push({
            roleSlug: raw.roleSlug,
            roleName: typeof raw.roleName === "string" ? raw.roleName : humanizeSlug(raw.roleSlug),
            targetHex: hex,
            paintEffect: (raw.paintEffect === "metallic" || raw.paintEffect === "transparent")
              ? raw.paintEffect
              : "solid",
            rationale: typeof raw.rationale === "string" ? raw.rationale : undefined,
          });
        }
      }
    }
    const sprayNotes = Array.isArray(legacy.sprayNotes)
      ? legacy.sprayNotes.filter((n): n is string => typeof n === "string")
      : [];
    if (entries.length > 0) {
      return { entries, sprayNotes };
    }
  }

  return null;
}

export function parsePaintRecommendations(jsonStr?: string | null): BriefPaintSystem | null {
  const json = safeJson(jsonStr);
  if (!Array.isArray(json.sets) || json.sets.length === 0) {
    return null;
  }

  interface RawSet {
    id?: unknown;
    brand?: unknown;
    line?: unknown;
    label?: unknown;
    recommended?: unknown;
    coverageCount?: unknown;
    roleCount?: unknown;
    averageDeltaE?: unknown;
    entries?: unknown;
  }

  const sets = json.sets as RawSet[];
  const chosenSet = sets.find((s) => s.recommended === true)
    ?? sets.find((s) => Number(s.coverageCount) === Number(s.roleCount))
    ?? sets[0];

  if (typeof chosenSet.id !== "string") return null;

  const entries: BriefPaintMatch[] = [];
  if (Array.isArray(chosenSet.entries)) {
    for (const raw of chosenSet.entries) {
      if (raw && typeof raw === "object") {
        const item = raw as Record<string, unknown>;
        const paint = item.paint as Record<string, unknown> | undefined;
        if (typeof item.roleSlug === "string" && paint && typeof paint.code === "string") {
          entries.push({
            roleSlug: item.roleSlug,
            targetHex: typeof item.targetHex === "string" ? item.targetHex : "#888888",
            paintEffect: typeof item.paintEffect === "string" ? item.paintEffect : "solid",
            deltaE00: typeof item.deltaE00 === "number" ? item.deltaE00 : 0,
            matchBand: (["very_close", "close", "usable", "distant"].includes(item.matchBand as string)
              ? item.matchBand
              : "close") as BriefPaintMatch["matchBand"],
            paint: {
              brand: typeof paint.brand === "string" ? paint.brand : "Unknown",
              line: typeof paint.line === "string" ? paint.line : undefined,
              code: paint.code,
              colorName: typeof paint.colorName === "string" ? paint.colorName : paint.code,
              hexPreview: typeof paint.hexPreview === "string" ? paint.hexPreview : undefined,
              finishType: typeof paint.finishType === "string" ? paint.finishType : undefined,
            },
          });
        }
      }
    }
  }

  return {
    id: chosenSet.id,
    brand: typeof chosenSet.brand === "string" ? chosenSet.brand : "Catalog",
    line: typeof chosenSet.line === "string" ? chosenSet.line : "",
    label: typeof chosenSet.label === "string" ? chosenSet.label : chosenSet.id,
    recommended: Boolean(chosenSet.recommended),
    coverageCount: typeof chosenSet.coverageCount === "number" ? chosenSet.coverageCount : entries.length,
    roleCount: typeof chosenSet.roleCount === "number" ? chosenSet.roleCount : entries.length,
    averageDeltaE: typeof chosenSet.averageDeltaE === "number" ? chosenSet.averageDeltaE : null,
    entries,
  };
}

export function parseRenderSpecification(jsonStr?: string | null): BriefRepaintSpecification | null {
  const json = safeJson(jsonStr);
  if (typeof json.summary !== "string" && !Array.isArray(json.panels)) {
    return null;
  }

  const panels: BriefRepaintPanel[] = [];
  if (Array.isArray(json.panels)) {
    for (const item of json.panels) {
      if (item && typeof item === "object") {
        const raw = item as Record<string, unknown>;
        if (typeof raw.roleSlug === "string") {
          const areas = Array.isArray(raw.areas)
            ? raw.areas.filter((a): a is string => typeof a === "string")
            : [];
          panels.push({
            roleSlug: raw.roleSlug,
            areas,
            maskingNotes: typeof raw.maskingNotes === "string" ? raw.maskingNotes : "",
          });
        }
      }
    }
  }

  const material = (json.material && typeof json.material === "object"
    ? json.material
    : {}) as Record<string, unknown>;

  const weathering = (json.weathering && typeof json.weathering === "object"
    ? json.weathering
    : {}) as Record<string, unknown>;

  const decals = (json.decals && typeof json.decals === "object"
    ? json.decals
    : {}) as Record<string, unknown>;

  return {
    summary: typeof json.summary === "string" ? json.summary : "",
    panels,
    material: {
      surfaceTexture: typeof material.surfaceTexture === "string" ? material.surfaceTexture : "Standard plastic",
      reflectivity: typeof material.reflectivity === "string" ? material.reflectivity : "Satin sheen",
      coating: typeof material.coating === "string" ? material.coating : "Semi-gloss protective clear coat",
    },
    weathering: {
      level: (weathering.level === "light" || weathering.level === "heavy") ? weathering.level : "clean",
      applicationNotes: typeof weathering.applicationNotes === "string" ? weathering.applicationNotes : "Clean finish without weathering",
    },
    decals: {
      density: (decals.density === "low" || decals.density === "medium") ? decals.density : "none",
      placementNotes: typeof decals.placementNotes === "string" ? decals.placementNotes : "No decals applied",
    },
  };
}

export function computeMaskingSummary(
  spec?: BriefRepaintSpecification | null,
  palette?: BriefVisualPalette | null
): MaskingSummary {
  if (!spec || spec.panels.length === 0) {
    return {
      difficulty: "Low",
      zoneCount: 0,
      keyAreas: [],
      finishingAdvice: palette?.sprayNotes[0] ?? null,
    };
  }

  const totalZones = spec.panels.reduce((acc, p) => acc + Math.max(p.areas.length, 1), 0);
  let difficulty: MaskingSummary["difficulty"] = "Low";
  if (totalZones > 12) {
    difficulty = "High";
  } else if (totalZones > 4) {
    difficulty = "Medium";
  }

  const keyAreas: Array<{ area: string; note: string }> = [];
  for (const panel of spec.panels) {
    if (keyAreas.length >= 3) break;
    const areaName = panel.areas[0] ?? humanizeSlug(panel.roleSlug);
    keyAreas.push({
      area: areaName,
      note: panel.maskingNotes || `${panel.areas.length} masking zones`,
    });
  }

  const finishingAdvice = spec.material.coating
    ? `${spec.material.coating}. ${spec.material.surfaceTexture}`
    : palette?.sprayNotes[0] ?? null;

  return {
    difficulty,
    zoneCount: totalZones,
    keyAreas,
    finishingAdvice,
  };
}

export function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
