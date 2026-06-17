import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";
import { query } from "./functions";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";

export const listCreateOptions = query({
  args: {},
  async handler(ctx) {
    const [
      kitVariantsRaw,
      stylePresetsRaw,
      materialPresetsRaw,
      colorRolesRaw,
      priceRulesRaw,
    ] = await Promise.all([
      ctx.db.query("baseModels").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
      ctx.db.query("creditPriceRules").withIndex("by_sortOrder").collect(),
    ]);

    const kitVariants = await Promise.all(
      kitVariantsRaw
        .filter(isPublicModelCatalogRecord)
        .map((kitVariant) => summarizeBaseModelWithHierarchy(ctx, kitVariant))
    ).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null));
    const stylePresets = stylePresetsRaw
      .filter((preset) => preset.isActive)
      .map((preset) => ({
        _id: preset._id,
        name: preset.name,
        slug: preset.slug,
        category: preset.category,
        shortDescription: preset.shortDescription,
        contrastLevel: preset.contrastLevel,
        weatheringProfile: preset.weatheringProfile,
      }));
    const materialPresets = materialPresetsRaw
      .filter((preset) => preset.isActive)
      .map((preset) => ({
        _id: preset._id,
        name: preset.name,
        slug: preset.slug,
        finishType: preset.finishType,
        reflectivityLevel: preset.reflectivityLevel,
        sheenLevel: preset.sheenLevel,
        difficultyLevel: preset.difficultyLevel,
      }));
    const colorRoles = colorRolesRaw.map((role) => ({
      _id: role._id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      visualWeight: role.visualWeight,
      recommendedArea: role.recommendedArea,
      sortOrder: role.sortOrder,
    }));
    const priceRules = priceRulesRaw
      .filter((rule) => rule.isActive)
      .map((rule) => ({
        _id: rule._id,
        actionType: rule.actionType,
        label: rule.label,
        creditCost: rule.creditCost,
        description: rule.description,
        generationKind: rule.generationKind,
      }));

    return {
      kitVariants,
      baseModels: kitVariants,
      stylePresets,
      materialPresets,
      colorRoles,
      priceRules,
    };
  },
});

export const listShowcaseStyles = query({
  args: {},
  async handler(ctx) {
    return (await ctx.db.query("stylePresets").collect())
      .filter((preset) => preset.isActive)
      .map((preset) => ({
        _id: preset._id,
        name: preset.name,
        slug: preset.slug,
        category: preset.category,
        shortDescription: preset.shortDescription,
        seoKeywords: preset.seoKeywords,
      }));
  },
});
