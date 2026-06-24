export type PromptCompilerPreset = {
  name: string;
  specJson: string;
  renderBehaviorText: string;
};

export type PromptCompilerInput = {
  baseModelSummary?: string | null;
  colorPlan?: unknown;
  identityLock?: PromptCompilerPreset | null;
  materialSpec?: PromptCompilerPreset | null;
  paintFinishSpec?: PromptCompilerPreset | null;
  weatheringSpec?: PromptCompilerPreset | null;
  styleSpec?: PromptCompilerPreset | null;
};

export type CompiledPromptSection = {
  label: string;
  body: string;
};

type SpecRecord = Record<string, unknown>;

export function compileHdRenderPrompt(input: PromptCompilerInput) {
  return [
    "NeotypeLab HD Render",
    "Generate a completed physical mecha model kit repaint preview.",
    formatSection("Subject", compileSubject(input.baseModelSummary)),
    formatSection("Identity Lock", compileIdentityLock(input.identityLock)),
    formatSection("Color Plan", compileColorPlan(input.colorPlan)),
    formatSection("Material Behavior", compileMaterialSpec(input.materialSpec)),
    formatSection("Paint Finish", compilePaintFinishSpec(input.paintFinishSpec)),
    formatSection(
      "Surface Result",
      compileSurfaceResult(input.materialSpec, input.paintFinishSpec)
    ),
    formatSection("Weathering", compileWeatheringSpec(input.weatheringSpec)),
    formatSection("Style Direction", compileStyleSpec(input.styleSpec)),
    formatSection("Composition", compileComposition()),
    formatSection("Hard Constraints", compileHardConstraints()),
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

export function compileHdRenderPromptSections(input: PromptCompilerInput) {
  return [
    { label: "Subject", body: compileSubject(input.baseModelSummary) },
    { label: "Identity Lock", body: compileIdentityLock(input.identityLock) },
    { label: "Color Plan", body: compileColorPlan(input.colorPlan) },
    { label: "Material Behavior", body: compileMaterialSpec(input.materialSpec) },
    { label: "Paint Finish", body: compilePaintFinishSpec(input.paintFinishSpec) },
    {
      label: "Surface Result",
      body: compileSurfaceResult(input.materialSpec, input.paintFinishSpec),
    },
    { label: "Weathering", body: compileWeatheringSpec(input.weatheringSpec) },
    { label: "Style Direction", body: compileStyleSpec(input.styleSpec) },
    { label: "Composition", body: compileComposition() },
    { label: "Hard Constraints", body: compileHardConstraints() },
  ].filter((section) => section.body.length > 0);
}

export function compileSubject(baseModelSummary?: string | null) {
  return normalizeBlock(baseModelSummary) || "";
}

export function compileIdentityLock(preset?: PromptCompilerPreset | null) {
  if (preset === null || preset === undefined) {
    return "";
  }

  const spec = parseSpecJson(preset.specJson);
  return joinPromptLines([
    firstText(spec, ["renderBehaviorText", "renderBehavior"]) ||
      normalizeSentence(preset.renderBehaviorText) ||
      `Preserve the selected ${preset.name} identity lock.`,
    sentenceFromField(spec, "silhouetteRule"),
    sentenceFromField(spec, "armorStructureRule"),
    sentenceFromField(spec, "nativeEquipmentRule"),
    avoidLine(getStringArray(spec, "forbiddenChanges")),
  ]);
}

export function compileColorPlan(colorPlan?: unknown) {
  if (colorPlan === null || colorPlan === undefined) {
    return "";
  }

  if (typeof colorPlan === "string") {
    return normalizeBlock(colorPlan);
  }

  if (typeof colorPlan !== "object" || Array.isArray(colorPlan)) {
    return "";
  }

  const record = colorPlan as SpecRecord;
  const entries = Array.isArray(record.entries) ? record.entries : null;
  if (entries !== null) {
    const lines = entries
      .map((entry) => compileColorPlanEntry(entry))
      .filter((line): line is string => Boolean(line));

    return joinPromptLines([
      "Use the approved Palette Plan color-role assignment.",
      ...lines,
      "Preserve the color hierarchy from the approved color plan.",
    ]);
  }

  const lines = Object.entries(record)
    .map(([key, value]) => {
      const text = getTextValue(value);
      return text ? `${humanizeKey(key)}: ${text}.` : undefined;
    })
    .filter((line): line is string => Boolean(line));

  return joinPromptLines([
    "Use the approved Palette Plan color-role assignment.",
    ...lines,
  ]);
}

export function compileMaterialSpec(preset?: PromptCompilerPreset | null) {
  if (preset === null || preset === undefined) {
    return "";
  }

  const spec = parseSpecJson(preset.specJson);
  if (isPseudoPlating(preset, spec)) {
    if (isCandyOverChromePseudoPlating(spec)) {
      return joinPromptLines([
        "Render as a layered pseudo-plated metallic finish.",
        "Polished metallic undercoat beneath transparent color layers.",
        "Visible candy-coated reflective depth.",
        "Surface should exhibit strong metallic depth and tight specular reflections.",
        "Not full chrome plating.",
        describeMetallicResponse(spec) || "Moderate metallic response.",
        describeRoughness(spec) || "Smooth polished ultra-low roughness surface.",
        weatheringInteractionLine(spec),
        visualCharacterLine(spec),
      ]);
    }

    const behaviorLines = getRenderBehaviorLines(preset, spec);
    const fallbackLines =
      behaviorLines.length > 0
        ? behaviorLines
        : [
            "Render as a layered pseudo-plated metallic finish.",
            "Surface should exhibit strong metallic depth.",
            "Visible candy-coated reflective depth.",
            "Polished metallic undercoat beneath transparent color layers.",
          ];

    return joinPromptLines([
      ...fallbackLines,
      describeMetallicResponse(spec) || "Very high metallic response.",
      describeRoughness(spec) || "Smooth low-roughness surface.",
      behaviorMentionsChromeBoundary(fallbackLines) ? undefined : "Not full chrome plating.",
      weatheringInteractionLine(spec),
    ]);
  }

  const materialBehavior = firstText(spec, ["renderBehavior", "renderBehaviorText"]);
  return joinPromptLines([
    materialBehavior ||
      `Render ${articleFor(preset.name)} ${preset.name} material treatment.`,
    describeCoatingBehavior(spec),
    describeSurfaceTexture(spec),
    describeReflectivity(spec),
    describeRoughness(spec),
    describeMetallicResponse(spec),
    weatheringInteractionLine(spec),
    avoidColorRoleLine(spec),
  ]);
}

export function compilePaintFinishSpec(preset?: PromptCompilerPreset | null) {
  if (preset === null || preset === undefined) {
    return "";
  }

  const spec = parseSpecJson(preset.specJson);
  const finishType = getText(spec, "finishType") || preset.name;
  const finishKind = classifyFinish(finishType, getNumber(spec, "glossLevel"));
  const renderBehavior = firstText(spec, ["renderBehaviorText", "renderBehavior"]);

  if (finishKind === "matte") {
    return joinPromptLines([
      "Fully matte topcoat.",
      "Reflections are heavily diffused.",
      "Surface sheen is minimal.",
      "Highlights are soft and broad.",
      renderBehavior,
      clearCoatLine(spec),
      weatheringInteractionLine(spec),
      "Avoid glossy clear-coat glare.",
    ]);
  }

  if (finishKind === "gloss") {
    return joinPromptLines([
      "Gloss clear topcoat.",
      "Reflections are cleaner and more defined.",
      "Surface sheen is high but scale-model realistic.",
      "Highlights may be sharper without becoming wet plastic.",
      renderBehavior,
      clearCoatLine(spec),
      weatheringInteractionLine(spec),
      "Avoid uncontrolled mirror glare or toy-like plastic shine.",
    ]);
  }

  if (finishKind === "semi-gloss") {
    return joinPromptLines([
      "Controlled semi-gloss topcoat.",
      "Reflections stay present but softened.",
      "Surface sheen is moderate.",
      "Highlights should be readable without becoming chrome-like.",
      renderBehavior,
      clearCoatLine(spec),
      weatheringInteractionLine(spec),
      "Avoid extreme matte flatness or mirror gloss.",
    ]);
  }

  return joinPromptLines([
    `Apply ${articleFor(finishType)} ${humanizeValue(finishType)} final topcoat.`,
    renderBehavior || normalizeSentence(preset.renderBehaviorText),
    clearCoatLine(spec),
    surfaceSheenLine(spec),
    weatheringInteractionLine(spec),
  ]);
}

export function compileSurfaceResult(
  materialPreset?: PromptCompilerPreset | null,
  paintFinishPreset?: PromptCompilerPreset | null
) {
  if (
    materialPreset === null ||
    materialPreset === undefined ||
    paintFinishPreset === null ||
    paintFinishPreset === undefined
  ) {
    return "";
  }

  const materialSpec = parseSpecJson(materialPreset.specJson);
  const finishSpec = parseSpecJson(paintFinishPreset.specJson);
  const finishKind = classifyFinish(
    getText(finishSpec, "finishType") || paintFinishPreset.name,
    getNumber(finishSpec, "glossLevel")
  );

  if (isPseudoPlating(materialPreset, materialSpec) && finishKind === "matte") {
    return joinPromptLines([
      "The final surface should read as matte pseudo-plated metal: metallic depth remains visible, but sharp reflections are softened by the matte topcoat.",
      "The metallic coating should appear satin-to-velvet rather than glossy chrome.",
    ]);
  }

  if (isMetallic(materialPreset, materialSpec) && finishKind === "matte") {
    return joinPromptLines([
      "The final surface should read as matte metal: metallic depth remains visible, but the matte topcoat diffuses sharp reflections.",
      "Keep metal response visible through broad satin highlights rather than glossy chrome glare.",
    ]);
  }

  if (isMetallic(materialPreset, materialSpec) && finishKind === "gloss") {
    return joinPromptLines([
      "The final surface should read as gloss-coated metal: metallic depth remains visible with cleaner highlight edges.",
      "Keep reflections controlled and scale-model realistic rather than mirror chrome.",
    ]);
  }

  return joinPromptLines([
    `The final surface should combine ${humanizeValue(materialPreset.name)} material behavior with ${humanizeValue(paintFinishPreset.name)} finish behavior.`,
    "The finish is the final topcoat: it changes reflection softness without changing the approved material identity.",
  ]);
}

export function compileWeatheringSpec(preset?: PromptCompilerPreset | null) {
  if (preset === null || preset === undefined) {
    return "";
  }

  const spec = parseSpecJson(preset.specJson);
  const level = getText(spec, "level") || preset.name;
  const renderBehavior = firstText(spec, ["renderBehavior", "renderBehaviorText"]);

  return joinPromptLines([
    renderBehavior || `Render ${humanizeValue(level)} scale-model weathering.`,
    weatheringLine(spec, "edgeWear", "Edge wear"),
    weatheringLine(spec, "dustAccumulation", "Dust accumulation"),
    weatheringLine(spec, "paintChipping", "Paint chipping"),
    weatheringLine(spec, "staining", "Staining"),
    weatheringLine(spec, "panelLineEmphasis", "Panel line emphasis"),
    sentenceFromField(spec, "intensityCap"),
    sentenceFromField(spec, "colorReadabilityRule"),
    "Avoid weathering that obscures the approved color hierarchy or base model identity.",
  ]);
}

export function compileStyleSpec(preset?: PromptCompilerPreset | null) {
  if (preset === null || preset === undefined) {
    return "";
  }

  const spec = parseSpecJson(preset.specJson);
  const personalityTags = getStringArray(spec, "personalityTags");
  const prohibitedEffects = getStringArray(spec, "prohibitedEffects");

  return joinPromptLines([
    firstText(spec, ["renderBehavior", "renderBehaviorText"]) ||
      `Render the ${preset.name} style direction as surface design only.`,
    styleLine(spec, "colorRelationship", "Color relationship"),
    styleLine(spec, "decalStyle", "Decal style"),
    styleLine(spec, "markingDensity", "Marking density"),
    styleLine(spec, "warningMarkingBehavior", "Warning marking behavior"),
    styleLine(spec, "tone", "Tone"),
    styleLine(spec, "contrastBehavior", "Contrast behavior"),
    personalityTags.length > 0
      ? `Personality tags: ${personalityTags.map(humanizeValue).join(", ")}.`
      : undefined,
    sentenceFromField(spec, "identityBoundary"),
    avoidLine(prohibitedEffects),
  ]);
}

export function compileComposition() {
  return joinPromptLines([
    "Single complete mecha model kit.",
    "Full body visible.",
    "Three-quarter view.",
    "Standing pose.",
    "Neutral studio or model workbench background.",
    "Balanced lighting.",
    "Photorealistic scale-model presentation.",
  ]);
}

export function compileHardConstraints() {
  return joinPromptLines([
    "Preserve the selected base model identity.",
    "Preserve armor segmentation and limb proportions.",
    "Do not redesign the machine.",
    "Do not invent new weapons or equipment.",
    "Do not add cinematic battle scenes.",
    "Do not add excessive glow, smoke, explosions, or poster effects.",
    "High detail quality does not mean increased detail quantity.",
  ]);
}

function formatSection(label: string, body: string) {
  const normalizedBody = normalizeBlock(body);
  return normalizedBody ? `${label}:\n${normalizedBody}` : "";
}

function parseSpecJson(value: string): SpecRecord {
  if (!value.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SpecRecord;
    }
  } catch {
    return {};
  }

  return {};
}

function compileColorPlanEntry(entry: unknown) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return undefined;
  }

  const record = entry as SpecRecord;
  const role =
    getText(record, "roleName") ||
    getText(record, "role") ||
    getText(record, "roleSlug") ||
    getText(record, "name");
  const paint = record.suggestedPaint;
  const paintText =
    paint !== null && typeof paint === "object" && !Array.isArray(paint)
      ? [
          getText(paint as SpecRecord, "brand"),
          getText(paint as SpecRecord, "code"),
          getText(paint as SpecRecord, "colorName"),
        ]
          .filter((part): part is string => Boolean(part))
          .join(" ")
      : getTextValue(paint);

  if (!role && !paintText) {
    return undefined;
  }

  return paintText ? `${humanizeValue(role || "Color role")}: ${paintText}.` : undefined;
}

function firstText(spec: SpecRecord, keys: string[]) {
  for (const key of keys) {
    const value = getText(spec, key);
    if (value) {
      return normalizeSentence(value);
    }
  }

  return undefined;
}

function getRenderBehaviorLines(preset: PromptCompilerPreset, spec: SpecRecord) {
  const behaviorText =
    getTextValue(preset.renderBehaviorText) ||
    getText(spec, "renderBehavior") ||
    getText(spec, "renderBehaviorText");

  return behaviorText ? splitPromptSentences(behaviorText) : [];
}

function getText(spec: SpecRecord, key: string) {
  return getTextValue(spec[key]);
}

function getTextValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return undefined;
}

function getNumber(spec: SpecRecord, key: string) {
  const value = spec[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getStringArray(spec: SpecRecord, key: string) {
  const value = spec[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getTextValue(item))
    .filter((item): item is string => Boolean(item));
}

function describeCoatingBehavior(spec: SpecRecord) {
  const coating = getText(spec, "coatingBehavior") || getText(spec, "materialEffect");
  return coating ? `${humanizeValue(coating)} coating behavior.` : undefined;
}

function describeSurfaceTexture(spec: SpecRecord) {
  const texture = getText(spec, "surfaceTexture");
  return texture ? `${humanizeValue(texture)} surface texture.` : undefined;
}

function describeReflectivity(spec: SpecRecord) {
  const reflectivity = getText(spec, "reflectivity") || getText(spec, "reflectivityLevel");
  if (!reflectivity) {
    return undefined;
  }

  const normalized = reflectivity.toLowerCase();
  if (normalized === "0" || normalized === "none") {
    return "No reflective response.";
  }

  if (isNumericLow(normalized)) {
    return "Low reflectivity.";
  }

  if (isNumericHigh(normalized)) {
    return "High reflectivity.";
  }

  return `${humanizeValue(reflectivity)} reflectivity.`;
}

function describeRoughness(spec: SpecRecord) {
  const roughness = getText(spec, "roughness") || getText(spec, "roughnessLevel");
  if (!roughness) {
    return undefined;
  }

  const normalized = roughness.toLowerCase();
  const surfaceTexture = (getText(spec, "surfaceTexture") || "").toLowerCase();
  if (
    normalized.includes("ultra-low") ||
    normalized.includes("very-low") ||
    normalized.includes("very low")
  ) {
    return surfaceTexture.includes("mirror-smooth") || surfaceTexture.includes("polished")
      ? "Smooth polished ultra-low roughness surface."
      : "Smooth ultra-low roughness surface.";
  }

  if (isNumericLow(normalized) || normalized.includes("low")) {
    return "Smooth low-roughness surface.";
  }

  if (isNumericHigh(normalized) || normalized.includes("high")) {
    return "Visible high-roughness surface texture.";
  }

  return `${humanizeValue(roughness)} surface roughness.`;
}

function describeMetallicResponse(spec: SpecRecord) {
  const response = getText(spec, "metallicResponse");
  if (!response) {
    return undefined;
  }

  const normalized = response.toLowerCase();
  if (normalized === "0" || normalized === "none" || normalized === "no") {
    return "No metallic base response.";
  }

  if (normalized.includes("very high")) {
    return "Very high metallic response.";
  }

  if (
    normalized.includes("moderate") ||
    normalized.includes("medium high") ||
    normalized.includes("medium-high")
  ) {
    return "Moderate metallic response.";
  }

  if (isNumericLow(normalized)) {
    return "Low metallic response.";
  }

  if (isNumericHigh(normalized)) {
    return "Very high metallic response.";
  }

  return `${humanizeValue(response)} metallic response.`;
}

function clearCoatLine(spec: SpecRecord) {
  const value = getText(spec, "clearCoatBehavior");
  return value ? normalizeSentence(value) : undefined;
}

function surfaceSheenLine(spec: SpecRecord) {
  const value = getText(spec, "surfaceSheen");
  return value ? `${humanizeValue(value)} surface sheen.` : undefined;
}

function weatheringInteractionLine(spec: SpecRecord) {
  const value = getText(spec, "weatheringInteraction");
  return value
    ? `Weathering interaction: ${stripTerminalPunctuation(value)}.`
    : undefined;
}

function visualCharacterLine(spec: SpecRecord) {
  const value = getText(spec, "visualCharacter");
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (
    normalized.includes("premium-candy-metallic") ||
    normalized.includes("premium model showpiece") ||
    normalized.includes("premium-model-showpiece")
  ) {
    return "Premium model-showpiece finish.";
  }

  return `${humanizeValue(value)} visual character.`;
}

function avoidColorRoleLine(spec: SpecRecord) {
  const forbiddenRoles = getStringArray(spec, "forbiddenColorRoleSlugs");
  if (forbiddenRoles.length === 0) {
    return undefined;
  }

  return `Avoid applying this material behavior to ${forbiddenRoles.map(humanizeValue).join(", ")} color roles.`;
}

function weatheringLine(spec: SpecRecord, key: string, label: string) {
  const value = getText(spec, key);
  return value ? `${label}: ${humanizeValue(value)}.` : undefined;
}

function styleLine(spec: SpecRecord, key: string, label: string) {
  const value = getText(spec, key);
  return value ? `${label}: ${humanizeValue(value)}.` : undefined;
}

function sentenceFromField(spec: SpecRecord, key: string) {
  const value = getText(spec, key);
  return value ? normalizeSentence(value) : undefined;
}

function avoidLine(items: string[]) {
  if (items.length === 0) {
    return undefined;
  }

  const normalizedItems = items
    .map(stripTerminalPunctuation)
    .filter((item) => item.length > 0);
  const alreadyNegative = normalizedItems.every((item) =>
    /^(avoid|do not|never|no)\b/i.test(item)
  );

  if (alreadyNegative) {
    return normalizedItems
      .map((item) => normalizeSentence(capitalizeFirst(item)))
      .filter((item): item is string => Boolean(item))
      .join("\n");
  }

  return `Avoid ${normalizedItems.join(", ")}.`;
}

function classifyFinish(finishType: string, glossLevel?: number) {
  const normalized = finishType.toLowerCase();
  if (normalized.includes("matte") || normalized.includes("flat")) {
    return "matte";
  }

  if (normalized.includes("semi") || normalized.includes("satin")) {
    return "semi-gloss";
  }

  if (normalized.includes("gloss") || normalized.includes("shiny")) {
    return "gloss";
  }

  if (glossLevel !== undefined) {
    if (glossLevel <= 0.15) {
      return "matte";
    }

    if (glossLevel >= 0.65) {
      return "gloss";
    }

    return "semi-gloss";
  }

  return "unknown";
}

function isCandyOverChromePseudoPlating(spec: SpecRecord) {
  const text = [
    getText(spec, "coatingBehavior"),
    getText(spec, "visualCharacter"),
    getText(spec, "surfaceTexture"),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return (
    text.includes("candy-over-chrome") ||
    text.includes("premium-candy-metallic") ||
    text.includes("mirror-smooth")
  );
}

function isPseudoPlating(preset: PromptCompilerPreset, spec: SpecRecord) {
  const haystack = searchablePresetText(preset, spec);
  return (
    haystack.includes("pseudo plating") ||
    haystack.includes("pseudo-plating") ||
    haystack.includes("pseudo plated") ||
    haystack.includes("pseudo-plated")
  );
}

function isMetallic(preset: PromptCompilerPreset, spec: SpecRecord) {
  const haystack = searchablePresetText(preset, spec);
  return (
    haystack.includes("metal") ||
    haystack.includes("metallic") ||
    haystack.includes("plating") ||
    haystack.includes("alloy") ||
    haystack.includes("chrome")
  );
}

function searchablePresetText(preset: PromptCompilerPreset, spec: SpecRecord) {
  return [
    preset.name,
    preset.renderBehaviorText,
    ...Object.values(spec)
      .map((value) => getTextValue(value))
      .filter((value): value is string => Boolean(value)),
  ]
    .join(" ")
    .toLowerCase();
}

function behaviorMentionsChromeBoundary(lines: string[]) {
  const text = lines.join(" ").toLowerCase();
  return text.includes("chrome") || text.includes("mirror");
}

function normalizeBlock(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function normalizeSentence(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return undefined;
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function splitPromptSentences(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n")
    .replace(/([.!?])(?=[A-Z0-9])/g, "$1\n")
    .split("\n")
    .map((line) => normalizeSentence(line))
    .filter((line): line is string => Boolean(line));
}

function joinPromptLines(lines: Array<string | undefined>) {
  return lines
    .map((line) => normalizeSentence(line))
    .filter((line): line is string => Boolean(line))
    .filter(uniqueLine)
    .join("\n");
}

function uniqueLine(line: string, index: number, lines: string[]) {
  return lines.indexOf(line) === index;
}

function humanizeKey(value: string) {
  return capitalizeWords(value.replace(/([a-z])([A-Z])/g, "$1 $2"));
}

function humanizeValue(value: string) {
  return capitalizeWords(value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
}

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stripTerminalPunctuation(value: string) {
  return value.trim().replace(/[.!?]+$/, "");
}

function articleFor(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

function isNumericLow(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed <= 0.25;
}

function isNumericHigh(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.65;
}
