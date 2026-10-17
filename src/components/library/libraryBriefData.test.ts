import { describe, expect, it } from "vitest";
import {
  colorIdentityMatches,
  computeMaskingSummary,
  parsePaintRecommendations,
  parseCreativeRequirements,
  parseRenderSpecification,
  parseVisualPalette,
  roleNeedsCustomMix,
} from "./libraryBriefData";

describe("libraryBriefData parsers", () => {
  it("retains local material areas and displays their scope rather than claiming a whole-kit treatment", () => {
    const requirements = parseCreativeRequirements(JSON.stringify({ version: "creative-intent.v1", colors: [], constraints: [
      { property: "material", status: "active", strength: "hard", value: "chitin shell", scope: { kind: "exterior-armor" }, evidence: { source: "user-explicit", inputRef: "style-description" } },
      { property: "material", status: "active", strength: "hard", value: "polished steel", scope: { kind: "part", part: "Left shoulder" }, evidence: { source: "user-explicit", inputRef: "notes" } },
    ] }));
    expect(requirements).toEqual([
      { label: "Material", value: "Chitin shell · Exterior armor", source: "Your style description" },
      { label: "Material", value: "Polished steel · Left shoulder", source: "Your refinements" },
    ]);
    const specification = parseRenderSpecification(JSON.stringify({ summary: "Scoped material", panels: [], material: { surfaceTexture: "Smooth paint",
      scopedIntents: [{ constraintId: "private-source-id", intent: "chitin shell", scope: { kind: "exterior-armor" }, areas: ["Chest", "Shoulders"] }, { intent: 7, areas: ["Frame"] }] } }));
    expect(specification!.material.scopedIntents).toEqual([{ intent: "chitin shell", areas: ["Chest", "Shoulders"] }]);
    expect(JSON.stringify(specification)).not.toContain("private-source-id");
  });

  it("shows explicit retained requirements with their sources, without turning inferred ratios into promises", () => {
    const requirements = parseCreativeRequirements(JSON.stringify({
      version: "creative-intent.v1",
      colors: [{ colorId: "blue", name: "Blue armor" }, { colorId: "white", name: "White armor" }],
      constraints: [
        { colorId: "blue", property: "color-presence", status: "active", strength: "hard", scope: { kind: "exterior-armor" }, value: "clearly-visible", evidence: { source: "user-explicit", inputRef: "notes" } },
        { colorId: "blue", property: "color-coverage", status: "active", strength: "hard", scope: { kind: "exterior-armor" }, value: 70, evidence: { source: "user-explicit", inputRef: "notes" } },
        { colorId: "white", property: "color-coverage", status: "active", strength: "soft", scope: { kind: "whole-kit" }, value: 50, evidence: { source: "ai-inference", inputRef: "style.colors.white" } },
        { colorId: "white", property: "color-presence", status: "superseded", strength: "hard", scope: { kind: "exterior-armor" }, value: "required", evidence: { source: "user-explicit", inputRef: "style-description" } },
      ],
    }));
    expect(requirements).toEqual([
      { label: "Required color", value: "Blue armor · Exterior armor", source: "Your refinements" },
      { label: "Coverage target", value: "Blue armor · 70% of exterior armor", source: "Your refinements" },
    ]);
    expect(parseCreativeRequirements("invalid")).toEqual([]);
  });

  it("retains seven colors sharing armor roles and joins recommendations by color ID", () => {
    const targets = ["#E53935", "#1565C0", "#43A047", "#FB8C00", "#8E24AA", "#FDD835", "#00ACC1"];
    const palette = parseVisualPalette(JSON.stringify({
      version: "visual-palette.v3",
      entries: targets.map((targetHex, index) => ({
        colorId: `rainbow-${index}`, colorName: `Spectrum ${index}`, roleSlug: "primary-armor",
        roleName: "Primary armor", targetHex, paintEffect: "solid",
      })),
      sprayNotes: ["Mask each armor panel separately."],
    }));
    expect(palette?.entries.map((entry) => entry.targetHex)).toEqual(targets);
    expect(palette?.entries.map((entry) => entry.colorId)).toHaveLength(7);

    const system = parsePaintRecommendations(JSON.stringify({
      version: "paint-recommendations.v3",
      sets: [{
        id: "catalog", recommended: true, coverageCount: 1, roleCount: 7,
        missingRoleSlugs: ["primary-armor"], missingColorIds: ["rainbow-1"],
        entries: [{ colorId: "rainbow-0", roleSlug: "primary-armor", targetHex: targets[0],
          paint: { code: "RED", colorName: "Red", brand: "Catalog" } }],
      }],
    }));
    expect(system?.missingColorIds).toEqual(["rainbow-1"]);
    expect(roleNeedsCustomMix(system ?? undefined, "primary-armor", "rainbow-0")).toBe(false);
    expect(roleNeedsCustomMix(system ?? undefined, "primary-armor", "rainbow-1")).toBe(true);
    expect(colorIdentityMatches(palette!.entries[0], system!.entries[0])).toBe(true);
    expect(colorIdentityMatches(palette!.entries[1], system!.entries[0])).toBe(false);
  });

  it("shows explicit HEX and scoped exclusions while hiding superseded targets", () => {
    expect(parseCreativeRequirements(JSON.stringify({
      version: "creative-intent.v1", colors: [{ colorId: "blue", name: "Blue" }],
      constraints: [
        { colorId: "blue", property: "color-hex", status: "active", strength: "hard", value: "#1565C0", evidence: { source: "user-explicit", inputRef: "notes" } },
        { colorId: "blue", property: "color-importance", status: "active", strength: "hard", value: "secondary", evidence: { source: "user-explicit", inputRef: "notes" } },
        { colorId: "blue", property: "color-hex", status: "superseded", strength: "hard", value: "#0000FF", evidence: { source: "user-explicit", inputRef: "style-description" } },
        { property: "excluded-color", status: "active", strength: "hard", scope: { kind: "part", part: "Shoulders" }, value: "red", evidence: { source: "user-explicit", inputRef: "notes" } },
      ],
    }))).toEqual([
      { label: "Exact color", value: "Blue · #1565C0", source: "Your refinements" },
      { label: "Color use", value: "Blue · Major armor color", source: "Your refinements" },
      { label: "Excluded color", value: "Red · Shoulders", source: "Your refinements" },
    ]);
  });

  it("keeps multiple assignments for one color and does not fall back to roles for identified colors", () => {
    const specification = parseRenderSpecification(JSON.stringify({
      version: "repaint-specification.v3", summary: "Blue across multiple armor groups",
      panels: [
        { assignmentId: "chest", colorId: "blue", roleSlug: "primary-armor", areas: ["Chest"], maskingNotes: "Follow chest seams." },
        { assignmentId: "arms", colorId: "blue", roleSlug: "secondary-armor", areas: ["Forearms"], maskingNotes: "Mask wrist joints." },
      ],
    }));
    expect(specification?.panels.map((entry) => entry.assignmentId)).toEqual(["chest", "arms"]);
    expect(specification?.panels.every((entry) => colorIdentityMatches(entry, { colorId: "blue", roleSlug: "primary-armor" }))).toBe(true);
    expect(colorIdentityMatches({ colorId: "blue", roleSlug: "primary-armor" }, { roleSlug: "primary-armor" })).toBe(false);
    expect(colorIdentityMatches({ roleSlug: "primary-armor" }, { roleSlug: "primary-armor" })).toBe(true);
  });

  it("parses visualPalette v2 cleanly", () => {
    const json = JSON.stringify({
      version: "visual-palette.v2",
      entries: [
        {
          roleSlug: "primary-armor",
          roleName: "Primary Armor",
          targetHex: "#2B2D42",
          paintEffect: "solid",
          recommendedArea: "Main armor plates",
          rationale: "Dark navy base",
        },
        {
          roleSlug: "accent-orange",
          roleName: "Accent Orange",
          targetHex: "#F77F00",
          paintEffect: "metallic",
        },
      ],
      sprayNotes: ["Apply gray primer first", "Thin paint with leveler"],
    });

    const parsed = parseVisualPalette(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.entries).toHaveLength(2);
    expect(parsed?.entries[0].roleName).toBe("Primary Armor");
    expect(parsed?.entries[0].paintEffect).toBe("solid");
    expect(parsed?.entries[1].paintEffect).toBe("metallic");
    expect(parsed?.sprayNotes).toHaveLength(2);
  });

  it("falls back to legacy palette plan when visualPalette is absent", () => {
    const legacyJson = JSON.stringify({
      entries: [
        {
          roleSlug: "frame-inner",
          suggestedPaint: {
            brand: "Tamiya",
            code: "XF-56",
            colorName: "Metallic Gray",
            hexPreview: "#555555",
          },
        },
      ],
      sprayNotes: ["Thin coats only"],
    });

    const parsed = parseVisualPalette(null, legacyJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.entries).toHaveLength(1);
    expect(parsed?.entries[0].roleSlug).toBe("frame-inner");
    expect(parsed?.entries[0].targetHex).toBe("#555555");
  });

  it("parses paint recommendation sets and picks recommended set", () => {
    const json = JSON.stringify({
      version: "paint-recommendations.v1",
      sets: [
        {
          id: "tamiya:acrylic",
          brand: "Tamiya",
          line: "Acrylic",
          label: "Tamiya Mini Acrylics",
          recommended: false,
          coverageCount: 2,
          roleCount: 3,
          averageDeltaE: 3.5,
          entries: [],
        },
        {
          id: "gsi-creos:mr-color",
          brand: "GSI Creos",
          line: "Mr. Color",
          label: "Mr. Color System (lacquer)",
          recommended: true,
          coverageCount: 3,
          roleCount: 3,
          averageDeltaE: 1.8,
          entries: [
            {
              roleSlug: "primary-armor",
              targetHex: "#2B2D42",
              paintEffect: "solid",
              deltaE00: 1.8,
              matchBand: "very_close",
              paint: {
                brand: "GSI Creos",
                line: "Mr. Color",
                code: "C67",
                colorName: "Navy Blue",
                hexPreview: "#262C38",
              },
            },
          ],
        },
      ],
    });

    const parsed = parsePaintRecommendations(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("gsi-creos:mr-color");
    expect(parsed?.recommended).toBe(true);
    expect(parsed?.averageDeltaE).toBe(1.8);
    expect(parsed?.entries).toHaveLength(1);
    expect(parsed?.entries[0].paint.code).toBe("C67");
    expect(parsed?.missingRoleSlugs).toEqual([]);
  });

  it("keeps missing roles so the brief can mark a custom mix", () => {
    const parsed = parsePaintRecommendations(JSON.stringify({
      sets: [{
        id: "gsi-creos:mr-color",
        brand: "GSI Creos",
        line: "Mr. Color",
        label: "Mr. Color C Series",
        recommended: true,
        coverageCount: 1,
        roleCount: 2,
        missingRoleSlugs: ["sensor-color"],
        entries: [{
          roleSlug: "primary-armor",
          targetHex: "#00B4D8",
          paintEffect: "solid",
          deltaE00: 7,
          matchBand: "usable",
          paint: { brand: "GSI Creos", code: "C323", colorName: "Light Blue" },
        }],
      }],
    }));
    expect(parsed?.missingRoleSlugs).toEqual(["sensor-color"]);
  });

  it("parses render specification and calculates masking summary", () => {
    const json = JSON.stringify({
      summary: "High-contrast EVA repaint.",
      panels: [
        {
          roleSlug: "primary-armor",
          areas: ["Shoulders", "Chest", "Forearms"],
          maskingNotes: "2-tone split on shoulder binders",
        },
        {
          roleSlug: "accent-glow",
          areas: ["Collar", "Chest vents", "Knees"],
          maskingNotes: "Accent edge masking",
        },
      ],
      material: {
        surfaceTexture: "Matte armor",
        reflectivity: "Low sheen",
        coating: "Matte topcoat recommended to unify resin sheen",
      },
      weathering: {
        level: "light",
        applicationNotes: "Subtle edge drybrushing",
      },
      decals: {
        density: "low",
        placementNotes: "Caution stencils",
      },
    });

    const parsed = parseRenderSpecification(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.panels).toHaveLength(2);
    expect(parsed?.material.coating).toContain("Matte topcoat");

    const summary = computeMaskingSummary(parsed);
    expect(summary.difficulty).toBe("Medium");
    expect(summary.zoneCount).toBe(6);
    expect(summary.keyAreas).toHaveLength(2);
    expect(summary.keyAreas[0].area).toBe("Shoulders");
    expect(summary.keyAreas[0].note).toBe("2-tone split on shoulder binders");
    expect(summary.finishingAdvice).toContain("Matte topcoat");
  });
});
