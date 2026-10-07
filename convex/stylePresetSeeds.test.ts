/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { styleIntentSchema } from "./creativeContracts";
import schema from "./schema";
import { additionalStylePresets, legacySeedShortDescriptions } from "./stylePresetSeeds";

const modules = import.meta.glob("./**/*.ts");

describe("official style preset seeds", () => {
  test("every additional preset carries a valid official intent with HEX anchors", () => {
    const slugs = new Set(additionalStylePresets.map((preset) => preset.slug));
    expect(slugs.size).toBe(additionalStylePresets.length);
    for (const preset of additionalStylePresets) {
      const intent = styleIntentSchema.parse(JSON.parse(preset.styleIntentJson));
      expect(intent).toMatchObject({ source: "official", styleType: "preset", name: preset.name });
      expect(intent.palette.primary).toMatch(/#[0-9A-F]{6}$/);
      expect(preset.shortDescription).not.toMatch(/#[0-9a-f]{6}/i);
      expect(preset.shortDescription).not.toBe(legacySeedShortDescriptions[preset.slug]);
    }
  });

  test("description refresh only rewrites rows still carrying the original seed text", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.init.seedMissingStylePresets, {});
    await t.run(async (ctx) => {
      for (const [slug, legacy] of Object.entries(legacySeedShortDescriptions)) {
        const row = await ctx.db.query("stylePresets").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
        await ctx.db.patch(row!._id, {
          shortDescription: slug === "naval-grey" ? "Admin wrote this." : legacy,
          searchText: `${row!.name} ${legacy}`,
        });
      }
    });

    const results = await t.mutation(internal.init.refreshSeededPresetDescriptions, {});
    expect(results.find((r) => r.slug === "naval-grey")?.status).toBe("skipped");
    expect(results.filter((r) => r.status === "updated")).toHaveLength(results.length - 1);

    const rows = await t.run((ctx) => ctx.db.query("stylePresets").collect());
    const ac = rows.find((r) => r.slug === "armored-core-inspired")!;
    expect(ac.shortDescription).toMatch(/^Cold and transactional/);
    expect(ac.searchText).toContain("Cold and transactional");
    expect(ac.searchText).not.toContain("Mercenary frame look");
    expect(rows.find((r) => r.slug === "naval-grey")?.shortDescription).toBe("Admin wrote this.");

    const again = await t.mutation(internal.init.refreshSeededPresetDescriptions, {});
    expect(again.every((r) => r.status === "skipped")).toBe(true);
  });

  test("backfill inserts missing presets once and never touches existing rows", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("stylePresets", {
        name: "Crimson Command (admin edit)", slug: "crimson-command", promptKeywords: [], negativeKeywords: [],
        recommendedMaterialSlugs: [], seoKeywords: [], isActive: false, searchText: "admin",
      });
    });

    const first = await t.mutation(internal.init.seedMissingStylePresets, {});
    expect(first.find((r) => r.slug === "crimson-command")?.status).toBe("existing");
    expect(first.filter((r) => r.status === "created")).toHaveLength(first.length - 1);

    const second = await t.mutation(internal.init.seedMissingStylePresets, {});
    expect(second.every((r) => r.status === "existing")).toBe(true);

    const rows = await t.run((ctx) => ctx.db.query("stylePresets").collect());
    expect(rows).toHaveLength(first.length);
    expect(rows.find((r) => r.slug === "crimson-command")?.name).toBe("Crimson Command (admin edit)");
  });
});
