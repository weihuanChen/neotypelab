import { Doc, Id } from "./_generated/dataModel";
import { MoodTag, WeatheringLevel } from "./domain";

type ColorRoleRecord = Pick<
  Doc<"colorRoles">,
  "_id" | "description" | "name" | "recommendedArea" | "slug"
>;

type PaintMappingRecord = Pick<
  Doc<"paintMappings">,
  | "_id"
  | "affiliateUrl"
  | "availabilityRegion"
  | "brand"
  | "brandId"
  | "code"
  | "colorName"
  | "finishType"
  | "hexPreview"
  | "isActive"
  | "line"
  | "mappingKey"
  | "name"
  | "opacity"
  | "paintType"
  | "effects"
  | "sheen"
> & {
  preferredMeasurement?: Pick<
    Doc<"paintColorMeasurements">,
    "accuracy" | "hex" | "lab"
  > | null;
};

export function buildPaintPlan(input: {
  conceptId?: Id<"concepts">;
  conceptTitle: string;
  baseModelName?: string;
  materialPresetName?: string;
  materialSlug?: string;
  moodTags?: MoodTag[];
  paintMappings: PaintMappingRecord[];
  stylePresetName?: string;
  styleSlug?: string;
  colorRoles: ColorRoleRecord[];
  weatheringLevel: WeatheringLevel;
}) {
  const activeMappings = input.paintMappings.filter((mapping) => mapping.isActive);
  const mappingByKey = new Map(activeMappings.map((mapping) => [mapping.mappingKey, mapping]));
  const moodTags = input.moodTags ?? [];

  return {
    conceptId: input.conceptId,
    conceptTitle: input.conceptTitle,
    baseModelName: input.baseModelName ?? "Unknown base model",
    stylePresetName: input.stylePresetName ?? "Unknown Style DNA",
    materialPresetName: input.materialPresetName ?? "Unknown material profile",
    weatheringLevel: input.weatheringLevel,
    moodTags,
    sprayNotes: buildSprayNotes({
      materialName: input.materialPresetName,
      styleName: input.stylePresetName,
      moodTags,
      weatheringLevel: input.weatheringLevel,
    }),
    entries: input.colorRoles.map((role) =>
      buildRoleRecommendation(role, {
        mappingByKey,
        materialSlug: input.materialSlug,
        moodTags,
        styleSlug: input.styleSlug,
        weatheringLevel: input.weatheringLevel,
      })
    ),
  };
}

function buildRoleRecommendation(
  role: ColorRoleRecord,
  context: {
    mappingByKey: Map<string, PaintMappingRecord>;
    materialSlug?: string;
    moodTags: MoodTag[];
    styleSlug?: string;
    weatheringLevel: WeatheringLevel;
  }
) {
  const primaryKey = choosePrimaryMappingKey(role.slug, context);
  const alternateKey = chooseAlternateMappingKey(role.slug, primaryKey);

  return {
    roleSlug: role.slug,
    roleName: role.name,
    recommendedArea: role.recommendedArea,
    rationale: buildRoleRationale(role.slug, context),
    suggestedPaint: serializePaint(context.mappingByKey.get(primaryKey)),
    alternatePaint: serializePaint(
      alternateKey ? context.mappingByKey.get(alternateKey) : undefined
    ),
  };
}

function choosePrimaryMappingKey(
  roleSlug: string,
  context: {
    materialSlug?: string;
    moodTags: MoodTag[];
    styleSlug?: string;
    weatheringLevel: WeatheringLevel;
  }
) {
  if (roleSlug === "inner-frame") {
    return "mr-color-super-iron";
  }

  if (roleSlug === "accent" || roleSlug === "markings" || roleSlug === "sensor-color") {
    if (context.moodTags.includes("reactor-glow")) {
      return "gaia-notes-nazca-warning-orange";
    }
    return "gaia-notes-nazca-warning-orange";
  }

  if (roleSlug === "primary-armor") {
    if (context.styleSlug === "desert-ops") {
      return "mr-color-dark-yellow";
    }
    if (context.styleSlug === "stealth-black") {
      return "tamiya-gun-metal-x10";
    }
    if (context.moodTags.includes("industrial-hazard")) {
      return "mr-color-dark-yellow";
    }
    return "gaia-notes-nazca-frost-matte-white";
  }

  if (roleSlug === "secondary-armor") {
    if (context.styleSlug === "desert-ops") {
      return "tamiya-gun-metal-x10";
    }
    if (context.materialSlug === "gunmetal-frame" || context.moodTags.includes("stealth-tension")) {
      return "mr-color-super-iron";
    }
    return "mr-color-dark-yellow";
  }

  return context.weatheringLevel === "heavy"
    ? "mr-color-super-iron"
    : "gaia-notes-nazca-frost-matte-white";
}

function chooseAlternateMappingKey(roleSlug: string, primaryKey: string) {
  const candidates =
    roleSlug === "primary-armor"
      ? ["gaia-notes-nazca-frost-matte-white", "mr-color-dark-yellow", "tamiya-gun-metal-x10"]
      : roleSlug === "secondary-armor"
        ? ["mr-color-dark-yellow", "gaia-notes-nazca-frost-matte-white", "tamiya-gun-metal-x10"]
        : roleSlug === "inner-frame"
          ? ["mr-color-super-iron", "tamiya-gun-metal-x10"]
          : ["gaia-notes-nazca-warning-orange", "mr-color-dark-yellow"];

  return candidates.find((candidate) => candidate !== primaryKey);
}

function buildRoleRationale(
  roleSlug: string,
  context: {
    materialSlug?: string;
    moodTags: MoodTag[];
    styleSlug?: string;
    weatheringLevel: WeatheringLevel;
  }
) {
  if (roleSlug === "inner-frame") {
    return "Use a darker metallic for joints and exposed mechanics before outer armor masking.";
  }
  if (roleSlug === "accent" || roleSlug === "markings") {
    return "Reserve a high-visibility warning color for small decals, vents, and caution zones.";
  }
  if (roleSlug === "sensor-color") {
    return "Treat optics as a controlled hot spot so the scheme stays readable at scale.";
  }
  if (context.moodTags.includes("stealth-tension")) {
    return "Suppress armor contrast so exposed lights and tactical cut lines stay controlled.";
  }
  if (context.moodTags.includes("field-fatigue")) {
    return "Choose tones that can absorb dusting, filter passes, and chipped edge treatment.";
  }
  if (context.styleSlug === "desert-ops") {
    return "Bias toward warm, dust-ready armor tones that still separate cleanly from the frame.";
  }
  if (context.styleSlug === "stealth-black") {
    return "Keep the armor low-signature with restrained contrast and a darker industrial finish.";
  }
  if (context.materialSlug === "ceramic-white") {
    return "A pale ceramic base keeps the armor readable while supporting clean masking boundaries.";
  }
  if (context.weatheringLevel === "heavy") {
    return "Choose tones that can take chipping, filters, and edge wear without collapsing the silhouette.";
  }
  return "Anchor the armor stack with spray-ready, masking-aware tones matched to the selected material profile.";
}

function buildSprayNotes(input: {
  materialName?: string;
  styleName?: string;
  moodTags: MoodTag[];
  weatheringLevel: WeatheringLevel;
}) {
  const notes = [
    "Spray the inner frame metallic first, then mask before laying primary armor coats.",
    input.materialName
      ? `${input.materialName} should drive the final top coat and clear-coat choice.`
      : "Material profile should drive the final top coat and clear-coat choice.",
  ];

  if (input.styleName) {
    notes.push(`${input.styleName} works best when markings stay controlled and localized.`);
  }
  if (input.moodTags.includes("reactor-glow")) {
    notes.push("Keep luminous accents localized to vents, optics, and reactor zones rather than flooding armor panels.");
  }
  if (input.moodTags.includes("ceremonial-clean")) {
    notes.push("Finish with a cleaner clear-coat pass and avoid late-stage abrasion that muddies panel boundaries.");
  }
  if (input.weatheringLevel === "heavy") {
    notes.push("Finish with sponge chipping and enamel streaking after decals are sealed.");
  } else if (input.weatheringLevel === "light") {
    notes.push("Use restrained panel filtering and edge dry-brush instead of full abrasion passes.");
  } else {
    notes.push("Keep weathering minimal so panel separation and color blocking stay sharp.");
  }

  return notes;
}

function serializePaint(paint?: PaintMappingRecord) {
  if (!paint) {
    return null;
  }

  return {
    _id: paint._id,
    mappingKey: paint.mappingKey,
    brandId: paint.brandId,
    brand: paint.brand,
    line: paint.line,
    code: paint.code,
    name: paint.name ?? paint.colorName,
    colorName: paint.name ?? paint.colorName,
    sheen: paint.sheen,
    finishType: paint.sheen?.replace(/_/g, "-") ?? paint.finishType,
    opacity: paint.opacity,
    effects: paint.effects ?? [],
    paintType: paint.paintType,
    availabilityRegion: paint.availabilityRegion,
    affiliateUrl: paint.affiliateUrl,
    hexPreview: paint.hexPreview,
    preferredMeasurement: paint.preferredMeasurement,
  };
}
