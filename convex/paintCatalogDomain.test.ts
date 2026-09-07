// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildPaintExternalKey,
  buildPaintMeasurementKey,
  canonicalizePaintLineSlug,
  normalizePaintCodeForSearch,
  PAINT_CATALOG_CONTRACT_VERSION,
  PAINT_COLOR_ACCURACIES,
  PAINT_COLOR_SOURCE_AUTHORITIES,
  PAINT_COLOR_SOURCE_TYPES,
  PAINT_COLOR_SUBSTRATES,
  PAINT_EFFECTS,
  PAINT_EQUIVALENCE_METHODS,
  PAINT_LAB_METHODS,
  PAINT_OPACITIES,
  PAINT_SHEENS,
  PAINT_TYPES,
} from "./paintCatalogDomain";

describe("paint catalog data contract", () => {
  it("publishes unique canonical enum values", () => {
    const enumGroups = [
      PAINT_TYPES,
      PAINT_SHEENS,
      PAINT_OPACITIES,
      PAINT_EFFECTS,
      PAINT_EQUIVALENCE_METHODS,
      PAINT_COLOR_ACCURACIES,
      PAINT_COLOR_SOURCE_AUTHORITIES,
      PAINT_COLOR_SOURCE_TYPES,
      PAINT_COLOR_SUBSTRATES,
      PAINT_LAB_METHODS,
    ];

    expect(PAINT_CATALOG_CONTRACT_VERSION).toBe("paint-catalog.v1");
    for (const values of enumGroups) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("normalizes catalog codes without inventing zero padding", () => {
    expect(normalizePaintCodeForSearch(" C5 ")).toBe("C5");
    expect(normalizePaintCodeForSearch("X-10")).toBe("X10");
    expect(normalizePaintCodeForSearch("\uff47\uff58\u2212100")).toBe("GX100");
    expect(normalizePaintCodeForSearch("C01")).not.toBe(
      normalizePaintCodeForSearch("C1")
    );
  });

  it("builds a stable external key scoped to brand and paint line", () => {
    expect(
      buildPaintExternalKey({
        brandSlug: "gsi-creos",
        paintLineSlug: "mr-color",
        code: "C5",
      })
    ).toBe("gsi-creos:mr-color:c5");
  });

  it("rejects unstable identity inputs", () => {
    expect(() =>
      buildPaintExternalKey({
        brandSlug: "GSI Creos",
        paintLineSlug: "mr-color",
        code: "C5",
      })
    ).toThrow("brandSlug must be a lowercase kebab-case slug");
    expect(() =>
      buildPaintExternalKey({
        brandSlug: "gsi-creos",
        paintLineSlug: "mr-color",
        code: "---",
      })
    ).toThrow("Paint code must contain at least one ASCII letter or digit");
  });

  it("builds a stable measurement key from provenance", () => {
    expect(
      buildPaintMeasurementKey({
        paintExternalKey: "gsi-creos:mr-color:c5",
        sourceAuthority: "third_party",
        sourceType: "digital_color_chart",
        substrate: "digital",
        sourceName: "Photoshoplus digital color chart",
      })
    ).toBe(
      "gsi-creos:mr-color:c5:third_party:digital_color_chart:digital:photoshoplus-digital-color-chart"
    );
  });

  it("maps the Tamiya acrylic import alias to the existing stable line slug", () => {
    expect(
      canonicalizePaintLineSlug({
        brandSlug: "tamiya",
        paintLineSlug: "tamiya-color-acrylic",
      })
    ).toBe("acrylic");
  });
});
