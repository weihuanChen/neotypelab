import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BASE_BLOCKLIST,
  blocklistCategories,
  findBlocklistMatches,
  normalizeForBlocklist,
} from "./contentBlocklistPolicy";

describe("prompt blocklist", () => {
  it("covers every prohibited category", () => {
    const covered = new Set(BASE_BLOCKLIST.map((entry) => entry.category));
    for (const category of blocklistCategories) expect(covered.has(category)).toBe(true);
  });

  it("normalizes case, width, and separators", () => {
    expect(normalizeForBlocklist("  Spider-Man_ＮＳＦＷ!! ")).toBe("spider man nsfw");
  });

  it("matches whole words and phrases despite punctuation and casing", () => {
    const hits = findBlocklistMatches("A NUDE pilot posing; Spider_Man decals, heil-hitler banner", BASE_BLOCKLIST);
    expect(hits.map((hit) => hit.term).sort()).toEqual(["heil hitler", "nude", "spider man"]);
    expect(new Set(hits.map((hit) => hit.category))).toEqual(new Set(["sexual", "ip", "hate"]));
  });

  it("matches CJK terms as substrings", () => {
    expect(findBlocklistMatches("机甲涂装，带有血腥效果", BASE_BLOCKLIST)).toEqual([
      { term: "血腥", category: "violence" },
    ]);
  });

  it("does not flag normal mecha paint language", () => {
    for (const prompt of [
      "Blood red armor with gunmetal frame and heavy battle damage",
      "Military olive drab, beam rifle in matte black, kill marks on the shield",
      "Essex-inspired racing livery with Ferrari red and Gulf blue",
      "Gundam RX-78 in Bandai catalog colors, Tamiya X-11 chrome silver",
      "Sexton grey panels, Gorey-style crosshatch, marvelous metallic finish",
    ]) {
      expect(findBlocklistMatches(prompt, BASE_BLOCKLIST)).toEqual([]);
    }
  });

  it("never matches the product's own prompt templates and seeds", () => {
    // Composed prompts include these files' template text; a hit here would block every user.
    const skip = /^(schema|contentBlocklist|contentSafety)/;
    const files = readdirSync("convex").filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !skip.test(file)
    );
    const offenders = files.flatMap((file) =>
      findBlocklistMatches(readFileSync(`convex/${file}`, "utf8"), BASE_BLOCKLIST)
        .map((hit) => `${file}: ${hit.term}`)
    );
    expect(offenders).toEqual([]);
  });
});
