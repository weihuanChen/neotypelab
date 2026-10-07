/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { styleIntentSchema } from "./creativeContracts";
import schema from "./schema";
import { additionalStylePresets, legacyOfficialStyleIntents, legacySeedShortDescriptions, officialStyleIntentFields } from "./stylePresetSeeds";

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

  test("original presets receive an official intent only while they have none", async () => {
    expect(Object.keys(legacyOfficialStyleIntents).sort()).toEqual([
      "desert-ops",
      "eva-inspired",
      "industrial-mecha",
      "military-prototype",
      "stealth-black",
    ]);
    for (const [slug, intent] of Object.entries(legacyOfficialStyleIntents)) {
      const fields = officialStyleIntentFields({ slug, name: slug });
      const parsed = styleIntentSchema.parse(JSON.parse(fields!.styleIntentJson));
      expect(parsed).toMatchObject({ source: "official", styleType: "preset", ...intent });
      expect(parsed.palette.primary).toMatch(/#[0-9A-F]{6}$/);
    }

    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("stylePresets", {
        name: "EVA-inspired", slug: "eva-inspired", promptKeywords: [], negativeKeywords: [],
        recommendedMaterialSlugs: [], seoKeywords: [], isActive: true, searchText: "eva",
      });
      await ctx.db.insert("stylePresets", {
        name: "Stealth Black", slug: "stealth-black", promptKeywords: [], negativeKeywords: [],
        recommendedMaterialSlugs: [], seoKeywords: [], isActive: true, searchText: "stealth",
        styleIntentJson: "{\"kept\":true}", styleIntentVersion: "custom",
      });
    });

    const results = await t.mutation(internal.init.backfillMissingStyleIntents, {});
    expect(results.find((row) => row.slug === "eva-inspired")?.status).toBe("updated");
    expect(results.find((row) => row.slug === "stealth-black")?.status).toBe("existing");
    expect(results.filter((row) => row.status === "missing")).toHaveLength(3);

    const rows = await t.run((ctx) => ctx.db.query("stylePresets").collect());
    expect(styleIntentSchema.parse(JSON.parse(rows.find((row) => row.slug === "eva-inspired")!.styleIntentJson!)).name).toBe("EVA-inspired");
    expect(rows.find((row) => row.slug === "stealth-black")?.styleIntentJson).toBe("{\"kept\":true}");
  });

  test("platform setting seeds insert each key once", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(internal.init.seedMissingPlatformSettings, {});
    expect(created.map((row) => row.status)).toEqual(["created", "created", "created"]);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", "system")).first();
      await ctx.db.patch(row!._id, { valueJson: "{\"maintenanceMode\":true}" });
    });
    const again = await t.mutation(internal.init.seedMissingPlatformSettings, {});
    expect(again.every((row) => row.status === "existing")).toBe(true);
    const system = await t.run((ctx) => ctx.db.query("platformSettings").withIndex("by_key", (q) => q.eq("key", "system")).first());
    expect(system?.valueJson).toBe("{\"maintenanceMode\":true}");
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
