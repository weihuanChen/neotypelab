import { v } from "convex/values";
import { vPromptTemplateKind } from "./domain";
import { query } from "./functions";
import { normalizeStringForSearch } from "./utils";

export const listTemplates = query({
  args: {
    kind: v.optional(vPromptTemplateKind),
  },
  async handler(ctx, { kind }) {
    const templates = kind === undefined
      ? await ctx.db.query("promptTemplates").collect()
      : await ctx.db
          .query("promptTemplates")
          .withIndex("by_kind", (q) => q.eq("kind", kind))
          .collect();

    return templates
      .filter((template) => template.isActive)
      .map((template) => ({
        _id: template._id,
        name: template.name,
        slug: template.slug,
        kind: template.kind,
        version: template.version,
        notePolicy: template.notePolicy,
      }));
  },
});

export const describeCompositionInputs = query({
  args: {
    baseModelSlug: v.string(),
    stylePresetSlug: v.string(),
    materialPresetSlug: v.string(),
  },
  async handler(ctx, { baseModelSlug, stylePresetSlug, materialPresetSlug }) {
    const normalizedBaseModelSlug = normalizeStringForSearch(baseModelSlug);
    const normalizedStylePresetSlug = normalizeStringForSearch(stylePresetSlug);
    const normalizedMaterialPresetSlug = normalizeStringForSearch(materialPresetSlug);

    const [baseModel, stylePreset, materialPreset] = await Promise.all([
      ctx.db
        .query("baseModels")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedBaseModelSlug))
        .unique(),
      ctx.db
        .query("stylePresets")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedStylePresetSlug))
        .unique(),
      ctx.db
        .query("materialPresets")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedMaterialPresetSlug))
        .unique(),
    ]);

    return {
      baseModel,
      stylePreset,
      materialPreset,
    };
  },
});
