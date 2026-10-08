import type { StyleIntent } from "./creativeContracts";

export type WeatheringLevel = "clean" | "light" | "heavy";

/**
 * Scene and environment effects. They are never part of a paint scheme, so
 * they are excluded at every weathering level. Image models tend to read
 * names such as "Excavator Yellow" or "Desert Ops" as a scene and add mud,
 * sand, smoke or terrain; these terms keep the render on the painted kit.
 */
const SCENE_NEGATIVES = [
  "mud", "mud splatter", "caked mud", "wet mud", "terrain", "dirt ground", "soil", "sand piles", "rocks", "puddles",
  "water splash", "snow", "smoke", "dust cloud", "fire", "sparks", "explosion", "debris", "particles",
  "motion blur", "lens flare", "battlefield", "construction site", "background scenery", "background vehicles", "props",
];

const WEAR_NEGATIVES: Record<WeatheringLevel, string[]> = {
  clean: [
    "weathering", "dirt", "dust", "grime", "stains", "oil stains", "rust", "streaks", "chipping", "scratches",
    "worn edges", "panel wash grime", "battle damage", "bullet holes",
  ],
  light: ["heavy grime", "thick dirt", "rust patches", "heavy chipping", "battle damage", "bullet holes"],
  heavy: ["bullet holes", "broken parts", "missing armor"],
};

export function sceneNegativeTerms(level: WeatheringLevel) {
  return [...SCENE_NEGATIVES, ...WEAR_NEGATIVES[level]];
}

const WEAR_ALLOWANCE: Record<WeatheringLevel, string> = {
  clean: "Weathering is CLEAN: fresh factory-painted surfaces with no dirt, dust, mud, rust, stains, streaks, chipping or scratches anywhere, including feet and lower legs.",
  light: "Weathering is LIGHT: only subtle panel-line wash and faint edge wear painted onto the kit; no mud, caked dirt, splatter, rust patches or heavy grime.",
  heavy: "Weathering is HEAVY: modeler-applied paint wear only (chipping, enamel wash, rust and oil streaks, edge abrasion) on the kit's own surfaces; no mud clumps, splatter, terrain debris or environmental effects.",
};

/** Render prompt line that makes the selected weathering level authoritative. */
export function sceneGuardLine(level: WeatheringLevel) {
  return [
    "Scene guard: style names, color names and themes (for example \"Excavator Yellow\", \"Desert Ops\", \"Naval Grey\") describe paint hues and graphic mood only. They never add a scene, terrain, mud, sand, water, smoke, fire, props or environmental effects.",
    "Render the kit on a plain neutral studio backdrop.",
    WEAR_ALLOWANCE[level],
    "This weathering level outranks any wear, dirt or mud described in the style or repaint notes.",
  ].join(" ");
}

const MUD_PATTERN = /\b(mud|muddy|caked|splatter|splash|filth|filthy|terrain|soil)\b/i;
const WEAR_PATTERN = /\b(mud|muddy|dirt|dirty|dust|dusty|grime|grimy|rust|rusty|oil|oily|grease|stain|stains|chip|chips|chipping|wear|worn|weathered|weathering|streak|streaks|filth|filthy|scratch|scratches|splatter|caked|sun-?faded|abrasion)\b/i;

function stripClauses(text: string, pattern: RegExp) {
  const kept = text
    .split(/(?<=[.;])\s+|;\s*/)
    .map((clause) => clause.trim())
    .filter((clause) => clause && !pattern.test(clause));
  if (!kept.length) return "";
  const joined = kept.join("; ").replace(/[.;]\s*;/g, ";");
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
}

/** Drops clauses describing wear the level does not allow (mud is dropped at every level). */
export function scrubWearText(text: string, level: WeatheringLevel) {
  return stripClauses(text, level === "clean" ? WEAR_PATTERN : MUD_PATTERN);
}

/**
 * Printed patterns an image model adds when a theme such as "jungle camo" is
 * read literally. Only scrubbed when the intent explicitly decided "none";
 * legacy v1 intents (including official livery presets) keep their graphics.
 */
const PATTERN_TERMS = /\b(camo|camouflage|camouflaged|foliage|leaf|leaves|leafy|fronds?|splinter|disruptive|tiger[- ]?stripes?|stripes?|striped|striping|pixel(?:ated)?|dazzle|motifs?|prints?|printed|patterns?|patterned)\b/i;

const PATTERN_NEGATIVES = [
  "camouflage pattern", "digital camo", "splinter camo", "foliage pattern", "leaf print", "leaves",
  "tiger stripes", "disruptive pattern", "printed motifs", "decorative stripes", "patterned armor",
];

export function solidColorsOnly(intent: StyleIntent | null) {
  return intent?.pattern === "none";
}

export function patternNegativeTerms(intent: StyleIntent | null) {
  return solidColorsOnly(intent) ? PATTERN_NEGATIVES : [];
}

/** Render prompt line that keeps theme words from becoming printed patterns. */
export function patternGuardLine(intent: StyleIntent | null) {
  if (!solidColorsOnly(intent)) return "";
  return "Pattern guard: every armor panel is painted in one solid color from the approved palette. Theme words such as jungle, camo, flame or ghost describe hues only; never render camouflage, leaves, foliage, stripes, pixel patterns or printed motifs on the armor.";
}

/** Drops clauses describing printed patterns when the intent asked for solid colors. */
export function scrubPatternText(text: string) {
  return stripClauses(text, PATTERN_TERMS);
}

function scrubPatternIntent(intent: StyleIntent): StyleIntent {
  const words = new RegExp(PATTERN_TERMS.source, "gi");
  const keep = (item: string) => !PATTERN_TERMS.test(item);
  const materialIntent = intent.materialIntent.filter(keep);
  return {
    ...intent,
    name: intent.name.replace(words, "").replace(/\s{2,}/g, " ").trim() || "Solid Color Scheme",
    surfaceLogic: scrubPatternText(intent.surfaceLogic) || "Solid painted armor surfaces following the approved palette.",
    graphicLanguage: scrubPatternText(intent.graphicLanguage) || "Small unit numbers and caution labels on existing panels.",
    materialIntent: materialIntent.length ? materialIntent : ["painted armor"],
    mood: intent.mood.split(/,\s*/).filter(keep).join(", ") || "Solid painted scheme",
    ...(intent.referenceNotes ? { referenceNotes: scrubPatternText(intent.referenceNotes) || undefined } : {}),
  };
}

/** Weathering previews must show wear, so they render at least at the heavy allowance. */
export function renderWeatheringLevel(level: WeatheringLevel, showsWeathering: boolean): WeatheringLevel {
  return showsWeathering ? "heavy" : level;
}

/**
 * Removes wear/dirt clauses the selected weathering level does not allow from
 * a frozen style intent and aligns its weathering field with the selection.
 * Mud is a scene effect, so it is removed at every level.
 */
export function styleIntentForRender(intent: StyleIntent, level: WeatheringLevel): StyleIntent {
  const pattern = level === "clean" ? WEAR_PATTERN : MUD_PATTERN;
  const surfaceLogic = scrubWearText(intent.surfaceLogic, level);
  const materialIntent = intent.materialIntent.filter((item) => !pattern.test(item));
  const scrubbed: StyleIntent = {
    ...intent,
    weathering: level,
    surfaceLogic: surfaceLogic || "Painted armor surfaces following the approved palette.",
    materialIntent: materialIntent.length ? materialIntent : intent.materialIntent,
    mood: intent.mood
      .split(/,\s*/)
      .filter((part) => !pattern.test(part))
      .join(", ") || intent.mood,
  };
  return solidColorsOnly(intent) ? scrubPatternIntent(scrubbed) : scrubbed;
}
