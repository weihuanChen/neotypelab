// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  PAINT_CATALOG_IMPORT_COLUMNS,
  parsePaintCatalogCsv,
} from "@/lib/paintCatalogImport";

describe("paint catalog CSV parser", () => {
  it("normalizes compatible aliases and derives canonical LAB", () => {
    const result = parsePaintCatalogCsv(csvFor([validRow()]));

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((issue) => issue.code)).toEqual([
      "normalized_code_replaced",
      "sheen_alias_normalized",
    ]);
    expect(result.records[0]).toMatchObject({
      externalKey: "gsi-creos:mr-color:c5",
      normalizedCode: "C5",
      sheen: "semi_gloss",
      hex: "#0054A7",
      rgb: { r: 0, g: 84, b: 167 },
      lab: {
        l: 36.232017735391295,
        a: 12.022521981033595,
        b: -50.4830071392556,
      },
    });
  });

  it("blocks missing booleans instead of guessing status", () => {
    const result = parsePaintCatalogCsv(csvFor([validRow({ isActive: "" })]));

    expect(result.records).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: "isActive",
        code: "invalid_boolean",
      })
    );
  });

  it("blocks HEX and RGB disagreement", () => {
    const result = parsePaintCatalogCsv(csvFor([validRow({ rgbB: "168" })]));

    expect(result.records).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "hex_rgb_mismatch" })
    );
  });

  it("handles BOM, quoted commas, and duplicate external keys", () => {
    const csv = `\uFEFF${csvFor([
      validRow({ notes: "Quoted, source note" }),
      validRow({ notes: "Second record with the same identity" }),
    ])}`;
    const result = parsePaintCatalogCsv(csv);

    expect(result.rowCount).toBe(2);
    expect(result.errors.filter((issue) => issue.code === "duplicate_value")).toHaveLength(4);
  });

  it("imports a product without inventing a color measurement", () => {
    const result = parsePaintCatalogCsv(
      csvFor([
        validRow({
          hex: "",
          rgbR: "",
          rgbG: "",
          rgbB: "",
          rgbColorSpace: "",
          illuminant: "",
          observer: "",
          measurementMethod: "",
          accuracy: "",
          sourceAuthority: "",
          sourceType: "",
          sourceName: "",
          sourceUrl: "",
          substrate: "",
          isPreferred: "false",
        }),
      ])
    );

    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      externalKey: "gsi-creos:mr-color:c5",
      isPreferred: false,
    });
    expect(result.records[0].hex).toBeUndefined();
    expect(result.records[0].measurementKey).toBeUndefined();
  });

  it("canonicalizes the Gaia brand slug and punctuated code key", () => {
    const result = parsePaintCatalogCsv(
      csvFor([
        validRow({
          externalKey: "gaianotes:gaia-color:gp-01",
          brandName: "Gaia Notes",
          brandSlug: "gaianotes",
          paintLineName: "Gaia Color",
          paintLineSlug: "gaia-color",
          code: "GP-01",
          normalizedCode: "GPGP01",
        }),
      ])
    );

    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({
      brandSlug: "gaia-notes",
      externalKey: "gaia-notes:gaia-color:gp01",
      normalizedCode: "GP01",
    });
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "external_key_replaced"
    );
  });

  it("disables an impossible preferred flag when color data is absent", () => {
    const result = parsePaintCatalogCsv(
      csvFor([
        validRow({
          hex: "",
          rgbR: "",
          rgbG: "",
          rgbB: "",
          rgbColorSpace: "",
          illuminant: "",
          observer: "",
          measurementMethod: "",
          accuracy: "",
          sourceAuthority: "",
          sourceType: "",
          sourceName: "",
          sourceUrl: "",
          substrate: "",
          isPreferred: "true",
        }),
      ])
    );

    expect(result.errors).toEqual([]);
    expect(result.records[0].isPreferred).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "preferred_disabled_without_measurement",
      })
    );
  });
});

function validRow(overrides: Record<string, string> = {}) {
  return {
    schemaVersion: "paint-catalog.v1",
    externalKey: "gsi-creos:mr-color:c5",
    brandName: "GSI Creos",
    brandSlug: "gsi-creos",
    paintLineName: "Mr. Color",
    paintLineSlug: "mr-color",
    series: "C",
    code: "C5",
    normalizedCode: "C005",
    name: "Blue",
    paintType: "lacquer",
    sheen: "semi-gloss",
    opacity: "opaque",
    effects: "",
    hex: "#0054A7",
    rgbR: "0",
    rgbG: "84",
    rgbB: "167",
    rgbColorSpace: "srgb",
    labL: "",
    labA: "",
    labB: "",
    illuminant: "D65",
    observer: "2deg",
    measurementMethod: "digital_chart",
    accuracy: "approximate",
    sourceAuthority: "third_party",
    sourceType: "digital_color_chart",
    sourceName: "Photoshoplus digital color chart",
    sourceUrl: "https://example.test/colors",
    substrate: "digital",
    isPreferred: "true",
    isActive: "true",
    notes: "Approximate chart value",
    ...overrides,
  };
}

function csvFor(rows: Array<Record<string, string>>) {
  const header = PAINT_CATALOG_IMPORT_COLUMNS.join(",");
  const body = rows.map((row) =>
    PAINT_CATALOG_IMPORT_COLUMNS.map((column) => csvCell(row[column] ?? "")).join(",")
  );
  return [header, ...body].join("\n");
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
