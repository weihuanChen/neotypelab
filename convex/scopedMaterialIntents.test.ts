import { describe, expect, it } from "vitest";
import { paletteV3Schema, type IntentScope, type NormalizedRequirement, type RepaintV3 } from "./creativeContracts";
import { assertExecutableIntent, resolveCreativeIntent, validateResolvedSpecification, type ResolveCreativeIntentInput, type ResolvedCreativeIntent } from "./creativeIntentResolver";
import { localChitinMaterialStyle, orangeShadesDescription, orangeShadesStyle } from "@/tests/fixtures/orangeShades";

function material(value: string, scope: IntentScope, id = "material"): NormalizedRequirement {
  return { id, property: "material", operation: "set", scope, value,
    evidence: { inputRef: "style-description", quote: `${value} on ${scope.part ?? scope.kind}` } };
}
function resolve(requirements: NormalizedRequirement[], extra: Partial<ResolveCreativeIntentInput> = {}) {
  return resolveCreativeIntent({ styleIntent: { ...orangeShadesStyle, explicitRequirements: { version: "normalized-user-intent.v1", requirements, unresolved: [] } },
    styleDescription: requirements.map(r => r.evidence.quote).join(". "), ...extra });
}
function plan(intent: ResolvedCreativeIntent) {
  const roles = { primary: "primary-armor", secondary: "secondary-armor", frame: "inner-frame", accent: "accent", glow: "sensor-color", marking: "markings", neutral: "inner-frame", unspecified: "primary-armor" };
  const areas: Record<string, string[]> = { "primary-armor": ["Chest armor", "Left shoulder armor"], "secondary-armor": ["Forearm armor", "Shin armor"],
    "inner-frame": ["Inner frame"], accent: ["Collar armor"], "sensor-color": ["Head sensors"], markings: ["Shield markings"] };
  const palette = paletteV3Schema.parse({ version: "visual-palette.v3", entries: intent.colors.map(c => ({ colorId: c.colorId, colorName: c.name,
    roleSlug: roles[c.visualRole], targetHex: c.hex!, paintEffect: "solid", rationale: "Keep approved colors" })), sprayNotes: ["Thin coats"] });
  const specification: RepaintV3 = { version: "repaint-specification.v3", summary: "Paint existing panels", panels: palette.entries.map((c, index) => ({
    assignmentId: `panel-${index}`, colorId: c.colorId, roleSlug: c.roleSlug, areas: [...areas[c.roleSlug]], maskingNotes: "Mask existing panel seams" })),
    material: { surfaceTexture: "Smooth", reflectivity: "Controlled", coating: "Protective coat", finish: intent.effectiveStyle.finish, intent: [...intent.effectiveStyle.materialIntent] },
    weathering: { level: intent.effectiveStyle.weathering, applicationNotes: "Follow approved weathering" }, decals: { density: "low", placementNotes: "Native markings" } };
  return { palette, specification };
}

describe("scoped material requirements", () => {
  it("accepts the recorded chitin-armor requirement without replacing whole-kit material or finish", () => {
    const intent = resolveCreativeIntent({ styleIntent: localChitinMaterialStyle, styleDescription: orangeShadesDescription });
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.originalStyle).toEqual(localChitinMaterialStyle);
    expect(intent.effectiveStyle.materialIntent).toEqual(["painted armor"]);
    expect(intent.effectiveStyle.finish).toBe("satin");
    const { palette, specification } = plan(intent);
    const approved = validateResolvedSpecification(specification, palette, intent);
    expect(approved.material.scopedIntents).toEqual([{ constraintId: "description:req-material", scope: { kind: "exterior-armor" }, intent: "chitinous shell finish",
      areas: ["Chest armor", "Left shoulder armor", "Forearm armor", "Shin armor", "Collar armor"] }]);
    expect(approved.material.intent).toEqual(["painted armor"]);
    expect(specification.material.scopedIntents).toBeUndefined();
  });

  it.each([
    ["inner-frame", ["Inner frame"]], ["sensors", ["Head sensors"]], ["markings", ["Shield markings"]],
  ] as const)("limits a %s treatment to that surface group", (kind, expected) => {
    const intent = resolve([material("metallic surface", { kind })]);
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    const { palette, specification } = plan(intent);
    expect(validateResolvedSpecification(specification, palette, intent).material.scopedIntents![0].areas).toEqual([...expected]);
  });

  it("applies a named-part material only to the matching area, including when the assignment also contains other areas", () => {
    const intent = resolve([material("chitin shell", { kind: "part", part: "shoulder" })]);
    const { palette, specification } = plan(intent);
    const result = validateResolvedSpecification(specification, palette, intent);
    expect(result.material.scopedIntents![0]).toMatchObject({ scope: { kind: "part", part: "shoulder" }, areas: ["Left shoulder armor"] });
    expect(result.material.intent).toEqual(intent.effectiveStyle.materialIntent);
  });

  it("uses named-part overrides on those parts and retains the broader armor material elsewhere", () => {
    const intent = resolve([material("chitin shell", { kind: "exterior-armor" }, "armor"), material("polished metal", { kind: "part", part: "shoulder" }, "shoulder")]);
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    const { palette, specification } = plan(intent);
    const local = validateResolvedSpecification(specification, palette, intent).material.scopedIntents!;
    expect(local.find(c => c.intent === "chitin shell")!.areas).toEqual(["Chest armor", "Forearm armor", "Shin armor", "Collar armor"]);
    expect(local.find(c => c.intent === "polished metal")!.areas).toEqual(["Left shoulder armor"]);
  });

  it("keeps global material as a default regardless of requirement order", () => {
    const requirements = [material("painted steel", { kind: "whole-kit" }, "global"), material("chitin shell", { kind: "exterior-armor" }, "armor")];
    for (const ordered of [requirements, [...requirements].reverse()]) {
      const intent = resolve(ordered);
      expect(() => assertExecutableIntent(intent)).not.toThrow();
      expect(intent.effectiveStyle.materialIntent).toEqual(["painted steel"]);
      const { palette, specification } = plan(intent);
      expect(validateResolvedSpecification(specification, palette, intent).material.scopedIntents![0].intent).toBe("chitin shell");
    }
  });

  it("rejects contradictory values for the same local material scope", () => {
    const intent = resolve([material("wood", { kind: "part", part: "shoulder" }, "wood"), material("steel", { kind: "part", part: "shoulder" }, "steel")]);
    expect(() => assertExecutableIntent(intent)).toThrow(/material conflicts/);
  });

  it.each(["arm", "backpack"])("does not silently apply a missing %s target to another area", part => {
    const intent = resolve([material("wood", { kind: "part", part })]);
    const { palette, specification } = plan(intent);
    expect(() => validateResolvedSpecification(specification, palette, intent)).toThrow(/omitted the local material scope/);
  });

  it("requires separate area labels when a local treatment would otherwise leak to another part", () => {
    const intent = resolve([material("wood", { kind: "part", part: "shoulder" })]);
    const { palette, specification } = plan(intent);
    specification.panels[0].areas = ["Left shoulder armor and chest armor"];
    expect(() => validateResolvedSpecification(specification, palette, intent)).toThrow(/split named local material targets/);
  });

  it("rejects altered scoped annotations and altered global material", () => {
    const intent = resolve([material("chitin shell", { kind: "exterior-armor" })]);
    const { palette, specification } = plan(intent);
    const approved = validateResolvedSpecification(specification, palette, intent);
    approved.material.scopedIntents![0].areas.push("Inner frame");
    expect(() => validateResolvedSpecification(approved, palette, intent)).toThrow(/changed the resolved local material/);
    specification.material.intent = ["chitin shell everywhere"];
    expect(() => validateResolvedSpecification(specification, palette, intent)).toThrow(/changed the resolved material intent/);
  });

  it("validates Custom Kit target IDs and refuses unrepresentable material exclusions", () => {
    const intent = resolve([material("wood", { kind: "part", part: "missing-part" })], { kit: { source: "custom", id: "kit", version: "1" }, customKitParts: ["left-shoulder"] });
    expect(() => assertExecutableIntent(intent)).toThrow(/approved Custom Kit part/);
    const excluded = material("wood", { kind: "exterior-armor" });
    excluded.operation = "exclude";
    expect(() => assertExecutableIntent(resolve([excluded]))).toThrow(/positive local material treatment/);
  });

  it("does not promote a scoped material into the whole-kit material while reconciling finish", () => {
    const local = material("matte chitin shell", { kind: "part", part: "shoulder" });
    const finish: NormalizedRequirement = { id: "finish", property: "finish", operation: "set", scope: { kind: "whole-kit" }, value: "matte",
      evidence: { inputRef: "style-description", quote: "matte finish" } };
    const intent = resolve([local, finish]);
    expect(() => assertExecutableIntent(intent)).not.toThrow();
    expect(intent.constraints.filter(c => c.status === "active" && c.property === "material")).toMatchObject([{ scope: { kind: "part", part: "shoulder" }, value: "matte chitin shell" }]);
    expect(intent.effectiveStyle.materialIntent.join(" ")).not.toContain("chitin");
  });
});
