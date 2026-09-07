// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  deltaE2000,
  derivePaintColorFromHex,
  hexToLabD65,
  hexToRgb,
  normalizeHex,
  rgbToHex,
} from "./paintColor";

describe("paint color conversion", () => {
  it("normalizes only six-digit sRGB HEX values", () => {
    expect(normalizeHex(" #0054a7 ")).toBe("#0054A7");
    expect(() => normalizeHex("#05A")).toThrow("#RRGGBB");
    expect(() => normalizeHex("#0054A7FF")).toThrow("#RRGGBB");
    expect(() => normalizeHex("0054A7")).toThrow("#RRGGBB");
  });

  it("converts between HEX and integer sRGB", () => {
    expect(hexToRgb("#0054A7")).toEqual({ r: 0, g: 84, b: 167 });
    expect(rgbToHex({ r: 0, g: 84, b: 167 })).toBe("#0054A7");
    expect(() => rgbToHex({ r: 0, g: 84.5, b: 167 })).toThrow(
      "RGB g must be an integer"
    );
    expect(() => rgbToHex({ r: -1, g: 84, b: 167 })).toThrow(
      "RGB r must be an integer"
    );
  });

  it.each([
    ["#000000", { l: 0, a: 0, b: 0 }],
    ["#FFFFFF", { l: 100, a: 0, b: 0 }],
    ["#FF0000", { l: 53.2408, a: 80.0925, b: 67.2032 }],
    ["#00FF00", { l: 87.7347, a: -86.1827, b: 83.1793 }],
    ["#0000FF", { l: 32.297, a: 79.1875, b: -107.8602 }],
    ["#0054A7", { l: 36.232, a: 12.0225, b: -50.483 }],
  ])("converts %s to the expected CIELAB D65/2deg value", (hex, expected) => {
    const actual = hexToLabD65(hex);
    expect(actual.l).toBeCloseTo(expected.l, 3);
    expect(actual.a).toBeCloseTo(expected.a, 3);
    expect(actual.b).toBeCloseTo(expected.b, 3);
  });

  it("returns conversion provenance with derived paint colors", () => {
    expect(derivePaintColorFromHex("#0054a7")).toMatchObject({
      hex: "#0054A7",
      rgb: { r: 0, g: 84, b: 167 },
      rgbColorSpace: "srgb",
      labIlluminant: "D65",
      labObserver: "2deg",
      labMethod: "derived_from_srgb",
      conversionVersion: "srgb-d65-cielab-v1",
    });
  });
});

describe("CIEDE2000", () => {
  it.each([
    [
      { l: 50, a: 2.6772, b: -79.7751 },
      { l: 50, a: 0, b: -82.7485 },
      2.0425,
    ],
    [
      { l: 50, a: 3.1571, b: -77.2803 },
      { l: 50, a: 0, b: -82.7485 },
      2.8615,
    ],
    [
      { l: 50, a: 2.8361, b: -74.02 },
      { l: 50, a: 0, b: -82.7485 },
      3.4412,
    ],
  ])("matches the reference pair %#", (left, right, expected) => {
    expect(deltaE2000(left, right)).toBeCloseTo(expected, 4);
    expect(deltaE2000(right, left)).toBeCloseTo(expected, 4);
  });

  it("returns zero for identical colors", () => {
    const lab = { l: 36.232, a: 12.0225, b: -50.483 };
    expect(deltaE2000(lab, lab)).toBe(0);
  });
});
