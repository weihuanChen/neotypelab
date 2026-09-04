import { Id } from "./_generated/dataModel";
import {
  baseModelVariantSeeds,
  baseUnitSeeds,
  buildBaseModelVariantSearchText,
  buildBaseUnitSearchText,
  ipSeriesSeeds,
} from "./catalogHierarchy";
import { internalMutation } from "./functions";
import { DEFAULT_ENTITLEMENT_PROFILES } from "./entitlementPolicy";
import type { MutationCtx } from "./types";

export const init = internalMutation({
  args: {},
  handler: async (ctx) => {
    if ((await ctx.db.query("baseModels").first()) !== null) {
      throw new Error("Reference data is already seeded.");
    }

    await ensureDefaultEntitlementProfiles(ctx);

    const materialPresetIdsBySlug = new Map<string, Id<"materialPresets">>();
    for (const preset of materialPresets) {
      const id = await ctx.db.insert("materialPresets", preset);
      materialPresetIdsBySlug.set(preset.slug, id);
    }

    const ipSeriesIdsBySlug = new Map<string, Id<"ipSeries">>();
    for (const series of ipSeriesSeeds) {
      const id = await ctx.db.insert("ipSeries", series);
      ipSeriesIdsBySlug.set(series.slug, id);
    }

    const baseUnitIdsBySlug = new Map<string, Id<"baseUnits">>();
    for (const unit of baseUnitSeeds) {
      const ipSeriesId = ipSeriesIdsBySlug.get(unit.ipSeriesSlug);
      if (ipSeriesId === undefined) {
        throw new Error(`IP series seed not found for base unit ${unit.slug}`);
      }
      const { ipSeriesSlug, ...unitFields } = unit;
      const id = await ctx.db.insert("baseUnits", {
        ...unitFields,
        ipSeriesId,
        searchText: buildBaseUnitSearchText(unit),
      });
      baseUnitIdsBySlug.set(unit.slug, id);
    }

    const baseUnitSeedBySlug = new Map(baseUnitSeeds.map((unit) => [unit.slug, unit]));
    const variantSeedByBaseModelSlug = new Map(
      baseModelVariantSeeds.map((variant) => [variant.baseModelSlug, variant])
    );

    for (const model of baseModels) {
      const { defaultMaterialSlug, ...modelFields } = model;
      const variantSeed = variantSeedByBaseModelSlug.get(model.slug);
      const baseUnitId =
        variantSeed === undefined
          ? undefined
          : baseUnitIdsBySlug.get(variantSeed.baseUnitSlug);
      const baseUnit =
        variantSeed === undefined
          ? undefined
          : baseUnitSeedBySlug.get(variantSeed.baseUnitSlug);

      await ctx.db.insert("baseModels", {
        ...modelFields,
        baseUnitId,
        scale: variantSeed?.scale,
        releaseVersion: variantSeed?.releaseVersion,
        primaryModelBrand: variantSeed?.primaryModelBrand ?? model.manufacturer,
        panelDensity: variantSeed?.panelDensity,
        promptAnchor: variantSeed?.promptAnchor,
        status: variantSeed?.status ?? (model.isActive ? "active" : "archived"),
        defaultMaterialPresetId:
          defaultMaterialSlug === undefined
            ? undefined
            : materialPresetIdsBySlug.get(defaultMaterialSlug),
        searchText: buildBaseModelVariantSearchText({
          name: model.name,
          primaryModelBrand: variantSeed?.primaryModelBrand ?? model.manufacturer,
          grade: model.grade,
          scale: variantSeed?.scale,
          releaseVersion: variantSeed?.releaseVersion,
          complexityLevel: model.complexityLevel,
          panelDensity: variantSeed?.panelDensity,
          aliases: model.aliases,
          tags: model.tags,
          promptAnchor: variantSeed?.promptAnchor,
          unitName: baseUnit?.name,
          unitCode: baseUnit?.unitCode,
        }),
      });
    }

    for (const preset of stylePresets) {
      await ctx.db.insert("stylePresets", preset);
    }

    for (const role of colorRoles) {
      await ctx.db.insert("colorRoles", role);
    }

    for (const mapping of paintMappings) {
      await ctx.db.insert("paintMappings", mapping);
    }

    for (const template of promptTemplates) {
      await ctx.db.insert("promptTemplates", template);
    }

    for (const rule of creditPriceRules) {
      await ctx.db.insert("creditPriceRules", rule);
    }
  },
});

export const seedEntitlementProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ensureDefaultEntitlementProfiles(ctx);
  },
});

async function ensureDefaultEntitlementProfiles(ctx: MutationCtx) {
  const now = Date.now();
  const results: Array<{ slug: string; status: "created" | "existing" }> = [];
  for (const profile of Object.values(DEFAULT_ENTITLEMENT_PROFILES)) {
    const existing = await ctx.db
      .query("entitlementProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", profile.slug))
      .first();
    if (existing) {
      results.push({ slug: profile.slug, status: "existing" });
      continue;
    }
    await ctx.db.insert("entitlementProfiles", {
      ...profile,
      createdAt: now,
      updatedAt: now,
    });
    results.push({ slug: profile.slug, status: "created" });
  }
  return results;
}

const materialPresets = [
  {
    name: "Matte Armor",
    slug: "matte-armor",
    finishType: "matte",
    reflectivityLevel: "low",
    materialSpec: {
      reflectivity: "low",
      roughness: "high",
      surfaceTexture: "fine painted armor grain",
      metallicResponse: "none on outer armor",
      coatingBehavior: "flat military top coat with diffuse light response",
      clearCoatBehavior: "matte clear coat; no glossy highlights",
      edgeWearBehavior: "edges brighten slightly before exposing primer or metal",
      weatheringInteraction: "accepts dust, dry-brush, and light chipping without glare",
      allowedColorRoleSlugs: ["primary-armor", "secondary-armor"],
      forbiddenColorRoleSlugs: ["sensor-color"],
      renderBehavior:
        "Render armor with broad soft highlights, low reflection, and readable panel separation.",
    },
    promptKeywords: ["matte plating", "low reflection", "field-ready armor"],
    paintFinish: "flat",
    difficultyLevel: "easy",
    sheenLevel: "low",
    shortDescription: "Low-reflection armor plating for grounded military looks.",
    isActive: true,
  },
  {
    name: "Semi-gloss Armor",
    slug: "semi-gloss-armor",
    finishType: "semi-gloss",
    reflectivityLevel: "medium",
    materialSpec: {
      reflectivity: "medium",
      roughness: "medium",
      surfaceTexture: "smooth painted armor shell",
      metallicResponse: "none on outer armor",
      coatingBehavior: "production-line semi-gloss coating",
      clearCoatBehavior: "controlled semi-gloss clear coat with clean specular edges",
      edgeWearBehavior: "minor edge polish without heavy exposed metal",
      weatheringInteraction: "supports subtle panel lining and light operational marks",
      allowedColorRoleSlugs: ["primary-armor", "secondary-armor", "markings"],
      forbiddenColorRoleSlugs: [],
      renderBehavior:
        "Render clean armor with restrained highlights and crisp color-block boundaries.",
    },
    promptKeywords: ["clean armor", "production-line finish", "semi-gloss shell"],
    paintFinish: "semi-gloss",
    difficultyLevel: "easy",
    sheenLevel: "medium",
    shortDescription: "Balanced finish for practical production-line builds.",
    isActive: true,
  },
  {
    name: "Titanium Finish",
    slug: "titanium-finish",
    finishType: "metallic",
    reflectivityLevel: "high",
    materialSpec: {
      reflectivity: "high",
      roughness: "low",
      surfaceTexture: "smooth alloy finish",
      metallicResponse: "strong silver titanium response",
      coatingBehavior: "metallic lacquer over polished substrate",
      clearCoatBehavior: "gloss or semi-gloss clear that preserves metallic flake",
      edgeWearBehavior: "edges catch bright metal highlights, not paint chips",
      weatheringInteraction: "weathering should stay controlled so metallic value remains readable",
      allowedColorRoleSlugs: ["inner-frame", "accent", "secondary-armor"],
      forbiddenColorRoleSlugs: ["sensor-color"],
      renderBehavior:
        "Render with directional metallic highlights while preserving mecha panel geometry.",
    },
    promptKeywords: ["bright alloy", "titanium sheen", "premium metal finish"],
    paintFinish: "metallic",
    difficultyLevel: "medium",
    sheenLevel: "high",
    shortDescription: "Bright metal finish for premium showcase prototypes.",
    isActive: true,
  },
  {
    name: "Gunmetal Frame",
    slug: "gunmetal-frame",
    finishType: "metallic",
    reflectivityLevel: "medium",
    materialSpec: {
      reflectivity: "medium",
      roughness: "medium-low",
      surfaceTexture: "dark mechanical alloy",
      metallicResponse: "restrained gunmetal response",
      coatingBehavior: "dark metallic frame paint with mechanical depth",
      clearCoatBehavior: "semi-gloss clear on exposed mechanics",
      edgeWearBehavior: "contact edges reveal brighter metal scratches",
      weatheringInteraction: "accepts oil staining, joint grime, and dry-brushed edges",
      allowedColorRoleSlugs: ["inner-frame", "secondary-armor"],
      forbiddenColorRoleSlugs: ["primary-armor", "sensor-color"],
      renderBehavior:
        "Render exposed joints and mechanical recesses as dark metallic structures, not black plastic.",
    },
    promptKeywords: ["inner frame", "gunmetal alloy", "mechanical realism"],
    paintFinish: "metallic",
    difficultyLevel: "medium",
    sheenLevel: "medium",
    shortDescription: "Mechanical inner frame finish with restrained industrial tone.",
    isActive: true,
  },
  {
    name: "Ceramic White",
    slug: "ceramic-white",
    finishType: "ceramic",
    reflectivityLevel: "low",
    materialSpec: {
      reflectivity: "low",
      roughness: "medium-high",
      surfaceTexture: "smooth ceramic coating",
      metallicResponse: "none",
      coatingBehavior: "hard ceramic-like painted shell with diffuse response",
      clearCoatBehavior: "matte or satin clear coat, never wet gloss",
      edgeWearBehavior: "edges show subtle gray undercoat rather than bright metal",
      weatheringInteraction: "dust and panel filters should be visible but restrained",
      allowedColorRoleSlugs: ["primary-armor", "secondary-armor"],
      forbiddenColorRoleSlugs: ["inner-frame", "sensor-color"],
      renderBehavior:
        "Render white armor as a solid coated surface with clean shadow definition and no pearl effect.",
    },
    promptKeywords: ["ceramic shell", "clean white armor", "precision coating"],
    paintFinish: "matte",
    difficultyLevel: "medium",
    sheenLevel: "low",
    shortDescription: "Controlled white finish for lab-grade armor surfaces.",
    isActive: true,
  },
  {
    name: "Burnt Metal",
    slug: "burnt-metal",
    finishType: "metallic",
    reflectivityLevel: "medium",
    materialSpec: {
      reflectivity: "medium",
      roughness: "varied",
      surfaceTexture: "heat-stained metal with controlled discoloration",
      metallicResponse: "visible metallic base under heat tinting",
      coatingBehavior: "exposed or treated metal near vents, weapons, and exhaust zones",
      clearCoatBehavior: "minimal clear coat; preserve heat staining and discoloration",
      edgeWearBehavior: "edges show scorched highlights and darker soot accumulation",
      weatheringInteraction: "supports exhaust staining, heat bloom, and localized grime",
      allowedColorRoleSlugs: ["inner-frame", "accent"],
      forbiddenColorRoleSlugs: ["primary-armor", "sensor-color"],
      renderBehavior:
        "Render as localized metal treatment with heat tinting, not as a full-body armor color.",
    },
    promptKeywords: ["heat staining", "burnt exhaust", "mechanical wear"],
    paintFinish: "metallic",
    difficultyLevel: "hard",
    sheenLevel: "medium",
    shortDescription: "Heat-touched metallic treatment for vents, weapons, and joints.",
    isActive: true,
  },
];

const baseModels = [
  {
    name: "RX-78-2",
    slug: "rx-78-2",
    series: "Mobile Suit Gundam",
    manufacturer: "Bandai",
    primaryModelBrand: "Bandai",
    grade: "MG",
    silhouetteType: "hero-balanced",
    complexityLevel: "medium",
    aliases: ["Gundam RX-78-2", "Granddaddy Gundam"],
    tags: ["hero", "universal-century", "balanced"],
    defaultMaterialSlug: "semi-gloss-armor",
    status: "active",
    isActive: true,
    searchText: "RX-78-2 Mobile Suit Gundam MG hero balanced",
  },
  {
    name: "Sazabi",
    slug: "sazabi",
    series: "Char's Counterattack",
    manufacturer: "Bandai",
    primaryModelBrand: "Bandai",
    grade: "MG",
    silhouetteType: "heavy-ace",
    complexityLevel: "high",
    aliases: ["MSN-04 Sazabi"],
    tags: ["ace", "heavy", "char"],
    defaultMaterialSlug: "gunmetal-frame",
    status: "active",
    isActive: true,
    searchText: "Sazabi Char's Counterattack MG heavy ace",
  },
  {
    name: "Barbatos",
    slug: "barbatos",
    series: "Iron-Blooded Orphans",
    manufacturer: "Bandai",
    primaryModelBrand: "Bandai",
    grade: "MG",
    silhouetteType: "agile-frame",
    complexityLevel: "medium",
    aliases: ["ASW-G-08 Barbatos"],
    tags: ["frame", "melee", "orphan"],
    defaultMaterialSlug: "matte-armor",
    status: "active",
    isActive: true,
    searchText: "Barbatos Iron-Blooded Orphans MG agile frame",
  },
  {
    name: "Nu Gundam",
    slug: "nu-gundam",
    series: "Char's Counterattack",
    manufacturer: "Bandai",
    primaryModelBrand: "Bandai",
    grade: "RG",
    silhouetteType: "hero-long-range",
    complexityLevel: "high",
    aliases: ["RX-93 Nu Gundam"],
    tags: ["hero", "fin-funnel", "char-counterattack"],
    defaultMaterialSlug: "semi-gloss-armor",
    status: "active",
    isActive: true,
    searchText: "Nu Gundam Char's Counterattack RG hero long range",
  },
  {
    name: "EVA Unit 01",
    slug: "eva-unit-01",
    series: "Evangelion",
    manufacturer: "Bandai",
    primaryModelBrand: "Bandai",
    grade: "RG",
    silhouetteType: "agile-experimental",
    complexityLevel: "high",
    aliases: ["Evangelion Unit-01", "Test Type-01"],
    tags: ["eva", "experimental", "organic"],
    defaultMaterialSlug: "ceramic-white",
    status: "active",
    isActive: true,
    searchText: "EVA Unit 01 Evangelion RG agile experimental",
  },
];

const stylePresets = [
  {
    name: "EVA-inspired",
    slug: "eva-inspired",
    category: "anime-reference",
    shortDescription: "High-contrast tactical scheme with vivid accent control.",
    promptKeywords: ["high contrast", "reactor accents", "experimental armor"],
    negativeKeywords: ["toy-like", "rainbow", "soft pastel"],
    systemPromptFragment:
      "Preserve clean armor separation while emphasizing experimental reactor accents and cinematic contrast.",
    styleSpec: {
      colorRelationship: "high-contrast armor blocks with localized reactor accents",
      decalStyle: "technical caution decals and experimental unit markings",
      markingDensity: "medium",
      warningMarkingBehavior: "use warning marks around vents, reactor zones, and panel breaks only",
      tone: "experimental tactical",
      contrastBehavior: "sharp contrast between armor masses, with accents kept small",
      personalityTags: ["experimental", "high-contrast", "reactor-accented"],
      prohibitedEffects: ["rainbow gradients", "toy-like neon flooding", "organic redesign"],
      identityBoundary:
        "Do not reshape the base model into an EVA body; only borrow contrast and accent logic.",
      renderBehavior:
        "Keep the base kit silhouette intact while using high-contrast paint separation and localized glow cues.",
    },
    contrastLevel: "high",
    weatheringProfile: "clean",
    recommendedMaterialSlugs: ["semi-gloss-armor", "gunmetal-frame"],
    visibilityWeight: 0.9,
    promptVersion: "p1.v1",
    seoKeywords: ["eva inspired gunpla", "mecha repaint idea"],
    isActive: true,
    searchText: "EVA-inspired anime reference high contrast tactical reactor accents",
  },
  {
    name: "Military Prototype",
    slug: "military-prototype",
    category: "grounded",
    shortDescription: "Spray-ready utilitarian palette with restrained warning markings.",
    promptKeywords: ["prototype", "military", "panel markings"],
    negativeKeywords: ["festival colors", "anime poster"],
    systemPromptFragment:
      "Favor realistic masking boundaries, industrial caution markings, and pragmatic spray-ready panel logic.",
    styleSpec: {
      colorRelationship: "utilitarian primary armor with restrained secondary panels",
      decalStyle: "military prototype labels, serial marks, and caution text",
      markingDensity: "medium-low",
      warningMarkingBehavior: "place caution markings near hatches, vents, and weapon interfaces",
      tone: "grounded military prototype",
      contrastBehavior: "moderate contrast that keeps the armor field-readable",
      personalityTags: ["military", "prototype", "utilitarian"],
      prohibitedEffects: ["festival colors", "cinematic poster drama", "uncontrolled camouflage"],
      identityBoundary:
        "Style may change paint logic but must not change armor layout, proportions, or equipment.",
      renderBehavior:
        "Render as a physically paintable prototype scheme with realistic masking and practical marking placement.",
    },
    contrastLevel: "medium",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["matte-armor", "gunmetal-frame"],
    visibilityWeight: 0.8,
    promptVersion: "p1.v1",
    seoKeywords: ["military mecha colors", "gunpla repaint ideas"],
    isActive: true,
    searchText: "Military Prototype grounded utilitarian panel markings spray ready",
  },
  {
    name: "Desert Ops",
    slug: "desert-ops",
    category: "environmental",
    shortDescription: "Warm tactical armor tuned for dust, sun fade, and field wear.",
    promptKeywords: ["desert camouflage", "dust wear", "tan armor"],
    negativeKeywords: ["icy blue", "neon city"],
    systemPromptFragment:
      "Push dusty wear patterns, sun-faded panels, and believable field-use weathering without cartoon exaggeration.",
    styleSpec: {
      colorRelationship: "warm primary armor with darker utility secondary panels",
      decalStyle: "field unit markings, low-visibility labels, and sun-faded caution zones",
      markingDensity: "low",
      warningMarkingBehavior: "warning marks should be faded and sparse",
      tone: "environmental field operations",
      contrastBehavior: "medium contrast softened by dust and sun fade",
      personalityTags: ["desert", "field-worn", "sun-faded"],
      prohibitedEffects: ["neon city lighting", "icy palette bias", "cartoon sandstorm effects"],
      identityBoundary:
        "Desert treatment must stay on paint, dust, and markings; do not add new armor or cloth equipment.",
      renderBehavior:
        "Render as a desert-operational repaint with readable warm armor blocks and restrained field wear.",
    },
    contrastLevel: "medium",
    weatheringProfile: "heavy",
    recommendedMaterialSlugs: ["matte-armor"],
    visibilityWeight: 0.7,
    promptVersion: "p1.v1",
    seoKeywords: ["desert mecha colors", "weathered gunpla repaint"],
    isActive: true,
    searchText: "Desert Ops environmental camouflage dust wear tan armor",
  },
  {
    name: "Industrial Mecha",
    slug: "industrial-mecha",
    category: "hard-surface",
    shortDescription:
      "Factory-grade finish with visible material separation and warning zones.",
    promptKeywords: ["industrial", "hazard markings", "mechanical realism"],
    negativeKeywords: ["cute", "glossy rainbow"],
    systemPromptFragment:
      "Emphasize hard-surface realism, industrial caution graphics, and visible mechanical material separation.",
    styleSpec: {
      colorRelationship: "industrial armor fields separated from mechanical frame colors",
      decalStyle: "hazard striping, factory serial marks, and maintenance labels",
      markingDensity: "medium-high",
      warningMarkingBehavior: "use hazard markings in small mechanical zones, not across whole armor plates",
      tone: "factory-grade industrial hard-surface",
      contrastBehavior: "medium contrast with clear material separation",
      personalityTags: ["industrial", "hard-surface", "hazard-marked"],
      prohibitedEffects: ["cute styling", "rainbow gloss", "excessive construction decals"],
      identityBoundary:
        "Industrial styling may add graphics and surface treatment only; it must not rebuild the machine.",
      renderBehavior:
        "Render with crisp hard-surface material separation, localized hazard graphics, and realistic panel logic.",
    },
    contrastLevel: "medium",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["semi-gloss-armor", "gunmetal-frame"],
    visibilityWeight: 0.85,
    promptVersion: "p1.v1",
    seoKeywords: ["industrial mecha repaint", "hard surface gunpla colors"],
    isActive: true,
    searchText: "Industrial Mecha factory grade hazard markings mechanical realism",
  },
  {
    name: "Stealth Black",
    slug: "stealth-black",
    category: "tactical",
    shortDescription: "Low-signature black stack with restrained sensor contrast.",
    promptKeywords: ["stealth black", "low signature", "sensor restraint"],
    negativeKeywords: ["glossy rainbow", "festival lighting"],
    systemPromptFragment:
      "Keep most armor low-signature and controlled, using subtle reflectivity and limited sensor contrast.",
    styleSpec: {
      colorRelationship: "dark low-signature armor with minimal controlled accents",
      decalStyle: "subtle low-visibility markings and limited tactical identifiers",
      markingDensity: "low",
      warningMarkingBehavior: "avoid bright warning graphics except tiny functional indicators",
      tone: "stealth tactical",
      contrastBehavior: "low contrast with readable silhouette edges",
      personalityTags: ["stealth", "low-signature", "restrained"],
      prohibitedEffects: ["glossy rainbow", "festival lighting", "overbright decals"],
      identityBoundary:
        "Stealth treatment must not remove native equipment or simplify the kit silhouette.",
      renderBehavior:
        "Render dark surfaces with subtle material variation so panel structure remains readable.",
    },
    contrastLevel: "low",
    weatheringProfile: "clean",
    recommendedMaterialSlugs: ["matte-armor", "burnt-metal"],
    visibilityWeight: 0.65,
    promptVersion: "p1.v1",
    seoKeywords: ["black mecha repaint", "stealth gunpla colors"],
    isActive: true,
    searchText: "Stealth Black tactical low signature sensor restraint",
  },
];

const colorRoles = [
  {
    name: "Primary Armor",
    slug: "primary-armor",
    description: "Dominant armor shell color.",
    visualWeight: "high",
    recommendedArea: "torso, shoulders, shield",
    sortOrder: 10,
    isCore: true,
  },
  {
    name: "Secondary Armor",
    slug: "secondary-armor",
    description: "Secondary armor block or support panel color.",
    visualWeight: "medium",
    recommendedArea: "limbs, calves, side skirts",
    sortOrder: 20,
    isCore: true,
  },
  {
    name: "Inner Frame",
    slug: "inner-frame",
    description: "Inner frame and exposed mechanical structure.",
    visualWeight: "medium",
    recommendedArea: "joints, vents, exposed mechanics",
    sortOrder: 30,
    isCore: true,
  },
  {
    name: "Accent",
    slug: "accent",
    description: "Controlled high-energy accent or warning zone.",
    visualWeight: "low",
    recommendedArea: "visor, chest vents, reactor zones",
    sortOrder: 40,
    isCore: true,
  },
  {
    name: "Markings",
    slug: "markings",
    description: "Decals, caution text, and technical striping.",
    visualWeight: "low",
    recommendedArea: "panel edges, caution zones, serial marks",
    sortOrder: 50,
    isCore: true,
  },
  {
    name: "Sensor Color",
    slug: "sensor-color",
    description: "Optics, mono-eyes, and sensor strips.",
    visualWeight: "low",
    recommendedArea: "eyes, cameras, beam sensor ports",
    sortOrder: 60,
    isCore: true,
  },
];

const paintMappings = [
  {
    mappingKey: "gaia-notes-nazca-frost-matte-white",
    brand: "Gaia Notes",
    line: "Nazca",
    code: "N-001",
    colorName: "Frost Matte White",
    finishType: "matte",
    paintType: "lacquer",
    availabilityRegion: "global",
    affiliateUrl: undefined,
    hexPreview: "#d9dde0",
    isActive: true,
    searchText: "Gaia Notes Nazca N-001 Frost Matte White matte",
  },
  {
    mappingKey: "gaia-notes-nazca-warning-orange",
    brand: "Gaia Notes",
    line: "Nazca",
    code: "N-014",
    colorName: "Warning Orange",
    finishType: "semi-gloss",
    paintType: "lacquer",
    availabilityRegion: "global",
    affiliateUrl: undefined,
    hexPreview: "#d97523",
    isActive: true,
    searchText: "Gaia Notes Nazca N-014 Warning Orange semi-gloss",
  },
  {
    mappingKey: "mr-color-super-iron",
    brand: "Mr. Color",
    line: "Super Metallic",
    code: "SM201",
    colorName: "Super Iron",
    finishType: "metallic",
    paintType: "lacquer",
    availabilityRegion: "global",
    affiliateUrl: undefined,
    hexPreview: "#646b73",
    isActive: true,
    searchText: "Mr. Color Super Metallic SM201 Super Iron metallic",
  },
  {
    mappingKey: "mr-color-dark-yellow",
    brand: "Mr. Color",
    line: "Lacquer",
    code: "C39",
    colorName: "Dark Yellow",
    finishType: "matte",
    paintType: "lacquer",
    availabilityRegion: "global",
    affiliateUrl: undefined,
    hexPreview: "#a38a45",
    isActive: true,
    searchText: "Mr. Color Lacquer C39 Dark Yellow matte",
  },
  {
    mappingKey: "tamiya-gun-metal-x10",
    brand: "Tamiya",
    line: "Acrylic",
    code: "X-10",
    colorName: "Gun Metal",
    finishType: "semi-gloss",
    paintType: "acrylic",
    availabilityRegion: "global",
    affiliateUrl: undefined,
    hexPreview: "#5a6068",
    isActive: true,
    searchText: "Tamiya Acrylic X-10 Gun Metal semi-gloss",
  },
];

const promptTemplates = [
  {
    name: "Palette Plan Template",
    slug: "palette-plan-template",
    kind: "palette-plan" as const,
    version: "p1.v1",
    systemPrompt:
      "Compose a spray-ready mecha palette plan using structured roles, realistic material separation, and hobby-builder logic.",
    userPromptTemplate:
      "Base model: {{baseModel}}\nStyle DNA: {{stylePreset}}\nMaterial Profile: {{materialPreset}}\nWeathering: {{weatheringLevel}}\nNotes: {{notes}}",
    negativePromptTemplate:
      "generic ai art, poster composition, floating characters, rainbow gradients, toy-like plastics",
    notePolicy: "Additional notes should stay under 100 characters and only refine details.",
    isActive: true,
  },
  {
    name: "Style Suggestion Template",
    slug: "style-suggestion-template",
    kind: "style-suggestion" as const,
    version: "p1.v1",
    systemPrompt:
      "Recommend the most defensible Style DNA presets for the selected mecha platform using mood, silhouette, and paintability logic.",
    userPromptTemplate:
      "Base model: {{baseModel}}\nMood Vector: {{mood}}\nOperator notes: {{notes}}\nAvailable Style DNA presets: {{availableStyles}}\nReturn the strongest matching presets in order of fit.",
    negativePromptTemplate:
      "generic ai art language, vague trend buzzwords, rainbow styling, cinematic poster bias",
    notePolicy: "Notes should refine intent, not replace the structured selector system.",
    isActive: true,
  },
  {
    name: "Repaint Concept Template",
    slug: "repaint-concept-template",
    kind: "repaint-concept" as const,
    version: "p1.v1",
    systemPrompt:
      "Generate a controlled repaint concept that feels physically paintable, masking-aware, and faithful to the selected mecha silhouette.",
    userPromptTemplate:
      "Base model: {{baseModel}}\nStyle DNA: {{stylePreset}}\nMaterial Profile: {{materialPreset}}\nWeathering: {{weatheringLevel}}\nPriority color roles: {{colorRoles}}\nNotes: {{notes}}",
    negativePromptTemplate:
      "anime poster, chaotic background, web3 glow, rainbow ui, generic ai generator look",
    notePolicy: "Notes are only for small directional hints, not open-ended prompt engineering.",
    isActive: true,
  },
  {
    name: "HD Render Template",
    slug: "hd-render-template",
    kind: "hd-render" as const,
    version: "p1.v1",
    systemPrompt:
      "Produce a premium preview render of the approved repaint plan while preserving panel logic and material realism.",
    userPromptTemplate:
      "Approved concept id: {{conceptId}}\nBase model: {{baseModel}}\nStyle DNA: {{stylePreset}}\nSelected materials: {{materialPreset}}\nMood Vector: {{mood}}\nWeathering: {{weatheringLevel}}\nPalette Lock: {{topPalette}}\nOperator notes: {{notes}}\nPreview output goal: HD render",
    negativePromptTemplate:
      "cinematic poster layout, floating debris overload, distorted proportions, uncontrolled extra weapons",
    notePolicy: "HD rendering is derived from approved concept selections only.",
    isActive: true,
  },
];

const creditPriceRules = [
  {
    actionType: "generate-palette" as const,
    label: "Generate Palette",
    generationKind: "palette-plan" as const,
    creditCost: 1,
    description: "Low-cost structured palette draft with color-role breakdown.",
    sortOrder: 10,
    isActive: true,
  },
  {
    actionType: "generate-style-suggestion" as const,
    label: "Generate Style Suggestion",
    generationKind: undefined,
    creditCost: 1,
    description: "Suggest a style DNA preset for the selected model and mood.",
    sortOrder: 20,
    isActive: true,
  },
  {
    actionType: "generate-repaint-concept" as const,
    label: "Generate Repaint Concept",
    generationKind: "palette-plan" as const,
    creditCost: 2,
    description: "Generate the main structured repaint concept preview.",
    sortOrder: 30,
    isActive: true,
  },
  {
    actionType: "generate-hd-render" as const,
    label: "HD Render",
    generationKind: "hd-preview" as const,
    creditCost: 5,
    description: "High-quality single-angle preview render.",
    sortOrder: 40,
    isActive: true,
  },
  {
    actionType: "generate-multi-angle-preview" as const,
    label: "Multi-angle Contact Sheet",
    generationKind: "hd-preview" as const,
    creditCost: 10,
    description: "Generate multiple preview angles for the approved scheme.",
    sortOrder: 50,
    isActive: true,
  },
  {
    actionType: "generate-high-fidelity-render" as const,
    label: "High-fidelity Render",
    generationKind: "hd-preview" as const,
    creditCost: 15,
    description: "Highest-cost premium concept visualization tier.",
    sortOrder: 60,
    isActive: true,
  },
];
