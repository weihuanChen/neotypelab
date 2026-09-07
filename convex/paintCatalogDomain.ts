import { v } from "convex/values";

export const PAINT_CATALOG_CONTRACT_VERSION = "paint-catalog.v1";

export const PAINT_TYPES = [
  "lacquer",
  "acrylic",
  "enamel",
  "water_based",
  "urethane",
  "oil",
  "other",
] as const;
export type PaintType = (typeof PAINT_TYPES)[number];
export const vPaintType = v.union(
  v.literal("lacquer"),
  v.literal("acrylic"),
  v.literal("enamel"),
  v.literal("water_based"),
  v.literal("urethane"),
  v.literal("oil"),
  v.literal("other")
);

export const PAINT_SHEENS = [
  "gloss",
  "semi_gloss",
  "satin",
  "matte",
] as const;
export type PaintSheen = (typeof PAINT_SHEENS)[number];
export const vPaintSheen = v.union(
  v.literal("gloss"),
  v.literal("semi_gloss"),
  v.literal("satin"),
  v.literal("matte")
);

export const PAINT_OPACITIES = [
  "opaque",
  "translucent",
  "transparent",
] as const;
export type PaintOpacity = (typeof PAINT_OPACITIES)[number];
export const vPaintOpacity = v.union(
  v.literal("opaque"),
  v.literal("translucent"),
  v.literal("transparent")
);

export const PAINT_EFFECTS = [
  "metallic",
  "pearl",
  "fluorescent",
  "candy",
  "clear",
  "color_shift",
  "texture",
  "prism",
  "matting_agent",
] as const;
export type PaintEffect = (typeof PAINT_EFFECTS)[number];
export const vPaintEffect = v.union(
  v.literal("metallic"),
  v.literal("pearl"),
  v.literal("fluorescent"),
  v.literal("candy"),
  v.literal("clear"),
  v.literal("color_shift"),
  v.literal("texture"),
  v.literal("prism"),
  v.literal("matting_agent")
);

export const PAINT_COLOR_ACCURACIES = [
  "approximate",
  "manufacturer_reported",
  "measured",
] as const;
export type PaintColorAccuracy = (typeof PAINT_COLOR_ACCURACIES)[number];
export const vPaintColorAccuracy = v.union(
  v.literal("approximate"),
  v.literal("manufacturer_reported"),
  v.literal("measured")
);

export const PAINT_COLOR_SOURCE_AUTHORITIES = [
  "official",
  "third_party",
  "community",
  "internal",
] as const;
export type PaintColorSourceAuthority =
  (typeof PAINT_COLOR_SOURCE_AUTHORITIES)[number];
export const vPaintColorSourceAuthority = v.union(
  v.literal("official"),
  v.literal("third_party"),
  v.literal("community"),
  v.literal("internal")
);

export const PAINT_COLOR_SOURCE_TYPES = [
  "digital_color_chart",
  "physical_measurement",
  "scanned_color_chart",
  "product_page",
  "conversion_chart",
  "manual_estimate",
  "painted_sample_image",
  "other",
] as const;
export type PaintColorSourceType =
  (typeof PAINT_COLOR_SOURCE_TYPES)[number];
export const vPaintColorSourceType = v.union(
  v.literal("digital_color_chart"),
  v.literal("physical_measurement"),
  v.literal("scanned_color_chart"),
  v.literal("product_page"),
  v.literal("conversion_chart"),
  v.literal("manual_estimate"),
  v.literal("painted_sample_image"),
  v.literal("other")
);

export const PAINT_COLOR_SUBSTRATES = [
  "digital",
  "white_primer",
  "gray_primer",
  "black_primer",
  "bare_material",
  "other",
] as const;
export type PaintColorSubstrate =
  (typeof PAINT_COLOR_SUBSTRATES)[number];
export const vPaintColorSubstrate = v.union(
  v.literal("digital"),
  v.literal("white_primer"),
  v.literal("gray_primer"),
  v.literal("black_primer"),
  v.literal("bare_material"),
  v.literal("other")
);

export const PAINT_RGB_COLOR_SPACE = "srgb" as const;
export const PAINT_LAB_ILLUMINANT = "D65" as const;
export const PAINT_LAB_OBSERVER = "2deg" as const;
export const PAINT_LAB_CONVERSION_VERSION = "srgb-d65-cielab-v1" as const;
export const PAINT_LAB_METHODS = [
  "derived_from_srgb",
  "instrument_measured",
] as const;
export type PaintLabMethod = (typeof PAINT_LAB_METHODS)[number];
export const vPaintLabMethod = v.union(
  v.literal("derived_from_srgb"),
  v.literal("instrument_measured")
);

export const PAINT_EQUIVALENCE_METHODS = [
  "official_chart",
  "manual_review",
  "community_chart",
] as const;
export type PaintEquivalenceMethod =
  (typeof PAINT_EQUIVALENCE_METHODS)[number];
export const vPaintEquivalenceMethod = v.union(
  v.literal("official_chart"),
  v.literal("manual_review"),
  v.literal("community_chart")
);

export function normalizePaintCodeForSearch(code: string) {
  return code
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function canonicalizePaintBrandSlug(slug: string) {
  return slug === "gaianotes" ? "gaia-notes" : slug;
}

export function canonicalizePaintLineSlug(input: {
  brandSlug: string;
  paintLineSlug: string;
}) {
  if (
    input.brandSlug === "tamiya" &&
    input.paintLineSlug === "tamiya-color-acrylic"
  ) {
    return "acrylic";
  }
  return input.paintLineSlug;
}

export function buildPaintExternalKey(input: {
  brandSlug: string;
  paintLineSlug: string;
  code: string;
}) {
  assertCatalogSlug(input.brandSlug, "brandSlug");
  assertCatalogSlug(input.paintLineSlug, "paintLineSlug");
  const normalizedCode = normalizePaintCodeForSearch(input.code);
  if (!normalizedCode) {
    throw new Error("Paint code must contain at least one ASCII letter or digit");
  }
  return `${input.brandSlug}:${input.paintLineSlug}:${normalizedCode.toLowerCase()}`;
}

export function buildPaintMeasurementKey(input: {
  paintExternalKey: string;
  sourceAuthority: PaintColorSourceAuthority;
  sourceType: PaintColorSourceType;
  substrate: PaintColorSubstrate;
  sourceName: string;
}) {
  const sourceSlug = input.sourceName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!sourceSlug) {
    throw new Error("sourceName must contain at least one ASCII letter or digit");
  }
  return [
    input.paintExternalKey,
    input.sourceAuthority,
    input.sourceType,
    input.substrate,
    sourceSlug,
  ].join(":");
}

function assertCatalogSlug(value: string, fieldName: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${fieldName} must be a lowercase kebab-case slug`);
  }
}
