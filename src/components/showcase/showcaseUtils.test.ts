import { describe, expect, it } from "vitest";
import { publicConceptImageUrl } from "./showcaseUtils";

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

  it("falls back through master, then thumbnail, then the editorial image", () => {
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
  });
});
