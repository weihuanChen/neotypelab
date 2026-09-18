import { describe, expect, it } from "vitest";
import {
  buildShowcaseHref,
  hasActiveShowcaseQuery,
  isPublicArchivePending,
  publicConceptImageUrl,
  selectExhibitionSections,
} from "./showcaseUtils";

describe("publicConceptImageUrl", () => {
  it("prefers the 1280 preview over the 512 thumbnail", () => {
    expect(
      publicConceptImageUrl(
        {
          publicUrl: "https://cdn.test/preview.webp",
          thumbnailUrl: "https://cdn.test/thumbnail.webp",
          masterUrl: "https://cdn.test/master.webp",
        },
        "/fallback.png"
      )
    ).toBe("https://cdn.test/preview.webp");
  });

  it("falls back through master, then thumbnail, then the supplied fallback", () => {
    expect(
      publicConceptImageUrl(
        { masterUrl: "https://cdn.test/master.webp", thumbnailUrl: "https://cdn.test/thumbnail.webp" },
        "/fallback.png"
      )
    ).toBe("https://cdn.test/master.webp");
    expect(
      publicConceptImageUrl({ thumbnailUrl: "https://cdn.test/thumbnail.webp" }, "/fallback.png")
    ).toBe("https://cdn.test/thumbnail.webp");
    expect(publicConceptImageUrl(null, "/fallback.png")).toBe("/fallback.png");
    expect(publicConceptImageUrl(null)).toBe("");
  });
});

describe("isPublicArchivePending", () => {
  it("holds the archive closed until live data arrives on an empty snapshot", () => {
    expect(isPublicArchivePending(undefined, 0, true)).toBe(true);
    expect(isPublicArchivePending(undefined, 3, true)).toBe(false);
    expect(isPublicArchivePending([], 0, true)).toBe(false);
    expect(isPublicArchivePending(undefined, 0, false)).toBe(false);
  });
});

describe("selectExhibitionSections", () => {
  const catalog = [
    item("a", 30),
    item("b", 20),
    item("c", 10),
  ];

  it("does not empty Selected or Recent when the live catalog is smaller than the editorial offsets", () => {
    const sections = selectExhibitionSections(catalog, catalog, {});

    expect(sections.selected.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(sections.recent.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps filtered matches in Selected even if they already appear in Featured", () => {
    const sections = selectExhibitionSections(catalog, [catalog[0], catalog[1]], {
      style: "command-unit",
    });

    expect(hasActiveShowcaseQuery({ style: "command-unit" })).toBe(true);
    expect(sections.selected.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(sections.recent.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("hides Featured duplicates from Selected only when the unfiltered archive has leftover records", () => {
    const archive = Array.from({ length: 12 }, (_, index) => item(String(index), 100 - index));
    const sections = selectExhibitionSections(archive, archive, {});

    expect(sections.featured.map((entry) => entry.id)).toEqual(["0", "1", "2"]);
    expect(sections.selected.map((entry) => entry.id)).toEqual(["3", "4", "5", "6", "7", "8"]);
    expect(sections.recent.map((entry) => entry.id)).toEqual(["9", "10", "11"]);
  });

  it("preserves kit filters when returning to Featured", () => {
    expect(buildShowcaseHref({ baseModel: "mg-jesta", sort: "recent" }, { sort: null, view: null })).toBe(
      "/showcase?baseModel=mg-jesta"
    );
  });
});

function item(id: string, createdAt: number) {
  return { id, createdAt };
}
