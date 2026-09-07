// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { ResolvedPaintMapping } from "./paintCatalogCompatibility";
import { rankPaintMatches } from "./paintMatchingEngine";

describe("paint matching engine", () => {
  it("sorts compatible colors by CIEDE2000 and excludes incompatible effects", () => {
    const target = paint("target", "Brand A", { l: 50, a: 0, b: 0 });
    const close = paint("close", "Brand B", { l: 51, a: 0, b: 0 });
    const farther = paint("farther", "Brand C", { l: 55, a: 0, b: 0 });
    const metallic = paint("metallic", "Brand D", { l: 50, a: 0, b: 0 }, {
      effects: ["metallic"],
    });

    const matches = rankPaintMatches(target, [farther, metallic, close], {
      limit: 10,
      maxDeltaE: 20,
    });

    expect(matches.map((match) => match.candidate.mappingKey)).toEqual([
      "close",
      "farther",
    ]);
    expect(matches[0]).toMatchObject({
      method: "delta_e_2000",
      matchBand: "very_close",
      warnings: ["approximate_color_data", "opacity_unknown"],
    });
    expect(matches[0].deltaE00).toBeLessThan(matches[1].deltaE00);
  });

  it("keeps transparent paint in its own candidate group", () => {
    const clear = paint("clear", "Brand A", { l: 50, a: 10, b: 5 }, {
      opacity: "transparent",
    });
    const clearMatch = paint("clear-match", "Brand B", { l: 51, a: 10, b: 5 }, {
      opacity: "transparent",
    });
    const opaqueMatch = paint("opaque-match", "Brand C", { l: 50, a: 10, b: 5 }, {
      opacity: "opaque",
    });

    const matches = rankPaintMatches(clear, [opaqueMatch, clearMatch]);

    expect(matches).toHaveLength(1);
    expect(matches[0].candidate.mappingKey).toBe("clear-match");
    expect(matches[0].warnings).toContain("transparent_color_depends_on_substrate");
  });

  it("supports cross-brand and target-brand filters", () => {
    const target = paint("target", "Brand A", { l: 50, a: 0, b: 0 }, {
      brandId: "brand-a",
    });
    const sameBrand = paint("same", "Brand A", { l: 50, a: 0, b: 0 }, {
      brandId: "brand-a",
    });
    const otherBrand = paint("other", "Brand B", { l: 51, a: 0, b: 0 }, {
      brandId: "brand-b",
    });

    expect(
      rankPaintMatches(target, [sameBrand, otherBrand], {
        crossBrandOnly: true,
      }).map((match) => match.candidate.mappingKey)
    ).toEqual(["other"]);
    expect(
      rankPaintMatches(target, [sameBrand, otherBrand], {
        targetBrandId: "brand-b" as never,
      }).map((match) => match.candidate.mappingKey)
    ).toEqual(["other"]);
  });
});

function paint(
  mappingKey: string,
  brand: string,
  lab: { l: number; a: number; b: number },
  overrides: {
    effects?: string[];
    opacity?: "opaque" | "translucent" | "transparent";
    brandId?: string;
  } = {}
) {
  return {
    _id: mappingKey,
    mappingKey,
    brand,
    brandName: brand,
    brandId: overrides.brandId,
    code: mappingKey,
    name: mappingKey,
    colorName: mappingKey,
    effects: overrides.effects ?? [],
    opacity: overrides.opacity,
    isActive: true,
    searchText: mappingKey,
    preferredMeasurement: {
      _id: `${mappingKey}-measurement`,
      paintMappingId: mappingKey,
      measurementKey: `${mappingKey}:measurement`,
      lab,
      labIlluminant: "D65",
      labObserver: "2deg",
      labMethod: "derived_from_srgb",
      accuracy: "approximate",
      sourceAuthority: "internal",
      sourceType: "manual_estimate",
      sourceName: "Test",
      substrate: "digital",
      createdAt: 1,
      updatedAt: 1,
    },
  } as unknown as ResolvedPaintMapping;
}
