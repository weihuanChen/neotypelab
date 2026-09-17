import { describe, expect, it } from "vitest";
import {
  computeMaskingSummary,
  parsePaintRecommendations,
  parseRenderSpecification,
  parseVisualPalette,
} from "./libraryBriefData";

describe("libraryBriefData parsers", () => {
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
