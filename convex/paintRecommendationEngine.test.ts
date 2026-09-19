import { describe, expect, it } from "vitest";
import type { ResolvedPaintMapping } from "./paintCatalogCompatibility";
import { hexToLabD65 } from "./paintColor";
import {
  buildPaintRecommendationSets,
  buildVisualPalette,
  summarizePaintCatalogForPrompt,
  visualPaletteForRender,
  visualPaletteFromLegacyPlan,
} from "./paintRecommendationEngine";

describe("paint recommendation sets", () => {
  it("keeps the visual palette product-free and builds single-system paint groups", () => {
    const mappings = [
      fakePaint("GSI Creos", "Mr. Color", "C", "C513", "#3E4F5F", "solid", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C101", "#E6E6E6", "solid", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C61", "#4C5053", "metallic", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C58", "#D99A55", "solid", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C327", "#9E2428", "solid", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C138", "#19B94B", "transparent", "mr-color"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "XF", "XF-18", "#3C5360", "solid", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "XF", "XF-2", "#E9E7DF", "solid", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "X", "X-10", "#45494D", "metallic", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "XF", "XF-59", "#D89C42", "solid", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "XF", "XF-7", "#A52A2A", "solid", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "X", "X-25", "#27B541", "transparent", "tamiya-acrylic"),
    ];
    const palette = buildVisualPalette({
      roles: [
        { slug: "primary-armor", name: "Primary armor" },
        { slug: "secondary-armor", name: "Secondary armor" },
        { slug: "inner-frame", name: "Inner frame" },
        { slug: "accent", name: "Accent" },
        { slug: "markings", name: "Markings" },
        { slug: "sensor-color", name: "Sensor color" },
      ],
      entries: [
        { roleSlug: "primary-armor", targetHex: "#3A4F5C", paintEffect: "solid", rationale: "Muted slate armor." },
        { roleSlug: "secondary-armor", targetHex: "#E3E2DC", paintEffect: "solid", rationale: "Warm off-white armor." },
        { roleSlug: "inner-frame", targetHex: "#3E4145", paintEffect: "metallic", rationale: "Dark mechanical frame." },
        { roleSlug: "accent", targetHex: "#D9A05B", paintEffect: "solid", rationale: "Restrained amber accents." },
        { roleSlug: "markings", targetHex: "#A83232", paintEffect: "solid", rationale: "Tactical red markings." },
        { roleSlug: "sensor-color", targetHex: "#00C853", paintEffect: "transparent", rationale: "Transparent green optics." },
      ],
      sprayNotes: ["Apply thin coats."],
    });
    const recommendations = buildPaintRecommendationSets(palette, mappings, 123);
    expect(JSON.stringify(visualPaletteForRender(palette))).not.toMatch(/GSI|Tamiya|C513|XF-59/);
    expect(recommendations.generatedAt).toBe(123);
    const mrColor = recommendations.sets.find(set => set.label === "Mr. Color C Series");
    const tamiya = recommendations.sets.find(set => set.label === "Tamiya Acrylic (XF/X)");
    expect(mrColor).toMatchObject({ coverageCount: 6, roleCount: 6 });
    expect(tamiya).toMatchObject({ coverageCount: 6, roleCount: 6 });
    expect(new Set(mrColor?.entries.map(entry => entry.paint.brand))).toEqual(new Set(["GSI Creos"]));
    expect(mrColor?.entries.every(entry => entry.paint.code.startsWith("C"))).toBe(true);
    expect(new Set(tamiya?.entries.map(entry => entry.paint.brand))).toEqual(new Set(["Tamiya"]));
    expect(tamiya?.entries.find(entry => entry.roleSlug === "sensor-color")?.paint.code.startsWith("X-")).toBe(true);
    expect(recommendations.sets.filter(set => set.recommended)).toHaveLength(1);
  });

  it("recovers a visual target from old frozen plans without changing the history", () => {
    const legacy = JSON.stringify({
      entries: [{
        roleSlug: "accent",
        roleName: "Accent",
        recommendedArea: "vents",
        rationale: "Muted amber. Target #D9A05B; closest catalog sample ΔE00 3.7.",
        suggestedPaint: { brand: "Tamiya", code: "XF-59", hexPreview: "#D89C42", effects: [] },
      }],
      sprayNotes: ["Thin coats"],
    });
    expect(visualPaletteFromLegacyPlan(legacy)).toEqual({
      version: "visual-palette.v2",
      entries: [{
        roleSlug: "accent",
        roleName: "Accent",
        recommendedArea: "vents",
        targetHex: "#D9A05B",
        paintEffect: "solid",
        rationale: "Muted amber.",
      }],
      sprayNotes: ["Thin coats"],
    });
  });

  it("does not reuse one paint for distinct roles or accept distant matches", () => {
    const mappings = [
      fakePaint("GSI Creos", "Mr. Color", "C", "C9", "#DFB512", "metallic", "mr-color"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "X", "X-12", "#CCA208", "metallic", "tamiya-acrylic"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "X", "X-13", "#B7A15A", "metallic", "tamiya-acrylic"),
    ];
    const palette = buildVisualPalette({
      roles: [
        { slug: "accent", name: "Accent" },
        { slug: "markings", name: "Markings" },
      ],
      entries: [
        { roleSlug: "accent", targetHex: "#D4AF37", paintEffect: "metallic", rationale: "Gold accent." },
        { roleSlug: "markings", targetHex: "#C5A059", paintEffect: "metallic", rationale: "Pale gold markings." },
      ],
      sprayNotes: [],
    });
    const recommendations = buildPaintRecommendationSets(palette, mappings, 123);
    const mrColor = recommendations.sets.find((set) => set.label === "Mr. Color C Series");
    expect(mrColor).toMatchObject({ coverageCount: 1, missingRoleSlugs: ["markings"] });
    expect(mrColor?.entries.map((entry) => entry.paint.code)).toEqual(["C9"]);
  });

  it("keeps an incomplete Mr. Color set instead of failing the palette", () => {
    const mappings = [
      fakePaint("GSI Creos", "Mr. Color", "C", "C9", "#DFB512", "metallic", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C47", "#E60012", "transparent", "mr-color"),
    ];
    const palette = buildVisualPalette({
      roles: [
        { slug: "accent", name: "Accent" },
        { slug: "sensor-color", name: "Sensor Color" },
      ],
      entries: [
        { roleSlug: "accent", targetHex: "#D4AF37", paintEffect: "metallic", rationale: "Gold accent." },
        { roleSlug: "sensor-color", targetHex: "#33FFFF", paintEffect: "transparent", rationale: "Electric cyan optics." },
      ],
      sprayNotes: [],
    });
    const recommendations = buildPaintRecommendationSets(palette, mappings, 123);
    const mrColor = recommendations.sets.find((set) => set.recommended);
    expect(mrColor).toMatchObject({
      label: "Mr. Color C Series",
      recommended: true,
      coverageCount: 1,
      missingRoleSlugs: ["sensor-color"],
    });
    expect(mrColor?.uncoveredRoles).toEqual([
      { roleSlug: "sensor-color", targetHex: "#33FFFF", paintEffect: "transparent" },
    ]);
    expect(mrColor?.warnings.some((warning) => /custom mix/.test(warning))).toBe(true);
  });

  it("summarizes each paint line's usable hues for the planner prompt", () => {
    const summary = summarizePaintCatalogForPrompt([
      fakePaint("GSI Creos", "Mr. Color", "C", "C47", "#E60012", "transparent", "mr-color"),
      fakePaint("GSI Creos", "Mr. Color", "C", "C9", "#DFB512", "metallic", "mr-color"),
      fakePaint("Tamiya", "Tamiya Color Acrylic", "X", "X-23", "#33B4D1", "transparent", "tamiya-acrylic"),
    ]);
    expect(summary.preferredSystem).toBe("Mr. Color C Series");
    expect(summary.availableEffects).toEqual(expect.arrayContaining(["metallic", "transparent"]));
    expect(summary.systems[0]).toMatchObject({
      label: "Mr. Color C Series",
      preferred: true,
    });
    expect(summary.systems[0].transparents.map((paint) => paint.hex)).toContain("#E60012");
    expect(summary.matchRule).toMatch(/custom mix/);
  });
});

function fakePaint(
  brand: string,
  line: string,
  series: string,
  code: string,
  hex: string,
  effect: "solid" | "metallic" | "transparent",
  lineId: string
) {
  return {
    _id: `${lineId}:${code}`,
    _creationTime: 1,
    mappingKey: `${lineId}:${code}`,
    externalKey: `${lineId}:${code}`,
    brandId: `${brand}:id`,
    paintLineId: lineId,
    brand,
    brandName: brand,
    line,
    paintLineName: line,
    series,
    code,
    normalizedCode: code,
    name: code,
    colorName: code,
    sheen: "gloss",
    finishType: effect === "metallic" ? "metallic" : "gloss",
    opacity: effect === "transparent" ? "transparent" : "opaque",
    effects: effect === "metallic" ? ["metallic"] : [],
    paintType: brand === "Tamiya" ? "acrylic" : "lacquer",
    hexPreview: hex,
    preferredMeasurementId: `${lineId}:${code}:measurement`,
    preferredMeasurement: {
      _id: `${lineId}:${code}:measurement`,
      _creationTime: 1,
      measurementKey: `${lineId}:${code}:measurement`,
      paintMappingId: `${lineId}:${code}`,
      hex,
      lab: hexToLabD65(hex),
      labIlluminant: "D65",
      labObserver: "2deg",
      labMethod: "srgb_d65_cielab",
      accuracy: "approximate",
      sourceAuthority: "third_party",
      sourceType: "digital_color_chart",
      sourceName: "fixture",
      substrate: "digital",
      createdAt: 1,
      updatedAt: 1,
    },
    isActive: true,
    searchText: `${brand} ${line} ${code}`,
  } as unknown as ResolvedPaintMapping;
}
