import { describe, expect, it } from "vitest";
import { parseSafeSearchResponse, safeSearchMode, safeSearchRequestBody, safeSearchVerdict, type SafeSearchAnnotation } from "./customKitSafeSearch";

const clear: SafeSearchAnnotation = { adult: "VERY_UNLIKELY", spoof: "VERY_UNLIKELY", medical: "VERY_UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" };

describe("Custom Kit SafeSearch screening", () => {
  it("requests only SafeSearch for one inline image", () => {
    expect(safeSearchRequestBody("aW1hZ2U=")).toEqual({ requests: [{ image: { content: "aW1hZ2U=" }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }] });
  });
  it("blocks explicit signals but lets non-explicit revealing figures continue to the Gemini review", () => {
    expect(safeSearchVerdict({ ...clear, adult: "LIKELY" })).toBe("adult-content");
    expect(safeSearchVerdict({ ...clear, adult: "POSSIBLE", racy: "VERY_LIKELY" })).toBe("adult-content");
    expect(safeSearchVerdict({ ...clear, adult: "UNLIKELY", racy: "VERY_LIKELY" })).toBeNull();
    expect(safeSearchVerdict({ ...clear, adult: "POSSIBLE", racy: "LIKELY" })).toBeNull();
  });
  it("keeps mecha combat usable: violence alone never blocks", () => {
    expect(safeSearchVerdict({ ...clear, violence: "VERY_LIKELY" })).toBeNull();
    expect(safeSearchVerdict({ ...clear, violence: "LIKELY", medical: "VERY_LIKELY" })).toBe("graphic-injury");
  });
  it("fails closed when the result is inconclusive or malformed", () => {
    expect(() => safeSearchVerdict({ ...clear, adult: "UNKNOWN" })).toThrow(/inconclusive/);
    expect(() => parseSafeSearchResponse({ responses: [{ error: { code: 3, message: "Bad image data." } }] })).toThrow(/failed \(3\)/);
    expect(() => parseSafeSearchResponse({ responses: [{ safeSearchAnnotation: { adult: "LIKELY" } }] })).toThrow(/no result/);
    expect(() => parseSafeSearchResponse({})).toThrow(/unexpected/);
    expect(parseSafeSearchResponse({ responses: [{ safeSearchAnnotation: clear }] })).toEqual(clear);
  });
  it("defaults to enforce unless monitor is set explicitly", () => {
    expect(safeSearchMode(undefined)).toBe("enforce");
    expect(safeSearchMode("Monitor")).toBe("enforce");
    expect(safeSearchMode("monitor")).toBe("monitor");
  });
});
