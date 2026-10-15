import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { creativeInputKey, creativeTemplateSeeds, currentNormalizedUserIntentSchema, fillCreativeTemplate, hasIndexableStyle, legacyCreativeInputKey, normalizedUserIntentSchema, paletteV3Schema, repaintV3Schema, sourceNormalizationProtocolVersion, styleIntentSchema, type NormalizedRequirement, type NormalizedUserIntent } from "./creativeContracts";
import { promptTemplateVariableDefinitions } from "./promptTemplateVariables";
import { assertExecutableIntent, effectiveStyleForExecution, hexMatchesColorFamily, requiredPaletteRolesForExecution, resolveCreativeIntent, resolvedCreativeIntentSchema, resolvedIntentForExecution, validateNormalizedUserIntent, validateResolvedPalette, validateResolvedSpecification, type ResolvedCreativeIntent } from "./creativeIntentResolver";

const style = styleIntentSchema.parse({
  version: "style-intent.v2", source: "official", styleType: "preset", name: "Arctic Operations",
  palette: { primary: "red", secondary: "white", accent: "orange" }, surfaceLogic: "Red armor with white panels, matte finish",
  graphicLanguage: "Orange warning trim", contrast: "high", markingDensity: "low", materialIntent: ["matte painted armor"],
  mood: "Cold technical", weathering: "clean", finish: "matte", paintability: "high", pattern: "none",
  colors: [
    { role: "primary", name: "Crimson red", hex: "#C82030", coverage: 55 },
    { role: "secondary", name: "Ice white", hex: "#E8EDF1", coverage: 30 },
    { role: "frame", name: "Frame gray", hex: "#484848", coverage: 10 },
    { role: "accent", name: "Signal orange", hex: "#F08020", coverage: 5 },
  ],
});
const requirement = (quote: string, overrides: Partial<NormalizedRequirement> = {}): NormalizedRequirement => ({
  id: "colors", property: "colors", operation: "replace", scope: { kind: "exterior-armor" },
  colors: [{ name: "Blue", family: "blue" }, { name: "White", family: "white" }],
  evidence: { inputRef: "notes", quote }, ...overrides,
});
const notes = (requirements: NormalizedRequirement[]): NormalizedUserIntent => ({ version: "normalized-user-intent.v1", requirements, unresolved: [] });
function resolve(quote: string, overrides: Partial<NormalizedRequirement> = {}) {
  return resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: notes([requirement(quote, overrides)]) });
}
function paletteFor(intent: ResolvedCreativeIntent) {
  return paletteV3Schema.parse({ version: "visual-palette.v3", entries: intent.colors.map((color) => ({
    colorId: color.colorId, colorName: color.name, roleSlug: color.scope.kind === "inner-frame" ? "inner-frame" : color.scope.kind === "sensors" ? "sensor-color" : color.scope.kind === "markings" ? "markings" : "primary-armor",
    targetHex: color.hex ?? (color.family === "blue" ? "#2358C0" : "#EBEDF0"), paintEffect: "solid", rationale: "Retain effective palette color",
    ...(color.coverage ? { coverage: { scope: color.coverage.scope, ...(color.coverage.part ? { part: color.coverage.part } : {}), percent: color.coverage.percent, source: "resolved-constraint" } } : {}),
  })), sprayNotes: ["Mask each existing armor panel"] });
}
function specFor(intent: ResolvedCreativeIntent) {
  const palette = paletteFor(intent);
  return repaintV3Schema.parse({ version: "repaint-specification.v3", summary: "Paint existing kit",
    panels: palette.entries.map((color, index) => ({ assignmentId: `panel-${index + 1}`, colorId: color.colorId, roleSlug: color.roleSlug, areas: ["Chest armor"], maskingNotes: "Mask adjacent panels" })),
    material: { surfaceTexture: "Smooth paint", reflectivity: "Matte reflection", coating: "Matte coat", finish: intent.effectiveStyle.finish, intent: intent.effectiveStyle.materialIntent },
    weathering: { level: intent.effectiveStyle.weathering, applicationNotes: "Follow resolved weathering" },
    decals: { density: "low", placementNotes: "Small conventional markings" },
  });
}

describe("Creative Intent deterministic resolution", () => {
  it("combines independent mood clauses from one saved description and preserves their evidence", () => {
    const source = "hazard unit  Industrial Alert";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom",
      explicitRequirements: notes([
        requirement("hazard unit", { id: "hazard", property: "mood", operation: "set", scope: { kind: "whole-kit" }, colors: undefined,
          value: "industrial hazard support", evidence: { inputRef: "style-description", quote: "hazard unit" } }),
        requirement("Industrial Alert", { id: "alert", property: "mood", operation: "set", scope: { kind: "whole-kit" }, colors: undefined,
          value: "high-visibility warning", evidence: { inputRef: "style-description", quote: "Industrial Alert" } }),
      ]) });
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: source });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(() => resolvedCreativeIntentSchema.parse(intent)).not.toThrow();
    expect(intent.effectiveStyle.mood).toBe("industrial hazard support, high-visibility warning");
    expect(intent.constraints.filter(c => c.property === "mood" && c.status === "active")).toMatchObject([
      { id: "description:hazard", strength: "hard", evidence: { quote: "hazard unit" } },
      { id: "description:alert", strength: "hard", evidence: { quote: "Industrial Alert" } },
    ]);
    expect(intent.originalStyle).toEqual(saved);
  });

  it.each(["set", "add", "preserve"] as const)("combines %s mood clauses within Notes without repeating duplicate qualities", operation => {
    const quote = "Industrial, alert, industrial";
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: notes(
      ["industrial", "alert", "industrial"].map((value, index) => requirement(quote, {
        id: `mood-${index}`, property: "mood", operation, scope: { kind: "whole-kit" }, colors: undefined, value,
      })),
    ) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.effectiveStyle.mood).toBe("industrial, alert");
  });

  it.each(["set", "add"] as const)("%s mood Notes retain the existing description precedence", operation => {
    const source = "Industrial";
    const saved = styleIntentSchema.parse({ ...style, explicitRequirements: notes([
      requirement(source, { id: "industrial", property: "mood", operation: "set", scope: { kind: "whole-kit" }, colors: undefined,
        value: "industrial", evidence: { inputRef: "style-description", quote: source } }),
    ]) });
    const quote = "Alert and utilitarian";
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: quote, normalizedNotes: notes(
      ["alert", "utilitarian"].map(value => requirement(quote, {
        id: value, property: "mood", operation, scope: { kind: "whole-kit" }, colors: undefined, value,
      })),
    ) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.effectiveStyle.mood).toBe(operation === "add" ? "industrial, alert, utilitarian" : "alert, utilitarian");
    expect(intent.constraints.find(c => c.id === "description:industrial")?.status).toBe(operation === "add" ? "active" : "superseded");
  });

  it("still rejects an additional mood after an explicitly exclusive mood", () => {
    const quote = "Only industrial. Add ceremonial.";
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: notes([
      requirement(quote, { id: "only", property: "mood", operation: "only", scope: { kind: "whole-kit" }, colors: undefined, value: "industrial" }),
      requirement(quote, { id: "add", property: "mood", operation: "add", scope: { kind: "whole-kit" }, colors: undefined, value: "ceremonial" }),
    ]) });
    expect(() => assertExecutableIntent(intent)).toThrow(ConvexError);
    expect(intent.conflicts).toContainEqual(expect.objectContaining({ property: "mood" }));
  });

  it.each([
    { property: "finish", values: ["matte", "gloss"] },
    { property: "weathering", values: ["clean", "heavy"] },
  ] as const)("keeps conflicting $property values as visible business errors", ({ property, values }) => {
    const quote = values.join(" and ");
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: notes(values.map((value, index) =>
      requirement(quote, { id: `${property}-${index}`, property, operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value }),
    )) });
    expect(() => assertExecutableIntent(intent)).toThrow(ConvexError);
    expect(() => assertExecutableIntent(intent)).toThrow(`Explicit ${property} conflicts`);
  });

  it("replaces style armor colors with blue and white without inferring 50:50 or HEX locks", () => {
    const before = JSON.stringify(style);
    const intent = resolve("blue and white color combination");
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.family).sort()).toEqual(["blue", "white"]);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").every((color) => !color.coverage)).toBe(true);
    expect(intent.constraints.filter((constraint) => constraint.status === "active" && constraint.strength === "hard" && ["color-hex", "color-coverage"].includes(constraint.property))).toEqual([]);
    expect(intent.constraints.some((constraint) => constraint.property === "color-family" && constraint.strength === "hard")).toBe(true);
    expect(intent.colors.some((color) => color.scope.kind === "inner-frame")).toBe(true);
    expect(JSON.stringify(style)).toBe(before);
    expect(intent.originalStyle).toEqual(style);
    expect(intent.styleModified).toBe(true);
    expect(resolve("blue and white color combination")).toEqual(intent);
    expect(() => resolvedCreativeIntentSchema.parse(intent)).not.toThrow();
  });

  it("locks an explicit 70:30 armor ratio with source evidence and scope", () => {
    const quote = "70% blue armor, 30% white armor";
    const intent = resolve(quote, { colors: [{ name: "Blue", family: "blue", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }] });
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.coverage)).toEqual([
      { scope: "exterior-armor", percent: 30, strength: "hard", source: "user-explicit" },
      { scope: "exterior-armor", percent: 70, strength: "hard", source: "user-explicit" },
    ]);
    const active = intent.constraints.filter((constraint) => constraint.property === "color-coverage" && constraint.strength === "hard" && constraint.status === "active");
    expect(active).toHaveLength(2);
    expect(active.every((constraint) => constraint.evidence.quote === quote && constraint.scope.kind === "exterior-armor")).toBe(true);
    expect(() => validateResolvedPalette(paletteFor(intent), intent)).not.toThrow();
    const wrong = paletteFor(intent);
    wrong.entries.find((entry) => entry.coverage?.percent === 70)!.coverage!.percent = 50;
    expect(() => validateResolvedPalette(wrong, intent)).toThrow("color-coverage");
  });

  it("keeps inferred style coverage soft and does not reinterpret it as exterior armor", () => {
    const intent = resolveCreativeIntent({ styleIntent: style });
    expect(intent.colors.every((color) => color.coverage?.strength === "soft" && color.coverage.scope === "whole-kit")).toBe(true);
    expect(intent.constraints.filter((constraint) => constraint.property === "color-coverage").every((constraint) => constraint.strength === "soft")).toBe(true);
  });

  it("preserves seven anchored colors sharing a single visual role", () => {
    const rainbow = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([]),
      colors: ["#E53935", "#2868DD", "#38A85A", "#F38428", "#8144B9", "#F9D749", "#ED73BA"].map((hex, index) => ({ role: "primary", name: `Spectrum ${index}`, hex, coverage: 14 })) });
    const intent = resolveCreativeIntent({ styleIntent: rainbow });
    const palette = paletteFor(intent);
    expect(palette.entries).toHaveLength(7);
    expect(new Set(palette.entries.map((entry) => entry.roleSlug)).size).toBe(1);
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
    expect(() => validateResolvedSpecification(specFor(intent), palette, intent)).not.toThrow();
    expect(intent.constraints.filter((constraint) => constraint.property === "color-hex").every((constraint) => constraint.strength === "soft" && constraint.evidence.source === "ai-inference")).toBe(true);
  });

  it("reports incompatible active material selections instead of silently choosing", () => {
    const quote = "gloss finish";
    const normalizedNotes = notes([requirement(quote, { property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "gloss" })]);
    const intent = resolveCreativeIntent({ styleIntent: style, material: { name: "Matte armor", finish: "matte" }, selectionSources: { material: "user-selection" }, notes: quote, normalizedNotes });
    expect(intent.conflicts[0].property).toBe("finish");
    expect(() => assertExecutableIntent(intent)).toThrow("conflicts");
    const explicitOverride = resolveCreativeIntent({ styleIntent: style, material: { name: "Matte armor", finish: "matte" }, selectionSources: { material: "user-selection" }, notes: quote,
      normalizedNotes: notes([{ ...normalizedNotes.requirements[0], overridesSelection: true }]) });
    expect(explicitOverride.effectiveStyle.finish).toBe("gloss");
    expect(explicitOverride.conflicts).toEqual([]);
  });

  it("lets text override automatic finish/weathering defaults", () => {
    const quote = "gloss finish, heavy weathering";
    const intent = resolveCreativeIntent({ styleIntent: style, material: { name: "Matte armor", finish: "matte" }, weatheringLevel: "clean", notes: quote,
      normalizedNotes: notes([requirement(quote, { property: "finish", colors: undefined, value: "gloss", scope: { kind: "whole-kit" }, operation: "set" }), requirement(quote, { id: "weathering", property: "weathering", colors: undefined, value: "heavy", scope: { kind: "whole-kit" }, operation: "set" })]) });
    expect(intent.conflicts).toEqual([]);
    expect(intent.effectiveStyle.finish).toBe("gloss");
    expect(intent.effectiveStyle.weathering).toBe("heavy");
  });

  it("reports ambiguous or missing normalization and unsupported structural changes", () => {
    expect(() => assertExecutableIntent(resolveCreativeIntent({ styleIntent: style, notes: "make it different" }))).toThrow("normalized");
    const quote = "add a second head";
    const intent = resolve(quote, { property: "geometry", colors: undefined, value: "Add a second head", operation: "add", scope: { kind: "whole-kit" } });
    expect(() => assertExecutableIntent(intent)).toThrow("Custom Kit");
    const unresolved = resolveCreativeIntent({ styleIntent: style, notes: "blue maybe red", normalizedNotes: { version: "normalized-user-intent.v1", requirements: [], unresolved: [{ text: "blue maybe red", reason: "Choose the required hue" }] } });
    expect(() => assertExecutableIntent(unresolved)).toThrow("Choose the required hue");
  });

  it("uses source quotes to refuse invented exact HEX, percentages and provenance", () => {
    const quote = "blue and white";
    expect(() => validateNormalizedUserIntent(notes([requirement(quote, { colors: [{ name: "Blue", family: "blue", hex: "#2455FF" }] })]), { notes: quote })).toThrow("invented an exact HEX");
    expect(() => validateNormalizedUserIntent(notes([requirement(quote, { colors: [{ name: "Blue", family: "blue", coveragePercent: 50 }] })]), { notes: quote })).toThrow("invented an explicit coverage");
    expect(() => validateNormalizedUserIntent(notes([requirement("fake quote")]), { notes: quote })).toThrow("source evidence");
    expect(normalizedUserIntentSchema.safeParse(notes([requirement(quote), requirement(quote)])).success).toBe(false);
  });

  it("enforces an explicit HEX while permitting different shades for a hue-family requirement", () => {
    const quote = "use #2455FF and white";
    const exact = resolve(quote, { colors: [{ name: "Specified blue", hex: "#2455FF" }, { name: "White", family: "white" }] });
    const palette = paletteFor(exact);
    palette.entries.find((entry) => entry.targetHex === "#2455FF")!.targetHex = "#1C6CAA";
    expect(() => validateResolvedPalette(palette, exact)).toThrow("color-hex");
    const family = resolve("blue and white");
    const shades = paletteFor(family);
    shades.entries.find((entry) => entry.colorName === "Blue")!.targetHex = "#1C6CAA";
    expect(() => validateResolvedPalette(shades, family)).not.toThrow();
  });

  it("keeps original source and superseded color prose out of execution", () => {
    const intent = resolve("only blue and white", { operation: "only" });
    const execution = resolvedIntentForExecution(intent);
    expect(execution).not.toHaveProperty("originalStyle");
    expect(JSON.stringify(execution)).not.toContain("Crimson red");
    expect(JSON.stringify(execution)).not.toContain("#C82030");
    expect(JSON.stringify(execution)).not.toContain('"quote"');
    expect(intent.originalStyle.colors?.[0].name).toBe("Crimson red");
  });

  it("keeps edits scoped and rejects only-set conflicts or excessive ratio totals", () => {
    const only = resolve("only blue and white", { operation: "only" });
    const bad = paletteFor(only);
    bad.entries.push({ colorId: "new-red", colorName: "Red", roleSlug: "primary-armor", targetHex: "#D52835", paintEffect: "solid", rationale: "Additional color" });
    expect(() => validateResolvedPalette(bad, only)).toThrow("allowed color set");
    const quote = "70% blue armor, 70% white armor";
    expect(() => assertExecutableIntent(resolve(quote, { colors: [{ name: "Blue", family: "blue", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 70 }] }))).toThrow("exceeds 100%");
    const excluded = resolve("no red armor", { operation: "exclude", colors: [{ name: "Red", family: "red" }] });
    expect(excluded.colors.some((color) => color.family === "red")).toBe(false);
    expect(excluded.colors.some((color) => color.scope.kind === "inner-frame")).toBe(true);
  });

  it("retains a required chest placement while allowing the color elsewhere too", () => {
    const quote = "blue chest armor";
    const intent = resolve(quote, { operation: "add", colors: [{ name: "Blue", family: "blue" }], scope: { kind: "part", part: "chest" } });
    const palette = paletteFor(intent);
    const specification = specFor(intent);
    const blue = intent.colors.find((color) => color.family === "blue")!;
    specification.panels.push({ assignmentId: "blue-shoulder", colorId: blue.colorId, roleSlug: "secondary-armor", areas: ["Shoulder armor"], maskingNotes: "Mask seams" });
    expect(() => validateResolvedSpecification(specification, palette, intent)).not.toThrow();
    specification.panels.find((panel) => panel.colorId === blue.colorId)!.areas = ["Leg armor"];
    expect(() => validateResolvedSpecification(specification, palette, intent)).toThrow("required scope");
  });

  it("does not accept armor colors only on sensors or missing/unknown assignment references", () => {
    const intent = resolve("blue and white");
    const palette = paletteFor(intent);
    const blue = palette.entries.find((entry) => entry.colorName === "Blue")!;
    blue.roleSlug = "sensor-color";
    expect(() => validateResolvedPalette(palette, intent)).toThrow("scope");
    blue.roleSlug = "primary-armor";
    const spec = specFor(intent);
    spec.panels.find((panel) => panel.colorId === blue.colorId)!.roleSlug = "sensor-color";
    expect(() => validateResolvedSpecification(spec, palette, intent)).toThrow("scope");
    spec.panels[0].colorId = "absent-color";
    expect(() => validateResolvedSpecification(spec, palette, intent)).toThrow("unknown color");
  });

  it("validates source-backed custom interpreter requirements without hardening its inferred palette", () => {
    const quote = "blue and white";
    const custom = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom",
      explicitRequirements: notes([{ ...requirement(quote), evidence: { inputRef: "style-description", quote } }]) });
    expect(() => resolveCreativeIntent({ styleIntent: custom })).toThrow("source evidence");
    const intent = resolveCreativeIntent({ styleIntent: custom, styleDescription: quote });
    expect(intent.styleModified).toBe(false);
    expect(intent.constraints.some((constraint) => constraint.evidence.source === "user-explicit")).toBe(true);
    expect(intent.constraints.some((constraint) => constraint.property === "color-hex" && constraint.strength === "hard")).toBe(false);
  });

  it("changes new input keys with provenance and resolver versions while preserving legacy keys", () => {
    const input = { stylePresetId: "style", notes: "blue" };
    const legacy = legacyCreativeInputKey(input);
    expect(legacy).not.toContain("resolverVersion");
    expect(creativeInputKey(input)).not.toBe(legacy);
    expect(creativeInputKey(input, { legacy: true })).toBe(legacy);
    expect(creativeInputKey({ ...input, selectionSources: { material: "user-selection" } })).not.toBe(creativeInputKey(input));
    expect(creativeInputKey({ ...input, styleDescription: "blue source" })).not.toBe(creativeInputKey(input));
  });

  it("does not index a modified official preset as an unchanged preset", () => {
    expect(hasIndexableStyle({ stylePresetId: "official", styleIntentJson: JSON.stringify(style) })).toBe(true);
    expect(hasIndexableStyle({ stylePresetId: "official", styleIntentJson: JSON.stringify(style), resolvedIntentJson: JSON.stringify(resolve("blue and white")) })).toBe(false);
    expect(hasIndexableStyle({ stylePresetId: "official", styleIntentJson: JSON.stringify(style), resolvedIntentJson: JSON.stringify(resolveCreativeIntent({ styleIntent: style })) })).toBe(true);
    expect(hasIndexableStyle({ stylePresetId: "official", resolvedIntentJson: "bad JSON" })).toBe(false);
  });

  it("checks broad color families without assigning exact HEX values", () => {
    expect(hexMatchesColorFamily("#0033AA", "blue")).toBe(true);
    expect(hexMatchesColorFamily("#EE2222", "blue")).toBe(false);
    expect(hexMatchesColorFamily("#EEEEEE", "white")).toBe(true);
  });

  it("accepts whitespace and fractional percent evidence and rejects empty notes normalization", () => {
    const quote = "70 % blue armor, 30 percent white armor";
    expect(() => resolve(quote, { colors: [{ name: "Blue", family: "blue", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }] })).not.toThrow();
    expect(() => validateNormalizedUserIntent(notes([]), { notes: "make the shoulder blue" })).toThrow("no requirements");
    expect(() => validateNormalizedUserIntent(notes([]), { styleDescription: "Rainbow inspired" })).not.toThrow();
  });

  it("does not collapse separate effective colors into the same gray or demote primary colors to accents", () => {
    const intent = resolveCreativeIntent({ styleIntent: style });
    const collapsed = paletteFor(intent);
    collapsed.entries.forEach((entry) => { entry.targetHex = "#777777"; });
    expect(() => validateResolvedPalette(collapsed, intent)).toThrow("collapsed distinct");
    const palette = paletteFor(intent);
    palette.entries[0].roleSlug = "accent";
    expect(() => validateResolvedPalette(palette, intent)).toThrow("visual importance");
    const spec = specFor(intent);
    spec.panels[0].roleSlug = "accent";
    expect(() => validateResolvedSpecification(spec, paletteFor(intent), intent)).toThrow("visual importance");
  });

  it("refuses unsupported local finish rather than approving a global finish instead", () => {
    const intent = resolve("gloss shoulder only", { property: "finish", operation: "set", colors: undefined, value: "gloss", scope: { kind: "part", part: "shoulder" } });
    expect(intent.effectiveStyle.finish).toBe("matte");
    expect(() => assertExecutableIntent(intent)).toThrow("Local finish");
  });

  it("enforces per-part exclusions while permitting the same color on other parts", () => {
    const intent = resolve("no red on chest", { operation: "exclude", colors: [{ name: "Red", family: "red" }], scope: { kind: "part", part: "chest" } });
    const palette = paletteFor(intent);
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
    const spec = specFor(intent);
    expect(() => validateResolvedSpecification(spec, palette, intent)).toThrow("excluded color in this part");
    spec.panels[0].areas = ["Shoulder armor"];
    expect(() => validateResolvedSpecification(spec, palette, intent)).not.toThrow();
  });

  it("validates typed material properties and removes old finish wording after an override", () => {
    const quote = "override matte finish with gloss";
    const intent = resolveCreativeIntent({ styleIntent: style, material: { name: "Metallic matte armor", finish: "matte" }, selectionSources: { material: "user-selection" }, notes: quote,
      normalizedNotes: notes([requirement(quote, { property: "finish", colors: undefined, value: "gloss", scope: { kind: "whole-kit" }, operation: "set", overridesSelection: true })]) });
    expect(JSON.stringify(resolvedIntentForExecution(intent))).not.toMatch(/matte/i);
    expect(intent.effectiveStyle.materialIntent.join(" ")).toContain("Metallic");
    const spec = specFor(intent);
    spec.material.finish = "matte";
    expect(() => validateResolvedSpecification(spec, paletteFor(intent), intent)).toThrow("surface finish");
    spec.material.finish = "gloss";
    spec.material.intent = ["Wooden armor"];
    expect(() => validateResolvedSpecification(spec, paletteFor(intent), intent)).toThrow("material intent");
  });

  it("applies legacy source description before new notes regardless of normalization array order", () => {
    const styleDescription = "70% blue armor, 30% white armor";
    const newNotes = "only red and white armor";
    const descriptionRequirement = requirement(styleDescription, { evidence: { inputRef: "style-description", quote: styleDescription }, colors: [{ name: "Blue", family: "blue", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }] });
    const notesRequirement = requirement(newNotes, { id: "new-colors", operation: "only", colors: [{ name: "Red", family: "red" }, { name: "White", family: "white" }] });
    const custom = styleIntentSchema.parse({ ...style, source: "private", styleType: "custom" });
    const intent = resolveCreativeIntent({ styleIntent: custom, notes: newNotes, styleDescription, normalizedNotes: notes([notesRequirement, descriptionRequirement]) });
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.family).sort()).toEqual(["red", "white"]);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").some((color) => color.coverage?.strength === "hard")).toBe(false);
    expect(intent.styleModified).toBe(true);
    const descriptionOnly = resolveCreativeIntent({ styleIntent: custom, styleDescription, normalizedNotes: notes([descriptionRequirement]) });
    expect(descriptionOnly.styleModified).toBe(false);
    expect(descriptionOnly.originalStyle).toEqual(custom);
  });

  it("honors explicitly small accent colors instead of forcing them into major armor", () => {
    const intent = resolve("add small yellow accents", { operation: "add", colors: [{ name: "Yellow", family: "yellow", visualRole: "accent" }] });
    const yellow = intent.colors.find((color) => color.family === "yellow")!;
    expect(yellow.visualRole).toBe("accent");
    const palette = paletteFor(intent);
    palette.entries.find((entry) => entry.colorId === yellow.colorId)!.targetHex = "#F4D638";
    const spec = specFor(intent);
    spec.panels.find((panel) => panel.colorId === yellow.colorId)!.roleSlug = "accent";
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
    expect(() => validateResolvedSpecification(spec, palette, intent)).not.toThrow();
  });

  it("compiles the execution contract into both planning prompts with full color IDs and ratio scopes", () => {
    const quote = "70% blue armor, 30% white armor";
    const intent = resolve(quote, { colors: [{ name: "Blue", family: "blue", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }] });
    const values = { baseModel: "Existing kit geometry", resolvedIntent: JSON.stringify(resolvedIntentForExecution(intent)), stylePreset: JSON.stringify(intent.effectiveStyle), materialPreset: "Satin painted armor", mood: intent.effectiveStyle.mood, weatheringLevel: intent.effectiveStyle.weathering, colorRoles: "primary-armor, secondary-armor, inner-frame", paintCatalog: "Catalog capabilities", approvedPalette: JSON.stringify(paletteFor(intent)), notes: "Use only effective intent" };
    for (const kind of ["palette-plan", "repaint-concept"] as const) {
      const seed = creativeTemplateSeeds.find((candidate) => candidate.kind === kind)!;
      const prompt = fillCreativeTemplate(seed.userPromptTemplate, values);
      const line = prompt.split("\n").find((part) => part.startsWith("Effective creative intent JSON: "))!;
      const executed = JSON.parse(line.slice("Effective creative intent JSON: ".length));
      expect(executed.colors.map((color: { colorId: string }) => color.colorId)).toEqual(intent.colors.map((color) => color.colorId));
      expect(executed.constraints).toContainEqual(expect.objectContaining({ property: "color-coverage", strength: "hard", value: 70, scope: { kind: "exterior-armor" } }));
      expect(prompt).not.toContain(quote);
      expect(prompt).not.toContain('"originalStyle"');
      expect(prompt).not.toContain('"quote"');
      expect(promptTemplateVariableDefinitions.find((variable) => variable.key === "resolvedIntent")?.kinds).toContain(kind);
    }
  });

  it("combines explicit geometry preservation with system identity preservation and a color override", () => {
    const quote = "Keep the original silhouette and head; use blue and white armor";
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: notes([
      requirement(quote),
      requirement(quote, { id: "keep-silhouette", property: "geometry", operation: "preserve", colors: undefined, value: "Keep the original silhouette", scope: { kind: "whole-kit" }, overridesSelection: true }),
      requirement(quote, { id: "keep-head", property: "geometry", operation: "preserve", colors: undefined, value: "Keep the original head", scope: { kind: "part", part: "head" } }),
    ]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    const geometry = intent.constraints.filter((constraint) => constraint.property === "geometry" && constraint.status === "active");
    expect(geometry).toHaveLength(3);
    expect(geometry.every((constraint) => constraint.strength === "hard")).toBe(true);
    expect(geometry.some((constraint) => constraint.id === "system:geometry")).toBe(true);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.family).sort()).toEqual(["blue", "white"]);
    const edit = resolve("replace original head geometry", { property: "geometry", operation: "replace", colors: undefined, value: "Replace the original head", scope: { kind: "part", part: "head" } });
    expect(() => assertExecutableIntent(edit)).toThrow("Custom Kit");
  });

  it("accepts provider geometry-preserve transport without value and derives execution from its scope", () => {
    const quote = "Use blue and white armor. Keep original kit geometry.";
    const providerGeometry = { id: "geometry", property: "geometry" as const, operation: "preserve" as const, scope: { kind: "whole-kit" as const }, evidence: { inputRef: "notes" as const, quote: "Keep original kit geometry." } };
    const normalized = normalizedUserIntentSchema.parse(notes([requirement(quote), providerGeometry]));
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: normalized });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "notes:geometry", property: "geometry", status: "active", strength: "hard", value: "Preserve existing geometry within whole-kit" }));
    expect(intent.constraints.find((constraint) => constraint.id === "system:geometry")?.status).toBe("active");
    const execution = JSON.stringify(resolvedIntentForExecution(intent));
    expect(execution).not.toContain("Keep original kit geometry.");
    expect(execution).not.toContain('"quote"');
    for (const property of ["finish", "weathering", "material", "mood", "pattern"] as const) {
      expect(normalizedUserIntentSchema.safeParse(notes([{ ...providerGeometry, property, operation: "set" }])).success).toBe(false);
    }
    expect(normalizedUserIntentSchema.safeParse(notes([{ ...providerGeometry, operation: "replace" }])).success).toBe(false);
    expect(normalizedUserIntentSchema.safeParse(notes([{ ...providerGeometry, property: "colors" }])).success).toBe(false);
    expect(() => validateNormalizedUserIntent(notes([providerGeometry]), { notes: "Different source text" })).toThrow("source evidence");
  });

  it("keeps legacy Arctic frame and sensor outside a full 70:30 armor denominator", () => {
    const legacyArctic = styleIntentSchema.parse({ ...style, version: "style-intent.v1", colors: undefined,
      palette: { primary: "Arctic white #E8EDF1", secondary: "Cold slate blue #394E65", accent: "Warning orange #E88C32", neutrals: ["Cold gunmetal frame #363D44", "Ice blue sensor #7FC4E0"] } });
    const quote = "70% blue armor, 30% white armor";
    const intent = resolveCreativeIntent({ styleIntent: legacyArctic, notes: quote, normalizedNotes: notes([requirement(quote, { colors: [{ name: "Blue armor", family: "blue", coveragePercent: 70 }, { name: "White armor", family: "white", coveragePercent: 30 }] })]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.colors.find((color) => color.name === "Cold gunmetal frame")?.scope.kind).toBe("inner-frame");
    expect(intent.colors.find((color) => color.name === "Ice blue sensor")?.scope.kind).toBe("sensors");
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.coverage?.percent).sort()).toEqual([30, 70]);
    expect(intent.effectiveStyle.palette.primary).toBe("Cold slate blue");
    expect(intent.effectiveStyle.palette.secondary).toBe("Arctic white");
    const palette = paletteFor(intent);
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
    expect(() => validateResolvedSpecification(specFor(intent), palette, intent)).not.toThrow();
    const extra = { colorId: "extra-gray", colorName: "Extra gray", roleSlug: "primary-armor", targetHex: "#888888", paintEffect: "solid" as const, rationale: "AI-added neutral" };
    palette.entries.push(extra);
    expect(() => validateResolvedPalette(palette, intent)).toThrow("allowed color set");
    extra.roleSlug = "inner-frame";
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
  });

  it("treats unscoped neutral importance as unrestricted and explicit v3 scope as authoritative", () => {
    const custom = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([]), colors: [
      { role: "neutral", name: "Soft gray", hex: "#909090", coverage: 50 },
      { role: "neutral", name: "Frame gray", hex: "#606060", coverage: 20 },
      { role: "neutral", name: "Sensor blue", hex: "#0088BB", coverage: 10 },
      { role: "primary", name: "Important sensor green", hex: "#22AA55", coverage: 20, scope: { kind: "sensors" } },
    ] });
    const intent = resolveCreativeIntent({ styleIntent: custom });
    expect(intent.colors.map((color) => color.scope.kind)).toEqual(["whole-kit", "inner-frame", "sensors", "sensors"]);
    const palette = paletteFor(intent);
    palette.entries[0].roleSlug = "markings";
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
  });

  it("lets new Notes set ratios and finish over a saved description while preserving HEX, sensors and geometry", () => {
    const description = "70% blue #2358C0 armor, 30% white armor. Matte finish. Metallic armor. Keep head geometry. Keep cyan sensors.";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", colors: [
      { role: "primary", name: "Blue", hex: "#2358C0", coverage: 60 }, { role: "secondary", name: "White", hex: "#EEEEEE", coverage: 25 },
      { role: "frame", name: "Frame gray", hex: "#484848", coverage: 10 }, { role: "glow", name: "Cyan sensor", hex: "#00AAEE", coverage: 5 },
    ], explicitRequirements: notes([
      requirement(description, { id: "saved-colors", operation: "set", colors: [{ name: "Blue", family: "blue", hex: "#2358C0", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }], evidence: { inputRef: "style-description", quote: description } }),
      requirement("Matte finish.", { id: "saved-finish", property: "finish", operation: "set", colors: undefined, value: "matte", scope: { kind: "whole-kit" }, evidence: { inputRef: "style-description", quote: "Matte finish." } }),
      requirement("Metallic armor.", { id: "saved-material", property: "material", operation: "set", colors: undefined, value: "Metallic armor", scope: { kind: "whole-kit" }, evidence: { inputRef: "style-description", quote: "Metallic armor." } }),
      requirement("Keep head geometry.", { id: "saved-head", property: "geometry", operation: "preserve", colors: undefined, value: undefined, scope: { kind: "part", part: "head" }, evidence: { inputRef: "style-description", quote: "Keep head geometry." } }),
      requirement("Keep cyan sensors.", { id: "saved-sensor", operation: "preserve", scope: { kind: "sensors" }, colors: [{ name: "Cyan", family: "cyan" }], evidence: { inputRef: "style-description", quote: "Keep cyan sensors." } }),
    ]) });
    const input = "Set 60% blue armor and 40% white armor. Gloss finish.";
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: description, material: { name: "Standard matte armor", finish: "matte" }, notes: input, normalizedNotes: notes([
      requirement(input, { id: "new-ratio", operation: "set", colors: [{ name: "Blue", family: "blue", coveragePercent: 60 }, { name: "White", family: "white", coveragePercent: 40 }] }),
      requirement("Gloss finish.", { id: "new-finish", property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "gloss" }),
    ]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.originalStyle).toEqual(saved);
    expect(intent.effectiveStyle.finish).toBe("gloss");
    expect(intent.effectiveStyle.materialIntent.join(" ")).toContain("Metallic armor");
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.coverage?.percent)).toEqual([60, 40]);
    expect(intent.constraints.filter((constraint) => constraint.status === "active" && constraint.property === "color-coverage" && constraint.strength === "hard").map((constraint) => constraint.value)).toEqual([60, 40]);
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:saved-colors:0:hex", status: "active", value: "#2358C0" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:saved-head", status: "active" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:saved-sensor:0:family", status: "active" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:saved-material", status: "active", strength: "hard" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:saved-finish", status: "superseded" }));
    expect(intent.decisions.some((decision) => decision.requirementId === "notes:new-ratio" && decision.supersededConstraintIds.includes("description:saved-colors:0:coverage"))).toBe(true);
    const palette = paletteFor(intent);
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
  });

  it("lets Notes replace an exact HEX without erasing the saved ratio or accepting same-Notes contradictions", () => {
    const description = "70% blue #2358C0 armor and 30% white armor";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", colors: [{ role: "primary", name: "Blue", hex: "#2358C0", coverage: 70 }, { role: "secondary", name: "White", hex: "#EEEEEE", coverage: 30 }], explicitRequirements: notes([
      requirement(description, { colors: [{ name: "Blue", family: "blue", hex: "#2358C0", coveragePercent: 70 }, { name: "White", family: "white", coveragePercent: 30 }], evidence: { inputRef: "style-description", quote: description } }),
    ]) });
    const input = "Set blue armor to #1044AA";
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: description, notes: input, normalizedNotes: notes([requirement(input, { operation: "set", colors: [{ name: "Blue", family: "blue", hex: "#1044AA" }] })]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.colors.find((color) => color.family === "blue")?.hex).toBe("#1044AA");
    expect(intent.colors.find((color) => color.family === "blue")?.coverage?.percent).toBe(70);
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:colors:0:hex", status: "superseded" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:colors:0:coverage", status: "active" }));
    const twoHexes = "Set blue to #1044AA. Set blue to #004488.";
    const conflictingHexes = resolveCreativeIntent({ styleIntent: saved, styleDescription: description, notes: twoHexes, normalizedNotes: notes([
      requirement("Set blue to #1044AA.", { id: "first-hex", operation: "set", colors: [{ name: "Blue", family: "blue", hex: "#1044AA" }] }),
      requirement("Set blue to #004488.", { id: "second-hex", operation: "set", colors: [{ name: "Blue", family: "blue", hex: "#004488" }] }),
    ]) });
    expect(() => assertExecutableIntent(conflictingHexes)).toThrow(/conflict/i);
    const conflicting = "Use 60% blue armor, 40% white armor. Use 50% blue armor, 50% white armor.";
    const sameNotes = resolveCreativeIntent({ styleIntent: saved, styleDescription: description, notes: conflicting, normalizedNotes: notes([
      requirement("Use 60% blue armor, 40% white armor.", { id: "first", operation: "replace", colors: [{ name: "Blue", family: "blue", coveragePercent: 60 }, { name: "White", family: "white", coveragePercent: 40 }] }),
      requirement("Use 50% blue armor, 50% white armor.", { id: "second", operation: "replace", colors: [{ name: "Blue", family: "blue", coveragePercent: 50 }, { name: "White", family: "white", coveragePercent: 50 }] }),
    ]) });
    expect(() => assertExecutableIntent(sameNotes)).toThrow(/conflict/i);
  });

  it("rejects contradictory same-Notes finishes and overrides only matching prior-description exclusions", () => {
    const source = "No red armor. Keep white markings.";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([
      requirement("No red armor.", { id: "no-red", operation: "exclude", colors: [{ name: "Red", family: "red" }], evidence: { inputRef: "style-description", quote: "No red armor." } }),
      requirement("Keep white markings.", { id: "white-markings", operation: "preserve", scope: { kind: "markings" }, colors: [{ name: "White", family: "white" }], evidence: { inputRef: "style-description", quote: "Keep white markings." } }),
    ]) });
    const next = "Set armor to red. Gloss finish. Matte finish.";
    const requirements = [requirement("Set armor to red.", { id: "red", operation: "set", colors: [{ name: "Red", family: "red" }] })];
    const updated = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: next, normalizedNotes: notes(requirements) });
    expect(() => assertExecutableIntent(updated)).not.toThrow();
    expect(updated.constraints).toContainEqual(expect.objectContaining({ id: "description:no-red:exclude:0", status: "superseded" }));
    expect(updated.constraints).toContainEqual(expect.objectContaining({ id: "description:white-markings:0:family", status: "active" }));
    const contradictory = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: next, normalizedNotes: notes([...requirements,
      requirement("Gloss finish.", { id: "gloss", property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "gloss" }),
      requirement("Matte finish.", { id: "matte", property: "finish", operation: "replace", scope: { kind: "whole-kit" }, colors: undefined, value: "matte" }),
    ]) });
    expect(() => assertExecutableIntent(contradictory)).toThrow(/conflict/i);
  });

  it("lets a current explicit selection outrank an older description while protecting it from conflicting Notes", () => {
    const description = "Matte finish";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([
      requirement(description, { id: "matte", property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "matte", evidence: { inputRef: "style-description", quote: description } }),
    ]) });
    const material = { name: "Gloss armor", finish: "gloss" as const };
    const input = { styleIntent: saved, styleDescription: description, material, selectionSources: { material: "user-selection" as const } };
    const matching = resolveCreativeIntent({ ...input, notes: "Gloss finish", normalizedNotes: notes([requirement("Gloss finish", { property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "gloss" })]) });
    expect(() => assertExecutableIntent(matching)).not.toThrow();
    expect(matching.effectiveStyle.finish).toBe("gloss");
    expect(matching.constraints).toContainEqual(expect.objectContaining({ id: "description:matte", status: "superseded", value: "matte" }));
    expect(matching.constraints).toContainEqual(expect.objectContaining({ id: "selection:finish", status: "active", value: "gloss" }));
    const conflict = resolveCreativeIntent({ ...input, notes: "Matte finish", normalizedNotes: notes([requirement("Matte finish", { property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "matte" })]) });
    expect(() => assertExecutableIntent(conflict)).toThrow(/conflicts/);
    const override = resolveCreativeIntent({ ...input, notes: "Override gloss with matte finish", normalizedNotes: notes([requirement("Override gloss with matte finish", { property: "finish", operation: "set", scope: { kind: "whole-kit" }, colors: undefined, value: "matte", overridesSelection: true })]) });
    expect(() => assertExecutableIntent(override)).not.toThrow();
    expect(override.effectiveStyle.finish).toBe("matte");
  });

  it("expands a saved description only-set for additive Notes while preserving the original and other scopes", () => {
    const source = "Only blue and white armor. Keep cyan sensors.";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([
      requirement("Only blue and white armor.", { id: "only-armor", operation: "only", evidence: { inputRef: "style-description", quote: "Only blue and white armor." } }),
      requirement("Keep cyan sensors.", { id: "sensors", operation: "preserve", scope: { kind: "sensors" }, colors: [{ name: "Cyan", family: "cyan" }], evidence: { inputRef: "style-description", quote: "Keep cyan sensors." } }),
    ]) });
    const input = "Also add red armor. Also add green armor.";
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: input, normalizedNotes: notes([
      requirement("Also add red armor.", { id: "red", operation: "add", colors: [{ name: "Red", family: "red" }] }),
      requirement("Also add green armor.", { id: "green", operation: "add", colors: [{ name: "Green", family: "green" }] }),
    ]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.originalStyle).toEqual(saved);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").map((color) => color.family).sort()).toEqual(["blue", "green", "red", "white"]);
    const allowed = intent.constraints.filter((constraint) => constraint.property === "allowed-colors" && constraint.status === "active");
    expect(allowed).toHaveLength(1);
    expect(allowed[0].scope).toEqual({ kind: "exterior-armor" });
    expect(allowed[0].value).toHaveLength(4);
    expect(allowed[0].evidence.source).toBe("system-rule");
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:only-armor:allowed", status: "superseded" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:sensors:0:family", status: "active" }));
    expect(intent.decisions.filter((decision) => ["notes:red", "notes:green"].includes(decision.requirementId)).length).toBeGreaterThanOrEqual(2);
  });

  it("removes only matching same-scope saved exclusions for additive Notes", () => {
    const source = "No red armor. No red sensors.";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([
      requirement("No red armor.", { id: "armor", operation: "exclude", colors: [{ name: "Red", family: "red" }], evidence: { inputRef: "style-description", quote: "No red armor." } }),
      requirement("No red sensors.", { id: "sensors", operation: "exclude", scope: { kind: "sensors" }, colors: [{ name: "Red", family: "red" }], evidence: { inputRef: "style-description", quote: "No red sensors." } }),
    ]) });
    const input = "Add red armor";
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: input, normalizedNotes: notes([requirement(input, { operation: "add", colors: [{ name: "Red", family: "red" }] })]) });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:armor:exclude:0", status: "superseded" }));
    expect(intent.constraints).toContainEqual(expect.objectContaining({ id: "description:sensors:exclude:0", status: "active" }));
    expect(intent.colors.find((color) => color.family === "red")?.scope.kind).toBe("exterior-armor");
  });

  it("does not let additive Notes bypass same-Notes only/exclude or a broader source restriction", () => {
    const input = "Only blue and white armor. Add red armor.";
    const sameNotes = resolveCreativeIntent({ styleIntent: style, notes: input, normalizedNotes: notes([
      requirement("Only blue and white armor.", { id: "only", operation: "only" }), requirement("Add red armor.", { id: "red", operation: "add", colors: [{ name: "Red", family: "red" }] }),
    ]) });
    expect(() => assertExecutableIntent(sameNotes)).toThrow(/conflict/i);
    const noRed = "No red armor. Add red armor.";
    expect(() => assertExecutableIntent(resolveCreativeIntent({ styleIntent: style, notes: noRed, normalizedNotes: notes([
      requirement("No red armor.", { id: "exclude", operation: "exclude", colors: [{ name: "Red", family: "red" }] }), requirement("Add red armor.", { id: "red", operation: "add", colors: [{ name: "Red", family: "red" }] }),
    ]) }))).toThrow(/excluded/i);
    const source = "Only blue and white on the whole kit";
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", explicitRequirements: notes([requirement(source, { operation: "only", scope: { kind: "whole-kit" }, evidence: { inputRef: "style-description", quote: source } })]) });
    const local = "Add red chest armor";
    const scoped = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, notes: local, normalizedNotes: notes([requirement(local, { operation: "add", scope: { kind: "part", part: "chest" }, colors: [{ name: "Red", family: "red" }] })]) });
    expect(scoped.unresolved).toContainEqual(expect.objectContaining({ reason: expect.stringContaining("local exception") }));
    expect(() => assertExecutableIntent(scoped)).toThrow("local exception");
    expect(scoped.constraints).toContainEqual(expect.objectContaining({ id: "description:colors:allowed", status: "active" }));
  });

  it("recovers missing source importance through structured normalization and prevents inferred accent demotion", () => {
    const source = "Use red, blue, green, orange, purple, yellow and pink as large armor colors.";
    const names = ["Red", "Blue", "Green", "Orange", "Purple", "Yellow", "Pink"];
    const families = ["red", "blue", "green", "orange", "purple", "yellow", "pink"] as const;
    const hexes = ["#E53935", "#2358C0", "#38A85A", "#F38428", "#8144B9", "#F9D749", "#ED73BA"];
    const oldColors = names.map((name, index) => ({ name, role: index >= 5 ? "accent" : index >= 3 ? "secondary" : "primary", hex: hexes[index], coverage: index >= 5 ? 4 : 18 }));
    const oldRequirements = notes([requirement(source, { operation: "preserve", colors: names.map((name, index) => ({ name, family: families[index] })), evidence: { inputRef: "style-description", quote: source } })]);
    const saved = styleIntentSchema.parse({ ...style, version: "style-intent.v3", source: "private", styleType: "custom", surfaceLogic: "Tiny yellow and pink accents, each about4% of the visible surface.", graphicLanguage: "Pink caution labels and a yellow badge only.", colors: [...oldColors, { name: "Frame gray", role: "frame", hex: "#484848", coverage: 2 }], explicitRequirements: oldRequirements });
    const recovered = currentNormalizedUserIntentSchema.parse(notes([requirement(source, { operation: "preserve", colors: names.map((name, index) => ({ name, family: families[index], visualRole: "primary" })), evidence: { inputRef: "style-description", quote: source } })]));
    const intent = resolveCreativeIntent({ styleIntent: saved, styleDescription: source, normalizedNotes: recovered, useNormalizedDescription: true });
    expect(intent.originalStyle).toEqual(saved);
    expect(intent.styleModified).toBe(false);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor" && ["primary", "secondary"].includes(color.visualRole))).toHaveLength(7);
    expect(intent.colors.filter((color) => color.scope.kind === "exterior-armor").every((color) => !color.coverage)).toBe(true);
    expect(intent.constraints.filter((constraint) => constraint.property === "color-importance" && constraint.status === "active")).toHaveLength(7);
    expect(intent.effectiveStyle.palette).not.toHaveProperty("accent");
    expect(intent.effectiveStyle.surfaceLogic).not.toContain("4%");
    expect(intent.effectiveStyle.surfaceLogic).toContain("broad existing armor-panel group");
    expect(intent.effectiveStyle.graphicLanguage).not.toContain("yellow badge only");
    expect(intent.effectiveStyle.mood).toBe(saved.mood);
    expect(intent.effectiveStyle.contrast).toBe(saved.contrast);
    const unaffected = styleIntentSchema.parse({ ...saved, graphicLanguage: "Conventional unit numbers and technical caution labels." });
    const preservedGraphics = resolveCreativeIntent({ styleIntent: unaffected, styleDescription: source, normalizedNotes: recovered, useNormalizedDescription: true });
    expect(preservedGraphics.effectiveStyle.graphicLanguage).toBe(unaffected.graphicLanguage);
    const palette = paletteFor(intent);
    expect(() => validateResolvedPalette(palette, intent)).not.toThrow();
    const yellow = palette.entries.find((entry) => entry.colorName === "Yellow")!;
    yellow.roleSlug = "accent";
    expect(() => validateResolvedPalette(palette, intent)).toThrow("visual importance");
    yellow.roleSlug = "primary-armor";
    const specification = specFor(intent);
    specification.panels.find((panel) => panel.colorId === yellow.colorId)!.roleSlug = "accent";
    expect(() => validateResolvedSpecification(specification, palette, intent)).toThrow("visual importance");
    expect(intent.constraints.filter((constraint) => constraint.id === "description:colors:0:presence")).toHaveLength(1);
  });

  it("requires current source importance transport without promoting unspecified or explicit gold accents", () => {
    const quote = "Blue armor with gold accents";
    expect(currentNormalizedUserIntentSchema.safeParse(notes([requirement(quote)])).success).toBe(false);
    expect(normalizedUserIntentSchema.safeParse(notes([requirement(quote)])).success).toBe(true);
    const normalized = currentNormalizedUserIntentSchema.parse(notes([requirement(quote, { colors: [{ name: "Blue", family: "blue", visualRole: "unspecified" }, { name: "Gold", family: "yellow", visualRole: "accent" }] })]));
    const intent = resolveCreativeIntent({ styleIntent: style, notes: quote, normalizedNotes: normalized });
    expect(intent.colors.find((color) => color.name === "Gold")?.visualRole).toBe("accent");
    expect(intent.constraints.filter((constraint) => constraint.property === "color-importance").map((constraint) => constraint.value)).toEqual(["accent"]);
    expect(creativeInputKey({})).toContain(sourceNormalizationProtocolVersion);
    expect(legacyCreativeInputKey({})).not.toContain(sourceNormalizationProtocolVersion);
  });

  it("executes an explicit behavior DTO and per-color role permissions without original Style fields", () => {
    const input = "Use blue and white armor as major colors";
    const intent = resolve(input, { operation: "set", colors: [{ name: "Blue", family: "blue", visualRole: "primary" }, { name: "White", family: "white", visualRole: "primary" }] });
    const contaminated = { ...intent.effectiveStyle, name: "OLD STYLE HIERARCHY", colors: style.colors, palette: { primary: "old red", secondary: "old gray", accent: "old yellow" }, explicitRequirements: notes([requirement("OLD SOURCE QUOTE")]), referenceNotes: "OLD REFERENCE NOTE", source: "private" as const };
    intent.effectiveStyle = contaminated;
    const projection = resolvedIntentForExecution(intent);
    for (const key of ["name", "version", "source", "styleType", "palette", "colors", "explicitRequirements", "referenceNotes"]) expect(projection.effectiveStyle).not.toHaveProperty(key);
    expect(projection.effectiveStyle).toEqual(effectiveStyleForExecution(intent));
    expect(projection.effectiveStyle.surfaceLogic).toContain("broad existing armor-panel group");
    expect(JSON.stringify(projection)).not.toContain("OLD STYLE HIERARCHY");
    expect(JSON.stringify(projection)).not.toContain("OLD SOURCE QUOTE");
    expect(JSON.stringify(projection)).not.toContain("OLD REFERENCE NOTE");
    expect(JSON.stringify(projection)).not.toContain("old yellow");
    const roles = requiredPaletteRolesForExecution(intent);
    for (const color of intent.colors.filter((color) => color.scope.kind === "exterior-armor" && color.visualRole === "primary")) {
      expect(roles.find((entry) => entry.colorId === color.colorId)?.allowedRoleSlugs).toEqual(["primary-armor", "secondary-armor"]);
    }
    expect(projection.colorRolePermissions).toEqual(roles);
    expect(intent.originalStyle).toEqual(style);
    expect(intent.effectiveStyle).toHaveProperty("colors");
  });
});
