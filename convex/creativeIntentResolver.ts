import { z } from "zod";
import {
  colorFamilies,
  creativeContractVersion,
  creativeResolverVersion,
  maxCreativeColors,
  intentScopeSchema,
  normalizedUserIntentSchema,
  paletteV3Schema,
  repaintV3Schema,
  styleIntentSchema,
  styleIntentObjectSchema,
  styleIntentColorRoles,
  type IntentScope,
  type NormalizedRequirement,
  type NormalizedUserIntent,
  type StyleIntent,
} from "./creativeContracts";
export type { NormalizedUserIntent } from "./creativeContracts";

type ColorFamily = typeof colorFamilies[number];
type Strength = "hard" | "soft" | "free";
type Source = "user-explicit" | "user-selection" | "style-default" | "ai-inference" | "system-rule" | "system-default";
export type IntentEvidence = { source: Source; inputRef: string; quote?: string };
export type IntentConstraint = {
  id: string;
  property: "color-presence" | "color-family" | "color-hex" | "color-coverage" | "color-scope" | "color-importance" | "allowed-colors" | "excluded-color" | "finish" | "weathering" | "pattern" | "material" | "mood" | "geometry";
  colorId?: string;
  scope: IntentScope;
  strength: Strength;
  value: string | number | string[];
  evidence: IntentEvidence;
  status: "active" | "superseded";
};
export type ResolvedIntentColor = {
  colorId: string;
  name: string;
  family?: ColorFamily;
  hex?: string;
  visualRole: typeof import("./creativeContracts").styleIntentColorRoles[number];
  scope: IntentScope;
  presence: "required";
  constraintIds: string[];
  coverage?: { scope: IntentScope["kind"]; part?: string; percent: number; strength: "hard" | "soft"; source: "user-explicit" | "ai-inference" | "style-default" };
};
export type ResolvedCreativeIntent = {
  version: typeof creativeContractVersion;
  resolverVersion: typeof creativeResolverVersion;
  styleModified: boolean;
  originalStyle: StyleIntent;
  effectiveStyle: Omit<StyleIntent, "colors" | "explicitRequirements" | "referenceNotes">;
  kit?: { source: "catalog" | "custom"; id: string; version: string };
  colors: ResolvedIntentColor[];
  constraints: IntentConstraint[];
  decisions: Array<{ requirementId: string; supersededConstraintIds: string[]; reason: string }>;
  conflicts: Array<{ property: string; message: string; constraintIds: string[] }>;
  unresolved: NormalizedUserIntent["unresolved"];
  freeDimensions: Array<{ property: "panel-assignment" | "color-shade" | "coverage"; strength: "free"; scope: IntentScope }>;
};
export type ResolveCreativeIntentInput = {
  styleIntent: StyleIntent;
  normalizedNotes?: NormalizedUserIntent;
  /** Server-owned migration flag: recover an old source with the current ordinary normalizer. */
  useNormalizedDescription?: boolean;
  notes?: string;
  styleDescription?: string;
  material?: { id?: string; name: string; finish?: StyleIntent["finish"] };
  weatheringLevel?: StyleIntent["weathering"];
  moodTags?: string[];
  selectionSources?: { material?: "user-selection" | "system-default"; weathering?: "user-selection" | "system-default" };
  kit?: ResolvedCreativeIntent["kit"];
  customKitParts?: string[];
};

export const resolvedCreativeIntentSchema = z.object({
  version: z.literal(creativeContractVersion), resolverVersion: z.literal(creativeResolverVersion), styleModified: z.boolean(),
  originalStyle: styleIntentSchema,
  effectiveStyle: styleIntentObjectSchema.omit({ colors: true, explicitRequirements: true, referenceNotes: true }),
  kit: z.object({ source: z.enum(["catalog", "custom"]), id: z.string().min(1), version: z.string().min(1) }).strict().optional(),
  colors: z.array(z.object({
    colorId: z.string().min(1), name: z.string().min(1), family: z.enum(colorFamilies).optional(), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    visualRole: z.enum(styleIntentColorRoles), scope: intentScopeSchema, presence: z.literal("required"), constraintIds: z.array(z.string()),
    coverage: z.object({ scope: z.enum(["exterior-armor", "inner-frame", "sensors", "markings", "whole-kit", "part"]), part: z.string().optional(), percent: z.number().min(0.1).max(100), strength: z.enum(["hard", "soft"]), source: z.enum(["user-explicit", "ai-inference", "style-default"]) }).strict().optional(),
  }).strict()).max(maxCreativeColors),
  constraints: z.array(z.object({
    id: z.string().min(1), property: z.enum(["color-presence", "color-family", "color-hex", "color-coverage", "color-scope", "color-importance", "allowed-colors", "excluded-color", "finish", "weathering", "pattern", "material", "mood", "geometry"]), colorId: z.string().optional(),
    scope: intentScopeSchema, strength: z.enum(["hard", "soft", "free"]), value: z.union([z.string(), z.number(), z.array(z.string())]),
    evidence: z.object({ source: z.enum(["user-explicit", "user-selection", "style-default", "ai-inference", "system-rule", "system-default"]), inputRef: z.string().min(1), quote: z.string().min(1).optional() }).strict(), status: z.enum(["active", "superseded"]),
  }).strict()),
  decisions: z.array(z.object({ requirementId: z.string(), supersededConstraintIds: z.array(z.string()), reason: z.string() }).strict()),
  conflicts: z.array(z.object({ property: z.string(), message: z.string(), constraintIds: z.array(z.string()) }).strict()),
  unresolved: z.array(z.object({ text: z.string(), reason: z.string() }).strict()),
  freeDimensions: z.array(z.object({ property: z.enum(["panel-assignment", "color-shade", "coverage"]), strength: z.literal("free"), scope: intentScopeSchema }).strict()),
}).strict();

const wholeKit: IntentScope = { kind: "whole-kit" };
const armor: IntentScope = { kind: "exterior-armor" };
const familyWords: Record<ColorFamily, string[]> = {
  red: ["red", "crimson", "scarlet", "红", "赤"], orange: ["orange", "橙", "橘"], yellow: ["yellow", "gold", "黄", "金色"],
  green: ["green", "olive", "绿", "緑"], cyan: ["cyan", "teal", "turquoise", "青", "蓝绿"], blue: ["blue", "navy", "蓝", "藍"],
  purple: ["purple", "violet", "紫"], pink: ["pink", "magenta", "rose", "粉", "洋红"], brown: ["brown", "earth", "棕", "褐"],
  white: ["white", "ivory", "bone", "白"], black: ["black", "黑", "黒"], gray: ["gray", "grey", "gunmetal", "silver", "灰", "银"], beige: ["beige", "khaki", "tan", "卡其", "米色"],
};
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function replaceTerm(text: string, term: string, replacement: string) {
  if (!term) return text;
  const pattern = /^[a-z0-9 -]+$/i.test(term) ? `\\b${escapeRegex(term)}\\b` : escapeRegex(term);
  return text.replace(new RegExp(pattern, "gi"), replacement);
}
function omitOriginalColorInstructions(text: string, removed: ResolvedIntentColor[], remaining: ResolvedIntentColor[]) {
  let scrubbed = text;
  for (const color of removed) {
    scrubbed = replaceTerm(scrubbed, color.name, "resolved palette color");
    if (color.hex) scrubbed = replaceTerm(scrubbed, color.hex, "resolved target HEX");
    if (color.family && !remaining.some((candidate) => candidate.family === color.family)) {
      for (const word of familyWords[color.family]) scrubbed = replaceTerm(scrubbed, word, "resolved palette color");
    }
  }
  return scrubbed;
}
function mentionsColor(text: string, color: ResolvedIntentColor) {
  const terms = [color.name, color.hex, ...(color.family ? familyWords[color.family] : [])].filter((term): term is string => !!term);
  return terms.some((term) => replaceTerm(text, term, "") !== text);
}
function familyFromName(name: string): ColorFamily | undefined {
  const lower = name.toLowerCase();
  return colorFamilies.find((family) => familyWords[family].some((word) => /[a-z]/i.test(word) ? new RegExp(`\\b${word}\\b`, "i").test(lower) : lower.includes(word)));
}

/** A bounded hue check; it validates broad user hue families, never guesses exact shades. */
export function hexMatchesColorFamily(hex: string, family: ColorFamily) {
  const values = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = values;
  const max = Math.max(...values), min = Math.min(...values), delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  const lightness = (max + min) / 2;
  let hue = delta === 0 ? 0 : max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  if (family === "black") return max < 0.26;
  if (family === "white") return min > 0.7 && delta < 0.25;
  if (family === "gray") return saturation < 0.2 && lightness >= 0.08 && lightness <= 0.91;
  if (family === "beige") return hue >= 20 && hue <= 70 && saturation >= 0.08 && saturation < 0.5 && lightness > 0.42;
  if (family === "brown") return hue >= 5 && hue <= 65 && saturation >= 0.18 && lightness < 0.5;
  if (saturation < 0.12 || max < 0.12) return false;
  switch (family) {
    case "red": return hue < 20 || hue >= 345;
    case "orange": return hue >= 15 && hue <= 45;
    case "yellow": return hue >= 40 && hue <= 75;
    case "green": return hue >= 65 && hue <= 170;
    case "cyan": return hue >= 165 && hue <= 205;
    case "blue": return hue >= 200 && hue <= 265;
    case "purple": return hue >= 255 && hue <= 310;
    case "pink": return hue >= 300 && hue < 350;
  }
}

export function validateNormalizedUserIntent(value: unknown, sources: { notes?: string; styleDescription?: string }): NormalizedUserIntent {
  const normalized = normalizedUserIntentSchema.parse(value);
  if (sources.notes?.trim() && !normalized.requirements.some((requirement) => requirement.evidence.inputRef === "notes") && !normalized.unresolved.some((item) => sources.notes!.includes(item.text))) {
    throw new Error("Creative notes normalization returned no requirements or unresolved preferences");
  }
  for (const requirement of normalized.requirements) {
    const input = requirement.evidence.inputRef === "notes" ? sources.notes : sources.styleDescription;
    if (!input?.includes(requirement.evidence.quote)) throw new Error(`Requirement ${requirement.id} has no matching source evidence`);
    for (const color of requirement.colors ?? []) {
      if (color.hex && !requirement.evidence.quote.toLowerCase().includes(color.hex.toLowerCase())) throw new Error(`Requirement ${requirement.id} invented an exact HEX`);
      if (color.coveragePercent !== undefined && !new RegExp(`(?:^|[^\\d.])${color.coveragePercent}\\s*(?:%|％|percent|per cent)`, "i").test(requirement.evidence.quote)) {
        throw new Error(`Requirement ${requirement.id} invented an explicit coverage percentage`);
      }
      if (color.hex && color.family && !hexMatchesColorFamily(color.hex, color.family)) throw new Error(`Requirement ${requirement.id} has conflicting HEX and hue family`);
    }
  }
  for (const unresolved of normalized.unresolved) {
    if (![sources.notes, sources.styleDescription].some((source) => source?.includes(unresolved.text))) throw new Error("Unresolved preference has no matching source evidence");
  }
  return normalized;
}

function scopeForVisualRole(role: ResolvedIntentColor["visualRole"]): IntentScope {
  if (role === "frame") return { kind: "inner-frame" };
  if (role === "glow") return { kind: "sensors" };
  if (role === "marking") return { kind: "markings" };
  if (role === "neutral") return wholeKit;
  return armor;
}
function legacyColorScope(name: string, role: ResolvedIntentColor["visualRole"]): IntentScope {
  if (/\b(?:frame|skeleton)\b/i.test(name)) return { kind: "inner-frame" };
  if (/\b(?:sensor|sensors|lens|lenses)\b/i.test(name)) return { kind: "sensors" };
  if (/\b(?:marking|markings|decal|decals)\b/i.test(name)) return { kind: "markings" };
  return scopeForVisualRole(role);
}
function sameScope(left: IntentScope, right: IntentScope) {
  return left.kind === right.kind && (left.part?.toLowerCase() ?? "") === (right.part?.toLowerCase() ?? "");
}
function affectsScope(target: IntentScope, candidate: IntentScope) {
  return target.kind === "whole-kit" || sameScope(target, candidate);
}
function descriptorMatches(color: ResolvedIntentColor, descriptor: NonNullable<NormalizedRequirement["colors"]>[number]) {
  if (descriptor.hex) return color.hex?.toUpperCase() === descriptor.hex.toUpperCase();
  return descriptor.family ? color.family === descriptor.family || (!color.family && !!color.hex && hexMatchesColorFamily(color.hex, descriptor.family)) : false;
}
function descriptorMatchesForUpdate(color: ResolvedIntentColor, descriptor: NonNullable<NormalizedRequirement["colors"]>[number]) {
  if (descriptorMatches(color, descriptor)) return true;
  const family = descriptor.family ?? familyFromName(descriptor.name);
  return !!family && (color.family === family || (!color.family && !!color.hex && hexMatchesColorFamily(color.hex, family)));
}
function styleAnchors(style: StyleIntent): ResolvedIntentColor[] {
  if (style.colors) return style.colors.map((color, index) => ({
    colorId: `style-color-${index + 1}`, name: color.name, hex: color.hex.toUpperCase(), family: familyFromName(color.name), visualRole: color.role,
    scope: color.scope ?? legacyColorScope(color.name, color.role), presence: "required", constraintIds: [],
    // Legacy coverage described visible surface, not exterior armor: retain its original scope.
    coverage: { scope: "whole-kit", percent: color.coverage, strength: "soft", source: style.styleType === "custom" ? "ai-inference" : "style-default" },
  }));
  const anchors: Array<{ value: string; role: ResolvedIntentColor["visualRole"] }> = [
    { value: style.palette.primary, role: "primary" },
    ...(style.palette.secondary ? [{ value: style.palette.secondary, role: "secondary" as const }] : []),
    ...(style.palette.accent ? [{ value: style.palette.accent, role: "accent" as const }] : []),
    ...(style.palette.neutrals ?? []).map((value) => ({ value, role: "neutral" as const })),
  ];
  return anchors.map(({ value, role }, index) => ({ colorId: `style-color-${index + 1}`, name: value.replace(/#[0-9a-f]{6}/ig, "").trim() || value,
    hex: value.match(/#[0-9a-f]{6}/i)?.[0].toUpperCase(), family: familyFromName(value), visualRole: role, scope: legacyColorScope(value, role), presence: "required", constraintIds: [] }));
}

export function resolveCreativeIntent(input: ResolveCreativeIntentInput): ResolvedCreativeIntent {
  const originalStyle = styleIntentSchema.parse(input.styleIntent);
  const { colors: _colors, explicitRequirements: _requirements, referenceNotes: _reference, ...effectiveStyle } = originalStyle;
  const result: ResolvedCreativeIntent = {
    version: creativeContractVersion, resolverVersion: creativeResolverVersion, styleModified: false, originalStyle, effectiveStyle,
    ...(input.kit ? { kit: { ...input.kit } } : {}), colors: styleAnchors(originalStyle), constraints: [], decisions: [], conflicts: [], unresolved: [],
    freeDimensions: [{ property: "panel-assignment", strength: "free", scope: armor }, { property: "color-shade", strength: "free", scope: armor }, { property: "coverage", strength: "free", scope: armor }],
  };
  const addConstraint = (constraint: Omit<IntentConstraint, "status">) => { result.constraints.push({ ...constraint, status: "active" }); return constraint.id; };
  const styleSource: Source = originalStyle.styleType === "custom" ? "ai-inference" : "style-default";
  for (const color of result.colors) {
    const evidence: IntentEvidence = { source: styleSource, inputRef: `style.colors.${color.colorId}` };
    color.constraintIds.push(addConstraint({ id: `${color.colorId}:presence`, property: "color-presence", colorId: color.colorId, scope: color.scope, strength: "soft", value: "required", evidence }));
    if (color.hex) color.constraintIds.push(addConstraint({ id: `${color.colorId}:hex`, property: "color-hex", colorId: color.colorId, scope: color.scope, strength: "soft", value: color.hex, evidence }));
    if (color.coverage) color.constraintIds.push(addConstraint({ id: `${color.colorId}:coverage`, property: "color-coverage", colorId: color.colorId, scope: { kind: color.coverage.scope }, strength: "soft", value: color.coverage.percent, evidence }));
  }
  for (const property of ["finish", "weathering", "pattern", "mood"] as const) {
    const value = originalStyle[property] ?? (property === "pattern" ? "none" : "");
    addConstraint({ id: `style:${property}`, property, scope: wholeKit, strength: "soft", value, evidence: { source: styleSource, inputRef: `style.${property}` } });
  }
  addConstraint({ id: "system:geometry", property: "geometry", scope: wholeKit, strength: "hard", value: "Preserve existing silhouette, proportions, segmented armor and native equipment outside explicitly authorized modifications", evidence: { source: "system-rule", inputRef: "kit.identity" } });
  const supersede = (constraints: IntentConstraint[], requirementId: string, reason: string) => {
    const ids = constraints.filter((constraint) => constraint.status === "active").map((constraint) => { constraint.status = "superseded"; return constraint.id; });
    if (ids.length) result.decisions.push({ requirementId, supersededConstraintIds: ids, reason });
  };
  const select = (property: "finish" | "weathering" | "material", value: string, source: "user-selection" | "system-default") => {
    supersede(result.constraints.filter((constraint) => constraint.property === property && constraint.strength === "soft"), `selection:${property}`, "Active selection replaces the corresponding style default");
    addConstraint({ id: `selection:${property}`, property, scope: wholeKit, strength: source === "user-selection" ? "hard" : "soft", value, evidence: { source, inputRef: property === "weathering" ? "weatheringLevel" : "materialPresetId" } });
  };
  if (input.material) {
    select("material", input.material.name, input.selectionSources?.material ?? "system-default");
    result.effectiveStyle.materialIntent = [input.material.name];
    if (input.material.finish) { select("finish", input.material.finish, input.selectionSources?.material ?? "system-default"); result.effectiveStyle.finish = input.material.finish; }
  }
  if (input.weatheringLevel) { select("weathering", input.weatheringLevel, input.selectionSources?.weathering ?? "system-default"); result.effectiveStyle.weathering = input.weatheringLevel; }
  if (input.moodTags?.length) {
    supersede(result.constraints.filter((constraint) => constraint.property === "mood"), "selection:mood", "Selected mood replaces the style mood default without changing colors");
    addConstraint({ id: "selection:mood", property: "mood", scope: wholeKit, strength: "soft", value: input.moodTags.join(", "), evidence: { source: "user-selection", inputRef: "moodTags" } });
    result.effectiveStyle.mood = input.moodTags.join(", ");
  }
  const hasDescriptionOrigin = (constraint: IntentConstraint) => {
    let current: IntentConstraint | undefined = constraint;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      if (current.evidence.source === "user-explicit" && current.evidence.inputRef === "style-description") return true;
      if (current.evidence.source !== "system-rule" || !current.id.startsWith("resolver:description-add:")) return false;
      visited.add(current.id);
      const parentId: string = current.evidence.inputRef;
      current = result.constraints.find((candidate) => candidate.id === parentId);
    }
    return false;
  };
  const inputs: Array<{ intent: NormalizedUserIntent; prefix: string }> = [];
  if (originalStyle.explicitRequirements && !input.useNormalizedDescription) inputs.push({ intent: validateNormalizedUserIntent(originalStyle.explicitRequirements, { styleDescription: input.styleDescription }), prefix: "description" });
  if (input.normalizedNotes) {
    const normalized = validateNormalizedUserIntent(input.normalizedNotes, { notes: input.notes, styleDescription: input.styleDescription });
    const descriptionRequirements = normalized.requirements.filter((requirement) => requirement.evidence.inputRef === "style-description");
    // One normalization call may recover a legacy custom description and parse new notes.
    // Apply the description first regardless of model array order, then the latest notes.
    if ((!originalStyle.explicitRequirements || input.useNormalizedDescription) && descriptionRequirements.length) inputs.push({ intent: { ...normalized, requirements: descriptionRequirements, unresolved: [] }, prefix: "description" });
    inputs.push({ intent: { ...normalized, requirements: normalized.requirements.filter((requirement) => requirement.evidence.inputRef === "notes") }, prefix: "notes" });
  }
  else if (input.notes?.trim()) result.unresolved.push({ text: input.notes.trim(), reason: "Creative notes must be normalized before generation" });
  if (input.useNormalizedDescription && !input.normalizedNotes) result.unresolved.push({ text: input.styleDescription ?? originalStyle.name, reason: "The saved style source requires current normalization before generation" });
  for (const { intent, prefix } of inputs) {
    result.unresolved.push(...intent.unresolved);
    for (const requirement of intent.requirements) {
      if (prefix === "notes") result.styleModified = true;
      const requirementId = `${prefix}:${requirement.id}`;
      const evidence: IntentEvidence = { source: "user-explicit", inputRef: requirement.evidence.inputRef, quote: requirement.evidence.quote };
      const replacesPriorDescription = (constraint: IntentConstraint) => prefix === "notes" && ["set", "replace", "only", "exclude"].includes(requirement.operation) && hasDescriptionOrigin(constraint);
      const overridable = (constraint: IntentConstraint) => constraint.strength !== "hard" || replacesPriorDescription(constraint);
      if (requirement.property !== "colors") {
        if (requirement.property !== "geometry" && requirement.scope.kind !== "whole-kit") {
          result.unresolved.push({ text: requirement.evidence.quote, reason: `Local ${requirement.property} rules are not yet supported by the specification contract; use a whole-kit choice` });
          continue;
        }
        if (requirement.property === "geometry" && requirement.operation !== "preserve") {
          if (input.kit?.source === "custom" && requirement.scope.kind === "part" && input.customKitParts?.some(part => part.toLowerCase() === requirement.scope.part?.toLowerCase())) {
            addConstraint({ id: requirementId, property: "geometry", scope: requirement.scope, strength: "hard", value: requirement.value!, evidence });
            continue;
          }
          result.conflicts.push({ property: "geometry", message: "Catalog Style creation supports repainting existing geometry; structural modifications require Custom Kit", constraintIds: ["system:geometry", requirementId] });
          continue;
        }
        const property = requirement.property;
        const value = property === "geometry" && requirement.operation === "preserve"
          ? requirement.value ?? `Preserve existing geometry ${requirement.scope.kind === "part" ? `of ${requirement.scope.part}` : `within ${requirement.scope.kind}`}`
          : requirement.value!;
        if ((property === "finish" && !["matte", "satin", "gloss", "semi-gloss"].includes(value)) ||
          (property === "weathering" && !["clean", "light", "heavy"].includes(value)) ||
          (property === "pattern" && !["none", "camouflage", "stripes", "geometric", "gradient", "other"].includes(value))) {
          result.unresolved.push({ text: requirement.evidence.quote, reason: `Unsupported ${property} value` }); continue;
        }
        const active = result.constraints.filter((constraint) => constraint.property === property && constraint.status === "active" && affectsScope(requirement.scope, constraint.scope));
        const currentSelection = prefix === "description" ? active.find((constraint) => constraint.strength === "hard" && constraint.evidence.source === "user-selection" && constraint.value !== value) : undefined;
        if (currentSelection) {
          addConstraint({ id: requirementId, property, scope: requirement.scope, strength: "hard", value, evidence });
          supersede(result.constraints.filter((constraint) => constraint.id === requirementId), currentSelection.id, "The current explicit selection overrides the corresponding property of the saved style description");
          continue;
        }
        // Independent preservation statements reinforce the geometry lock. Their
        // wording need not be identical to the system's identity description.
        const competing = property === "geometry" && requirement.operation === "preserve" ? [] : active.filter((constraint) => constraint.strength === "hard" && constraint.value !== value && !replacesPriorDescription(constraint));
        const selectionOverride = competing.length > 0 && requirement.overridesSelection === true && competing.every((constraint) => constraint.evidence.source === "user-selection");
        if (competing.length && !selectionOverride) {
          result.conflicts.push({ property, message: `Explicit ${property} conflicts with an active requirement; specify which choice to replace`, constraintIds: [...competing.map((constraint) => constraint.id), requirementId] });
          continue;
        }
        supersede(active.filter((constraint) => overridable(constraint) || selectionOverride), requirementId, "Current user input overrides only the corresponding default, prior description property or explicitly replaced selection");
        addConstraint({ id: requirementId, property, scope: requirement.scope, strength: "hard", value, evidence });
        if (requirement.scope.kind === "whole-kit") {
          if (property === "finish") {
            result.effectiveStyle.finish = value as StyleIntent["finish"];
            const materialLanguage = result.effectiveStyle.materialIntent.map((name) => name.replace(/semi-gloss|matte|satin|gloss/gi, "").replace(/\s+/g, " ").trim()).filter(Boolean);
            result.effectiveStyle.materialIntent = materialLanguage.length ? materialLanguage.map((name) => `${name} (${value} finish)`) : [`${value} painted armor`];
            const activeMaterial = result.constraints.find((constraint) => constraint.property === "material" && constraint.status === "active");
            if (activeMaterial && /matte|satin|semi-gloss|gloss/i.test(String(activeMaterial.value))) {
              supersede([activeMaterial], requirementId, "Explicit finish removes contradictory finish wording from the automatic material description");
              addConstraint({ id: `${requirementId}:material-finish`, property: "material", scope: wholeKit, strength: activeMaterial.strength, value: result.effectiveStyle.materialIntent, evidence: activeMaterial.strength === "hard" ? activeMaterial.evidence : evidence });
            }
          }
          if (property === "weathering") result.effectiveStyle.weathering = value as StyleIntent["weathering"];
          if (property === "pattern") result.effectiveStyle.pattern = value as StyleIntent["pattern"];
          if (property === "mood") result.effectiveStyle.mood = value;
          if (property === "material") result.effectiveStyle.materialIntent = [value];
        }
        continue;
      }
      const descriptors = requirement.colors!;
      const matchesExcludedColor = (constraint: IntentConstraint) => descriptors.some((descriptor) => descriptor.hex?.toUpperCase() === constraint.value || descriptor.family === constraint.value || (!!descriptor.hex && colorFamilies.includes(constraint.value as ColorFamily) && hexMatchesColorFamily(descriptor.hex, constraint.value as ColorFamily)));
      if (prefix === "notes" && requirement.operation === "add") {
        const priorRestrictions = result.constraints.filter((constraint) => constraint.status === "active" && hasDescriptionOrigin(constraint) && ["allowed-colors", "excluded-color"].includes(constraint.property));
        const broaderRestrictions = priorRestrictions.filter((constraint) => !sameScope(constraint.scope, requirement.scope) && (affectsScope(constraint.scope, requirement.scope) || (constraint.scope.kind === "exterior-armor" && requirement.scope.kind === "part")));
        const needsException = broaderRestrictions.some((constraint) => constraint.property === "excluded-color" ? matchesExcludedColor(constraint) : descriptors.some((descriptor) => !result.colors.some((color) => (constraint.value as string[]).includes(color.colorId) && descriptorMatches(color, descriptor))));
        if (needsException) {
          result.unresolved.push({ text: requirement.evidence.quote, reason: "Adding this color requires a local exception to a broader saved-style restriction; the current contract cannot express that exception. Use the same scope or revise the broader restriction explicitly." });
          continue;
        }
        supersede(priorRestrictions.filter((constraint) => constraint.property === "excluded-color" && sameScope(constraint.scope, requirement.scope) && matchesExcludedColor(constraint)), requirementId, "Current additive color request removes only the matching saved-description exclusion in this scope");
      }
      if (["set", "replace", "only"].includes(requirement.operation)) supersede(result.constraints.filter((constraint) => constraint.property === "excluded-color" && affectsScope(requirement.scope, constraint.scope) && replacesPriorDescription(constraint) && descriptors.some((descriptor) => descriptor.hex?.toUpperCase() === constraint.value || descriptor.family === constraint.value || (!!descriptor.hex && colorFamilies.includes(constraint.value as ColorFamily) && hexMatchesColorFamily(descriptor.hex, constraint.value as ColorFamily)))), requirementId, "Current user color request overrides the matching prior-description exclusion in this scope");
      if (["replace", "only"].includes(requirement.operation)) {
        const removed = result.colors.filter((color) => affectsScope(requirement.scope, color.scope) && !descriptors.some((descriptor) => descriptorMatchesForUpdate(color, descriptor)));
        for (const color of removed) {
          const active = result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.status === "active");
          const protectedHard = active.filter((constraint) => !overridable(constraint));
          if (protectedHard.length) result.conflicts.push({ property: "colors", message: "Conflicting color requirements in the same input cannot replace one another", constraintIds: [...protectedHard.map((constraint) => constraint.id), requirementId] });
          supersede(active.filter(overridable), requirementId, "Explicit color replacement supersedes prior colors in this scope without erasing same-input hard requirements");
        }
        result.colors = result.colors.filter((color) => !removed.includes(color));
        supersede(result.constraints.filter((constraint) => constraint.property === "allowed-colors" && affectsScope(requirement.scope, constraint.scope) && overridable(constraint)), requirementId, "Current color collection overrides an earlier description collection in this scope");
        if (removed.length) supersede(result.constraints.filter((constraint) => constraint.property === "color-coverage" && affectsScope(requirement.scope, constraint.scope) && replacesPriorDescription(constraint)), requirementId, "A changed color collection invalidates percentages from the earlier collection in this scope");
      }
      if (requirement.operation === "exclude") {
        for (const [index, descriptor] of descriptors.entries()) {
          const excluded = result.colors.filter((color) => affectsScope(requirement.scope, color.scope) && descriptorMatches(color, descriptor));
          for (const color of excluded) {
            const active = result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.status === "active");
            if (active.some((constraint) => !overridable(constraint))) result.conflicts.push({ property: "colors", message: "A color is both explicitly required and excluded", constraintIds: [...active.filter((constraint) => !overridable(constraint)).map((constraint) => constraint.id), requirementId] });
            else { supersede(active, requirementId, "User excludes a style-default color in this scope"); result.colors = result.colors.filter((candidate) => candidate !== color); }
          }
          addConstraint({ id: `${requirementId}:exclude:${index}`, property: "excluded-color", scope: requirement.scope, strength: "hard", value: descriptor.hex?.toUpperCase() ?? descriptor.family!, evidence });
        }
        continue;
      }
      const requiredIds: string[] = [];
      for (const [index, descriptor] of descriptors.entries()) {
        const explicitVisualRole = descriptor.visualRole === "unspecified" ? undefined : descriptor.visualRole;
        const changingProperties = ["set", "replace", "only"].includes(requirement.operation);
        let color = result.colors.find((candidate) => (affectsScope(requirement.scope, candidate.scope) || requirement.scope.kind === "part") && (changingProperties ? descriptorMatchesForUpdate(candidate, descriptor) : descriptorMatches(candidate, descriptor)));
        if (!color) {
          color = { colorId: `${requirementId}:color:${index + 1}`, name: descriptor.name, family: descriptor.family, hex: descriptor.hex?.toUpperCase(), visualRole: explicitVisualRole ?? (requirement.scope.kind === "sensors" ? "glow" : requirement.scope.kind === "inner-frame" ? "frame" : requirement.scope.kind === "markings" ? "marking" : "primary"), scope: requirement.scope, presence: "required", constraintIds: [] };
          result.colors.push(color);
        }
        const replaceColorProperty = (property: IntentConstraint["property"]) => supersede(result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.property === property && (affectsScope(requirement.scope, constraint.scope) || (constraint.strength === "soft" && property === "color-coverage")) && overridable(constraint)), requirementId, "Current user input updates this color property and scope while preserving unrelated requirements");
        if (descriptor.family) replaceColorProperty("color-family");
        if (descriptor.hex) replaceColorProperty("color-hex");
        if (explicitVisualRole) replaceColorProperty("color-importance");
        if (descriptor.coveragePercent !== undefined) replaceColorProperty("color-coverage");
        else if (["replace", "only"].includes(requirement.operation) && color.coverage?.strength === "soft") {
          replaceColorProperty("color-coverage"); delete color.coverage;
        }
        requiredIds.push(color.colorId);
        color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:presence`, property: "color-presence", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: "clearly-visible", evidence }));
        color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:scope`, property: "color-scope", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: requirement.scope.part ?? requirement.scope.kind, evidence }));
        if (explicitVisualRole) {
          // Explicit importance is authoritative over the interpreter's inferred anchor role.
          color.visualRole = explicitVisualRole;
          if (["primary", "secondary"].includes(explicitVisualRole) && descriptor.coveragePercent === undefined) {
            supersede(result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.property === "color-coverage" && constraint.strength === "soft" && constraint.status === "active"), requirementId, "Explicit major armor importance replaces inferred style coverage without inventing a user percentage");
          }
          color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:importance`, property: "color-importance", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: explicitVisualRole, evidence }));
        }
        if (descriptor.family) { color.family = descriptor.family; color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:family`, property: "color-family", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: descriptor.family, evidence })); }
        if (descriptor.hex) { color.hex = descriptor.hex.toUpperCase(); color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:hex`, property: "color-hex", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: color.hex, evidence })); }
        if (descriptor.coveragePercent !== undefined) {
          supersede(result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.property === "color-coverage" && constraint.strength === "soft"), requirementId, "Explicit percentage replaces inferred coverage");
          color.coverage = { scope: requirement.scope.kind, ...(requirement.scope.part ? { part: requirement.scope.part } : {}), percent: descriptor.coveragePercent, strength: "hard", source: "user-explicit" };
          color.constraintIds.push(addConstraint({ id: `${requirementId}:${index}:coverage`, property: "color-coverage", colorId: color.colorId, scope: requirement.scope, strength: "hard", value: descriptor.coveragePercent, evidence }));
        } else if (color.coverage?.strength === "soft" && ["replace", "only"].includes(requirement.operation)) {
          supersede(result.constraints.filter((constraint) => constraint.colorId === color.colorId && constraint.property === "color-coverage" && constraint.strength === "soft"), requirementId, "A replacement color combination does not preserve inferred style percentages");
          delete color.coverage;
        }
      }
      if (prefix === "notes" && requirement.operation === "add") {
        for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.property === "allowed-colors" && sameScope(candidate.scope, requirement.scope) && hasDescriptionOrigin(candidate))) {
          const expanded = Array.from(new Set([...(constraint.value as string[]), ...requiredIds]));
          if (expanded.length === (constraint.value as string[]).length) continue;
          supersede([constraint], requirementId, "Current additive color request expands only the saved-description allowed set in this scope");
          addConstraint({ id: `resolver:description-add:${requirementId}:${constraint.id}`, property: "allowed-colors", scope: constraint.scope, strength: constraint.strength, value: expanded, evidence: { source: "system-rule", inputRef: constraint.id } });
        }
      }
      if (requirement.operation === "only") addConstraint({ id: `${requirementId}:allowed`, property: "allowed-colors", scope: requirement.scope, strength: "hard", value: requiredIds, evidence });
    }
  }
  // Keep the compact color metadata synchronized with active property constraints.
  // A collection change may supersede an old ratio without replacing its color ID.
  for (const color of result.colors) {
    const active = result.constraints.filter((constraint) => constraint.status === "active" && constraint.colorId === color.colorId && constraint.property === "color-coverage");
    const coverage = active.filter((constraint) => constraint.strength === "hard").at(-1) ?? active.at(-1);
    if (!coverage) delete color.coverage;
    else color.coverage = { scope: coverage.scope.kind, ...(coverage.scope.part ? { part: coverage.scope.part } : {}), percent: coverage.value as number, strength: coverage.strength === "hard" ? "hard" : "soft", source: coverage.evidence.source === "user-explicit" ? "user-explicit" : coverage.evidence.source === "ai-inference" ? "ai-inference" : "style-default" };
  }
  if (!result.colors.length || result.colors.length > maxCreativeColors) result.conflicts.push({ property: "colors", message: `A palette requires 1–${maxCreativeColors} effective colors; simplify the request explicitly`, constraintIds: [] });
  for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.property === "excluded-color")) {
    const contradicted = result.colors.filter((color) => affectsScope(constraint.scope, color.scope) && (constraint.value === color.hex || constraint.value === color.family));
    if (contradicted.length) result.conflicts.push({ property: "colors", message: "An excluded color is also required in the same scope", constraintIds: [constraint.id, ...contradicted.flatMap((color) => color.constraintIds)] });
  }
  for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.property === "allowed-colors" && candidate.scope.kind !== "part")) {
    const outside = result.colors.filter((color) => affectsScope(constraint.scope, color.scope) && !(constraint.value as string[]).includes(color.colorId));
    if (outside.length) result.conflicts.push({ property: "colors", message: "An added color conflicts with the explicitly limited color set", constraintIds: [constraint.id, ...outside.flatMap((color) => color.constraintIds)] });
  }
  const coverageScopes = new Map<string, { scope: IntentScope; percent: number; colorIds: string[] }>();
  for (const color of result.colors.filter((candidate) => candidate.coverage?.strength === "hard")) {
    const coverage = color.coverage!;
    const key = `${coverage.scope}:${coverage.part ?? ""}`;
    const group = coverageScopes.get(key) ?? { scope: { kind: coverage.scope, ...(coverage.part ? { part: coverage.part } : {}) }, percent: 0, colorIds: [] };
    group.percent += coverage.percent;
    group.colorIds.push(color.colorId);
    coverageScopes.set(key, group);
  }
  for (const [scope, group] of coverageScopes) {
    if (group.percent > 100 + 1e-8) result.conflicts.push({ property: "coverage", message: `Explicit coverage in ${scope} exceeds 100%`, constraintIds: result.constraints.filter((constraint) => constraint.property === "color-coverage" && constraint.strength === "hard").map((constraint) => constraint.id) });
    if (Math.abs(group.percent - 100) < 1e-8) {
      addConstraint({ id: `resolver:full-coverage:${scope}`, property: "allowed-colors", scope: group.scope, strength: "hard", value: group.colorIds, evidence: { source: "system-rule", inputRef: `resolved.coverage.${scope}` } });
      const outside = result.colors.filter((color) => affectsScope(group.scope, color.scope) && !group.colorIds.includes(color.colorId));
      if (outside.length) result.conflicts.push({ property: "coverage", message: `The explicit 100% coverage in ${scope} leaves no area for additional colors in that scope`, constraintIds: [`resolver:full-coverage:${scope}`, ...outside.flatMap((color) => color.constraintIds)] });
    }
  }
  const hardProperties = new Map<string, IntentConstraint[]>();
  for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.strength === "hard" && ["color-family", "color-hex", "color-coverage", "color-importance"].includes(candidate.property))) {
    const key = `${constraint.colorId}:${constraint.property}:${constraint.scope.kind}:${constraint.scope.part ?? ""}`;
    hardProperties.set(key, [...(hardProperties.get(key) ?? []), constraint]);
  }
  for (const constraints of hardProperties.values()) if (new Set(constraints.map((constraint) => JSON.stringify(constraint.value))).size > 1) result.conflicts.push({ property: constraints[0].property, message: "Conflicting explicit values apply to the same color property and scope", constraintIds: constraints.map((constraint) => constraint.id) });
  const armorColors = result.colors.filter((color) => color.scope.kind === "exterior-armor");
  const comparableHardArmorCoverage = armorColors.filter((color) => color.coverage?.strength === "hard" && color.coverage.scope === "exterior-armor" && !color.coverage.part);
  const hierarchy = comparableHardArmorCoverage.length ? [...comparableHardArmorCoverage].sort((left, right) => right.coverage!.percent - left.coverage!.percent) : armorColors;
  const primary = hierarchy.at(0) ?? result.colors.at(0);
  const secondary = hierarchy.at(1);
  const accent = result.colors.find((color) => color.visualRole === "accent" || color.visualRole === "marking");
  result.effectiveStyle.palette = { primary: primary?.name ?? "unresolved palette", ...(secondary ? { secondary: secondary.name } : {}), ...(accent ? { accent: accent.name } : {}) };
  const inferredAnchors = styleAnchors(originalStyle);
  const promotedMajorColors = result.colors.filter((color) => ["primary", "secondary"].includes(color.visualRole) && ["exterior-armor", "part"].includes(color.scope.kind) && inferredAnchors.some((anchor) => anchor.colorId === color.colorId && !["primary", "secondary"].includes(anchor.visualRole)) && result.constraints.some((constraint) => constraint.status === "active" && constraint.colorId === color.colorId && constraint.property === "color-importance" && ["primary", "secondary"].includes(String(constraint.value))));
  if (promotedMajorColors.length) {
    result.effectiveStyle.surfaceLogic = "Use existing segmented armor faces for the resolved color hierarchy. Each explicit major armor color needs a broad existing armor-panel group; small vents, antenna tips, emblems or trim alone do not satisfy it. Follow explicit percentages only when supplied, retaining the effective contrast and pattern.";
    if (promotedMajorColors.some((color) => mentionsColor(result.effectiveStyle.graphicLanguage, color))) result.effectiveStyle.graphicLanguage = "Keep the effective marking density and pattern on existing surfaces. Conventional small markings may reuse approved colors, but each explicit major armor color must also occupy a broad armor face outside those markings.";
    result.decisions.push({ requirementId: "resolver:importance-language", supersededConstraintIds: [], reason: "Explicit major importance supersedes inferred localized color-layout prose; unaffected graphics, mood and structured style language remain available." });
  }
  // Keep the visual language, but scrub overridden hue/finish words before downstream execution.
  if (result.decisions.some((decision) => decision.supersededConstraintIds.some((id) => id.startsWith("style-color-")))) {
    const removed = styleAnchors(originalStyle).filter((color) => !result.colors.some((remaining) => remaining.colorId === color.colorId));
    result.effectiveStyle.name = omitOriginalColorInstructions(result.effectiveStyle.name, removed, result.colors);
    result.effectiveStyle.surfaceLogic = omitOriginalColorInstructions(result.effectiveStyle.surfaceLogic, removed, result.colors);
    result.effectiveStyle.graphicLanguage = omitOriginalColorInstructions(result.effectiveStyle.graphicLanguage, removed, result.colors);
    result.effectiveStyle.mood = omitOriginalColorInstructions(result.effectiveStyle.mood, removed, result.colors);
    result.effectiveStyle.materialIntent = result.effectiveStyle.materialIntent.map((language) => omitOriginalColorInstructions(language, removed, result.colors));
    for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.strength === "soft" && ["mood", "material"].includes(candidate.property))) {
      const scrubbed = typeof constraint.value === "string" ? omitOriginalColorInstructions(constraint.value, removed, result.colors) : Array.isArray(constraint.value) ? constraint.value.map((value) => omitOriginalColorInstructions(value, removed, result.colors)) : constraint.value;
      if (JSON.stringify(scrubbed) !== JSON.stringify(constraint.value)) {
        supersede([constraint], "resolver:color-language", "Remove overridden color wording from active visual language");
        addConstraint({ ...constraint, id: `${constraint.id}:effective`, value: scrubbed });
      }
    }
  }
  if (result.constraints.some((constraint) => constraint.status === "active" && ["finish", "material", "weathering"].includes(constraint.property) && constraint.evidence.source !== styleSource)) {
    for (const property of ["name", "surfaceLogic", "graphicLanguage", "mood"] as const) result.effectiveStyle[property] = result.effectiveStyle[property].replace(/semi-gloss|matte|satin|gloss/gi, result.effectiveStyle.finish);
    result.effectiveStyle.materialIntent = result.effectiveStyle.materialIntent.map((value) => value.replace(/semi-gloss|matte|satin|gloss/gi, result.effectiveStyle.finish));
    for (const constraint of result.constraints.filter((candidate) => candidate.status === "active" && candidate.strength === "soft" && ["mood", "material"].includes(candidate.property))) {
      const scrubbed = typeof constraint.value === "string" ? constraint.value.replace(/semi-gloss|matte|satin|gloss/gi, result.effectiveStyle.finish) : Array.isArray(constraint.value) ? constraint.value.map((value) => value.replace(/semi-gloss|matte|satin|gloss/gi, result.effectiveStyle.finish)) : constraint.value;
      if (JSON.stringify(scrubbed) !== JSON.stringify(constraint.value)) {
        supersede([constraint], "resolver:finish-language", "Remove contradictory finish wording from active visual language");
        addConstraint({ ...constraint, id: `${constraint.id}:finish-effective`, value: scrubbed });
      }
    }
    if (result.effectiveStyle.weathering === "clean") result.effectiveStyle.surfaceLogic = "Paint existing panels with crisp separation and the resolved finish; preserve existing surface construction without dirt, wear or chipping.";
  }
  return result;
}

export function assertExecutableIntent(intent: ResolvedCreativeIntent) {
  if (intent.conflicts.length) throw new Error(intent.conflicts.map((conflict) => conflict.message).join("; "));
  if (intent.unresolved.length) throw new Error(intent.unresolved.map((item) => `${item.text}: ${item.reason}`).join("; "));
}

/** Behavior-only execution DTO; StyleIntent metadata and its original palette stay in storage. */
export function effectiveStyleForExecution(intent: ResolvedCreativeIntent) {
  const style = intent.effectiveStyle;
  const explicitMajorColors = intent.colors.filter((color) => ["exterior-armor", "part"].includes(color.scope.kind) && intent.constraints.some((constraint) => constraint.status === "active" && constraint.colorId === color.colorId && constraint.property === "color-importance" && ["primary", "secondary"].includes(String(constraint.value))));
  return {
    surfaceLogic: explicitMajorColors.length ? `Each of these explicit major armor colors needs at least one broad existing armor-panel group: ${explicitMajorColors.map((color) => color.name).join(", ")}. Small vents, antenna tips, emblems or narrow trim alone cannot satisfy them. Preserve the effective contrast, pattern and finish; numeric coverage follows only supplied constraints.` : style.surfaceLogic,
    graphicLanguage: style.graphicLanguage,
    contrast: style.contrast,
    markingDensity: style.markingDensity,
    materialIntent: [...style.materialIntent],
    mood: style.mood,
    weathering: style.weathering,
    finish: style.finish,
    paintability: style.paintability,
    pattern: style.pattern ?? "none",
  };
}

/** Role permissions belong to each resolved color, never to a six-slot global palette. */
export function requiredPaletteRolesForExecution(intent: ResolvedCreativeIntent, approvedRoleSlugs?: string[]) {
  const roles = approvedRoleSlugs ?? ["primary-armor", "secondary-armor", "inner-frame", "accent", "markings", "sensor-color"];
  return intent.colors.map((color) => ({
    colorId: color.colorId,
    colorName: color.name,
    visualRole: color.visualRole,
    scope: color.scope,
    allowedRoleSlugs: roles.filter((role) => colorAcceptsRole(color, role)),
  }));
}

/** Execution projection deliberately omits original inputs and superseded instructions. */
export function resolvedIntentForExecution(intent: ResolvedCreativeIntent) {
  assertExecutableIntent(intent);
  return {
    version: intent.version, resolverVersion: intent.resolverVersion, kit: intent.kit,
    effectiveStyle: effectiveStyleForExecution(intent), colors: intent.colors,
    colorRolePermissions: requiredPaletteRolesForExecution(intent),
    constraints: intent.constraints.filter((constraint) => constraint.status === "active").map(({ evidence, status: _status, ...constraint }) => ({ ...constraint, source: evidence.source })),
    freeDimensions: intent.freeDimensions,
  };
}

const armorRoles = new Set(["primary-armor", "secondary-armor", "accent"]);
function scopeAcceptsRole(scope: IntentScope, role: string) {
  if (scope.kind === "exterior-armor" || scope.kind === "part") return armorRoles.has(role);
  if (scope.kind === "inner-frame") return role === "inner-frame";
  if (scope.kind === "sensors") return role === "sensor-color";
  if (scope.kind === "markings") return role === "markings";
  return true;
}
function colorAcceptsRole(color: ResolvedIntentColor, role: string) {
  if ((color.visualRole === "primary" || color.visualRole === "secondary") && ["exterior-armor", "part"].includes(color.scope.kind)) return role === "primary-armor" || role === "secondary-armor";
  return scopeAcceptsRole(color.scope, role);
}
export function validateResolvedPalette(value: unknown, intent: ResolvedCreativeIntent, approvedRoleSlugs?: string[]) {
  assertExecutableIntent(intent);
  const palette = paletteV3Schema.parse(value);
  const deviations: Array<{ constraintId: string; reason: string }> = [];
  if (approvedRoleSlugs && palette.entries.some((entry) => !approvedRoleSlugs.includes(entry.roleSlug))) throw new Error("Palette uses an unknown role");
  for (const color of intent.colors) {
    const entry = palette.entries.find((candidate) => candidate.colorId === color.colorId);
    if (!entry) throw new Error(`Palette omitted effective color ${color.name}`);
    if (!colorAcceptsRole(color, entry.roleSlug)) throw new Error(`Palette moved ${color.name} outside its approved color scope or visual importance`);
    for (const constraint of intent.constraints.filter((candidate) => candidate.colorId === color.colorId && candidate.status === "active")) {
      const valid = constraint.property === "color-hex" ? entry.targetHex.toUpperCase() === constraint.value : constraint.property === "color-family" ? hexMatchesColorFamily(entry.targetHex, constraint.value as ColorFamily) : constraint.property === "color-coverage" ? !!entry.coverage && entry.coverage.percent === constraint.value && entry.coverage.scope === constraint.scope.kind && entry.coverage.part === constraint.scope.part : true;
      if (!valid && constraint.strength === "hard") throw new Error(`Palette violates ${constraint.property} for ${color.name}`);
      if (!valid && constraint.strength === "soft") deviations.push({ constraintId: constraint.id, reason: `AI palette differs from the soft ${constraint.property} style guidance` });
    }
  }
  for (const entry of palette.entries) {
    const color = intent.colors.find((candidate) => candidate.colorId === entry.colorId);
    if (entry.coverage?.source === "resolved-constraint" && (!color?.coverage || entry.coverage.percent !== color.coverage.percent || entry.coverage.scope !== color.coverage.scope || entry.coverage.part !== color.coverage.part)) throw new Error("Palette mislabeled AI coverage as a resolved constraint");
    for (const constraint of intent.constraints.filter((candidate) => candidate.status === "active" && candidate.scope.kind !== "part" && scopeAcceptsRole(candidate.scope, entry.roleSlug))) {
      if (constraint.property === "allowed-colors" && !(constraint.value as string[]).includes(entry.colorId)) throw new Error("Palette added a color outside the explicit allowed color set");
      if (constraint.property === "excluded-color" && (entry.targetHex.toUpperCase() === constraint.value || (colorFamilies.includes(constraint.value as ColorFamily) && hexMatchesColorFamily(entry.targetHex, constraint.value as ColorFamily)))) throw new Error("Palette used an explicitly excluded color");
    }
  }
  for (let leftIndex = 0; leftIndex < palette.entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < palette.entries.length; rightIndex += 1) {
      const left = palette.entries[leftIndex], right = palette.entries[rightIndex];
      if (left.targetHex.toUpperCase() !== right.targetHex.toUpperCase() || left.paintEffect !== right.paintEffect) continue;
      const leftIntent = intent.colors.find((color) => color.colorId === left.colorId), rightIntent = intent.colors.find((color) => color.colorId === right.colorId);
      if (leftIntent && rightIntent && ((leftIntent.hex && rightIntent.hex && leftIntent.hex !== rightIntent.hex) || (leftIntent.family && rightIntent.family && leftIntent.family !== rightIntent.family))) throw new Error("Palette collapsed distinct effective colors into an identical HEX and effect");
    }
  }
  return { palette, deviations };
}

export function validateResolvedSpecification(value: unknown, paletteInput: { entries: Array<{ colorId?: string; colorName?: string; roleSlug: string; targetHex: string }> }, intent: ResolvedCreativeIntent) {
  assertExecutableIntent(intent);
  const specification = repaintV3Schema.parse(value);
  for (const panel of specification.panels) {
    if (!paletteInput.entries.some((entry) => entry.colorId === panel.colorId)) throw new Error("Specification references an unknown color");
    const knownRoles = ["primary-armor", "secondary-armor", "inner-frame", "accent", "markings", "sensor-color"];
    if (!knownRoles.includes(panel.roleSlug)) throw new Error("Specification uses an unknown role");
    for (const constraint of intent.constraints.filter((candidate) => candidate.status === "active" && ["allowed-colors", "excluded-color"].includes(candidate.property))) {
      const applies = constraint.scope.kind === "part" ? panel.areas.some((area) => area.toLowerCase().includes(constraint.scope.part!.toLowerCase())) : scopeAcceptsRole(constraint.scope, panel.roleSlug);
      if (applies && constraint.property === "allowed-colors" && !(constraint.value as string[]).includes(panel.colorId)) throw new Error("Specification violates a scoped color set");
      const paletteColor = paletteInput.entries.find((entry) => entry.colorId === panel.colorId)!;
      if (applies && constraint.property === "excluded-color" && (paletteColor.targetHex.toUpperCase() === constraint.value || (colorFamilies.includes(constraint.value as ColorFamily) && hexMatchesColorFamily(paletteColor.targetHex, constraint.value as ColorFamily)))) throw new Error("Specification uses an explicitly excluded color in this part");
    }
  }
  for (const entry of paletteInput.entries) {
    if (!entry.colorId) throw new Error("Resolved specifications require a palette with stable color IDs");
    const panels = specification.panels.filter((panel) => panel.colorId === entry.colorId);
    if (!panels.length) throw new Error(`Specification omitted effective color ${entry.colorName}`);
    const color = intent.colors.find((candidate) => candidate.colorId === entry.colorId);
    if (color && !panels.some((panel) => colorAcceptsRole(color, panel.roleSlug))) throw new Error(`Specification moved ${color.name} to an unapproved scope or visual importance`);
    for (const constraint of intent.constraints.filter((candidate) => candidate.status === "active" && candidate.colorId === entry.colorId && candidate.property === "color-scope")) {
      if (!panels.some((panel) => scopeAcceptsRole(constraint.scope, panel.roleSlug) && (constraint.scope.kind !== "part" || panel.areas.some((area) => area.toLowerCase().includes(constraint.scope.part!.toLowerCase()))))) throw new Error(`Specification omitted the required scope for ${color?.name ?? entry.colorName}`);
    }
    for (const constraint of intent.constraints.filter((candidate) => candidate.status === "active" && candidate.colorId === entry.colorId && candidate.property === "color-importance")) {
      const acceptedRoles = constraint.value === "primary" || constraint.value === "secondary" ? ["primary-armor", "secondary-armor"] : constraint.value === "frame" ? ["inner-frame"] : constraint.value === "glow" ? ["sensor-color"] : constraint.value === "marking" ? ["markings"] : constraint.value === "accent" ? ["accent"] : ["primary-armor", "secondary-armor", "accent"];
      if (!panels.some((panel) => acceptedRoles.includes(panel.roleSlug))) throw new Error(`Specification omitted the requested visual purpose for ${color?.name ?? entry.colorName}`);
    }
  }
  if (specification.weathering.level !== intent.effectiveStyle.weathering) throw new Error("Specification changed the resolved weathering level");
  if (specification.material.finish !== intent.effectiveStyle.finish) throw new Error("Specification changed the resolved surface finish");
  if (JSON.stringify(specification.material.intent) !== JSON.stringify(intent.effectiveStyle.materialIntent)) throw new Error("Specification changed the resolved material intent");
  return specification;
}
