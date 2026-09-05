import { Infer, v } from "convex/values";

export const vWeatheringLevel = v.union(
  v.literal("clean"),
  v.literal("light"),
  v.literal("heavy")
);
export type WeatheringLevel = Infer<typeof vWeatheringLevel>;

export const vMaterialSpec = v.object({
  reflectivity: v.string(),
  roughness: v.string(),
  surfaceTexture: v.string(),
  metallicResponse: v.string(),
  coatingBehavior: v.string(),
  clearCoatBehavior: v.optional(v.string()),
  edgeWearBehavior: v.optional(v.string()),
  weatheringInteraction: v.optional(v.string()),
  allowedColorRoleSlugs: v.array(v.string()),
  forbiddenColorRoleSlugs: v.array(v.string()),
  renderBehavior: v.string(),
  semanticTags: v.optional(
    v.object({
      materialFamily: v.optional(v.string()),
      surface: v.array(v.string()),
      optics: v.array(v.string()),
      reflection: v.array(v.string()),
      exclusions: v.array(v.string()),
    })
  ),
});
export type MaterialSpec = Infer<typeof vMaterialSpec>;

export const vPaintFinishSpec = v.object({
  finishType: v.string(),
  glossLevel: v.number(),
  specularStrength: v.number(),
  surfaceSheen: v.string(),
  clearCoatBehavior: v.optional(v.string()),
  weatheringInteraction: v.optional(v.string()),
  renderBehaviorText: v.string(),
});
export type PaintFinishSpec = Infer<typeof vPaintFinishSpec>;

export const vPaintFinishRenderPriority = v.object({
  matte: v.number(),
  semiGloss: v.number(),
  gloss: v.number(),
});
export type PaintFinishRenderPriority = Infer<typeof vPaintFinishRenderPriority>;

export const vStyleSpec = v.object({
  colorRelationship: v.string(),
  decalStyle: v.string(),
  markingDensity: v.string(),
  warningMarkingBehavior: v.string(),
  tone: v.string(),
  contrastBehavior: v.string(),
  personalityTags: v.array(v.string()),
  prohibitedEffects: v.array(v.string()),
  identityBoundary: v.string(),
  renderBehavior: v.string(),
  semanticTags: v.optional(
    v.object({
      styleFamily: v.optional(v.string()),
      shapeLanguage: v.array(v.string()),
      visualTone: v.array(v.string()),
      surfaceLanguage: v.array(v.string()),
      visualExclusions: v.array(v.string()),
    })
  ),
});
export type StyleSpec = Infer<typeof vStyleSpec>;

export const vWeatheringSpec = v.object({
  level: vWeatheringLevel,
  edgeWear: v.string(),
  dustAccumulation: v.string(),
  paintChipping: v.string(),
  staining: v.string(),
  panelLineEmphasis: v.string(),
  intensityCap: v.string(),
  colorReadabilityRule: v.string(),
  renderBehavior: v.string(),
});
export type WeatheringSpec = Infer<typeof vWeatheringSpec>;

export const vSpecPresetKind = v.union(
  v.literal("material"),
  v.literal("paint-finish"),
  v.literal("style"),
  v.literal("weathering"),
  v.literal("identity-lock")
);
export type SpecPresetKind = Infer<typeof vSpecPresetKind>;

export const vSpecPresetStatus = v.union(
  v.literal("draft"),
  v.literal("active")
);
export type SpecPresetStatus = Infer<typeof vSpecPresetStatus>;

export const vSpecPresetTestStatus = v.union(
  v.literal("untested"),
  v.literal("testing"),
  v.literal("passed"),
  v.literal("failed")
);
export type SpecPresetTestStatus = Infer<typeof vSpecPresetTestStatus>;

export const vUserPlan = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("studio")
);
export type UserPlan = Infer<typeof vUserPlan>;

export const vUserAccountStatus = v.union(
  v.literal("active"),
  v.literal("suspended")
);
export type UserAccountStatus = Infer<typeof vUserAccountStatus>;

export const vConceptStatus = v.union(
  v.literal("draft"),
  v.literal("generated"),
  v.literal("archived")
);
export type ConceptStatus = Infer<typeof vConceptStatus>;

export const vModelCatalogStatus = v.union(
  v.literal("active"),
  v.literal("prerelease"),
  v.literal("archived")
);
export type ModelCatalogStatus = Infer<typeof vModelCatalogStatus>;

export const vConceptVisibility = v.union(
  v.literal("private"),
  v.literal("unlisted"),
  v.literal("public")
);
export type ConceptVisibility = Infer<typeof vConceptVisibility>;

export const vConceptInteractionKind = v.union(
  v.literal("like"),
  v.literal("save")
);
export type ConceptInteractionKind = Infer<typeof vConceptInteractionKind>;

export const vRecommendationFeedbackKind = v.union(
  v.literal("helpful"),
  v.literal("not-helpful"),
  v.literal("try")
);
export type RecommendationFeedbackKind = Infer<typeof vRecommendationFeedbackKind>;

export const vMoodTag = v.union(
  v.literal("command-presence"),
  v.literal("stealth-tension"),
  v.literal("industrial-hazard"),
  v.literal("reactor-glow"),
  v.literal("field-fatigue"),
  v.literal("ceremonial-clean")
);
export type MoodTag = Infer<typeof vMoodTag>;

export const vGenerationKind = v.union(
  v.literal("palette-plan"),
  v.literal("hd-preview")
);
export type GenerationKind = Infer<typeof vGenerationKind>;

export const vRenderMode = v.union(
  v.literal("hd-render"),
  v.literal("multi-angle-preview"),
  v.literal("high-fidelity-render"),
  v.literal("build-stage-visualization"),
  v.literal("weathering-simulation"),
  v.literal("weathering-split-preview"),
  v.literal("material-finish-comparison")
);
export type RenderMode = Infer<typeof vRenderMode>;

export const vSimulationStage = v.union(
  v.literal("primer-pass"),
  v.literal("decal-pass"),
  v.literal("weathering-pass")
);
export type SimulationStage = Infer<typeof vSimulationStage>;

export const vGenerationStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled")
);
export type GenerationStatus = Infer<typeof vGenerationStatus>;

export const vPromptTemplateKind = v.union(
  v.literal("palette-plan"),
  v.literal("style-suggestion"),
  v.literal("repaint-concept"),
  v.literal("hd-render")
);
export type PromptTemplateKind = Infer<typeof vPromptTemplateKind>;

export const vPipelineAction = v.union(
  v.literal("repaint-concept"),
  v.literal("hd-render"),
  v.literal("palette-plan"),
  v.literal("style-suggestion")
);
export type PipelineAction = Infer<typeof vPipelineAction>;

export const vTemplateVersionPolicy = v.union(
  v.literal("follow-published"),
  v.literal("pin-version")
);
export type TemplateVersionPolicy = Infer<typeof vTemplateVersionPolicy>;

export const vPromptTemplateVersionStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);
export type PromptTemplateVersionStatus = Infer<typeof vPromptTemplateVersionStatus>;

export const vPromptCompositionStatus = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("consumed"),
  v.literal("failed")
);
export type PromptCompositionStatus = Infer<typeof vPromptCompositionStatus>;

export const vCreditActionType = v.union(
  v.literal("starter-grant"),
  v.literal("generate-palette"),
  v.literal("generate-style-suggestion"),
  v.literal("generate-repaint-concept"),
  v.literal("generate-hd-render"),
  v.literal("generate-multi-angle-preview"),
  v.literal("generate-high-fidelity-render"),
  v.literal("generation-refund"),
  v.literal("campaign-code-redemption"),
  v.literal("admin-adjustment")
);
export type CreditActionType = Infer<typeof vCreditActionType>;

export const vOrderStatus = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("completed"),
  v.literal("canceled"),
  v.literal("refunded")
);
export type OrderStatus = Infer<typeof vOrderStatus>;

export const vOrderItemType = v.union(
  v.literal("credit-pack"),
  v.literal("spray-plan-export"),
  v.literal("paint"),
  v.literal("service")
);
export type OrderItemType = Infer<typeof vOrderItemType>;

export const vSprayPlanStatus = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("archived")
);
export type SprayPlanStatus = Infer<typeof vSprayPlanStatus>;

export const vFeedbackCategory = v.union(
  v.literal("missing-base-model"),
  v.literal("style-request"),
  v.literal("generation-quality"),
  v.literal("paint-mapping"),
  v.literal("other")
);
export type FeedbackCategory = Infer<typeof vFeedbackCategory>;

export const vFeedbackStatus = v.union(
  v.literal("open"),
  v.literal("reviewing"),
  // Retained while existing records are migrated to "reviewing".
  v.literal("triaged"),
  v.literal("resolved"),
  v.literal("rejected")
);
export type FeedbackStatus = Infer<typeof vFeedbackStatus>;

export const vFeedbackPriority = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high")
);
export type FeedbackPriority = Infer<typeof vFeedbackPriority>;

export const vFeedbackSource = v.union(
  v.literal("prototype"),
  v.literal("generation-result"),
  v.literal("standalone"),
  v.literal("showcase"),
  v.literal("library")
);
export type FeedbackSource = Infer<typeof vFeedbackSource>;

export const vFeedbackRootCause = v.union(
  v.literal("prompt"),
  v.literal("style-dna"),
  v.literal("material-preset"),
  v.literal("model-kit"),
  v.literal("generation-provider"),
  v.literal("user-configuration"),
  v.literal("unknown")
);
export type FeedbackRootCause = Infer<typeof vFeedbackRootCause>;

export const vFeedbackResolutionOutcome = v.union(
  v.literal("fixed"),
  v.literal("planned"),
  v.literal("unable-to-reproduce"),
  v.literal("no-action"),
  v.literal("duplicate"),
  v.literal("unsupported")
);
export type FeedbackResolutionOutcome = Infer<typeof vFeedbackResolutionOutcome>;

export const vGenerationProvider = v.union(
  v.literal("internal"),
  v.literal("openai"),
  v.literal("openrouter"),
  v.literal("portkey"),
  v.literal("litellm"),
  v.literal("vercel-ai-gateway"),
  v.literal("custom-openai-compatible"),
  v.literal("replicate"),
  v.literal("fal"),
  v.literal("manual")
);
export type GenerationProvider = Infer<typeof vGenerationProvider>;

export const vLlmProvider = v.union(
  v.literal("openai"),
  v.literal("openrouter"),
  v.literal("portkey"),
  v.literal("litellm"),
  v.literal("vercel-ai-gateway"),
  v.literal("custom-openai-compatible")
);
export type LlmProvider = Infer<typeof vLlmProvider>;

export const vLlmCapability = v.union(
  v.literal("text"),
  v.literal("image"),
  v.literal("vision"),
  v.literal("embedding")
);
export type LlmCapability = Infer<typeof vLlmCapability>;

export const vLlmApiFormat = v.union(v.literal("openai-compatible"));
export type LlmApiFormat = Infer<typeof vLlmApiFormat>;

export const vAssetKind = v.union(
  v.literal("preview"),
  v.literal("reference"),
  v.literal("mask"),
  v.literal("export"),
  v.literal("source")
);
export type AssetKind = Infer<typeof vAssetKind>;

export const vAssetStatus = v.union(
  v.literal("active"),
  v.literal("deleted")
);
export type AssetStatus = Infer<typeof vAssetStatus>;

export const vMediaAssetKind = v.union(
  v.literal("generated-image"),
  v.literal("reference-image"),
  v.literal("feedback-screenshot"),
  v.literal("mask"),
  v.literal("export")
);
export type MediaAssetKind = Infer<typeof vMediaAssetKind>;

export const vMediaAssetStatus = v.union(
  v.literal("active"),
  v.literal("deleted")
);
export type MediaAssetStatus = Infer<typeof vMediaAssetStatus>;

export const vAssetVersionOrigin = v.union(
  v.literal("generated"),
  v.literal("uploaded"),
  v.literal("edited"),
  v.literal("upscaled"),
  v.literal("imported"),
  v.literal("migrated")
);
export type AssetVersionOrigin = Infer<typeof vAssetVersionOrigin>;

export const vAssetVersionStatus = v.union(
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("deleted")
);
export type AssetVersionStatus = Infer<typeof vAssetVersionStatus>;

export const vStorageBucketRole = v.union(
  v.literal("public"),
  v.literal("private"),
  v.literal("convex")
);
export type StorageBucketRole = Infer<typeof vStorageBucketRole>;

export const vAssetRendition = v.union(
  v.literal("original"),
  v.literal("master"),
  v.literal("preview"),
  v.literal("thumbnail"),
  v.literal("source"),
  v.literal("mask"),
  v.literal("export")
);
export type AssetRendition = Infer<typeof vAssetRendition>;

export const vStorageObjectStatus = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("deleting"),
  v.literal("deleted"),
  v.literal("failed")
);
export type StorageObjectStatus = Infer<typeof vStorageObjectStatus>;

export const vStorageAccountingCategory = v.union(
  v.literal("optimized"),
  v.literal("temporary-original"),
  v.literal("pinned-original"),
  v.literal("unmetered")
);
export type StorageAccountingCategory = Infer<typeof vStorageAccountingCategory>;

export const vStorageReservationStatus = v.union(
  v.literal("held"),
  v.literal("settled"),
  v.literal("released")
);
export type StorageReservationStatus = Infer<typeof vStorageReservationStatus>;

export const vStorageRetentionPolicy = v.union(
  v.literal("temporary-original"),
  v.literal("permanent-original"),
  v.literal("current-version"),
  v.literal("version-history"),
  v.literal("publication"),
  v.literal("unmanaged")
);
export type StorageRetentionPolicy = Infer<typeof vStorageRetentionPolicy>;

export const vStorageOrphanStatus = v.union(
  v.literal("detected"),
  v.literal("resolved")
);
export type StorageOrphanStatus = Infer<typeof vStorageOrphanStatus>;

export const vAssetPublicationKind = v.union(
  v.literal("showcase"),
  v.literal("template"),
  v.literal("static")
);
export type AssetPublicationKind = Infer<typeof vAssetPublicationKind>;

export const vAssetPublicationStatus = v.union(
  v.literal("publishing"),
  v.literal("published"),
  v.literal("withdrawing"),
  v.literal("failed"),
  v.literal("withdrawn")
);
export type AssetPublicationStatus = Infer<typeof vAssetPublicationStatus>;

export const vEntitlementGrantSource = v.union(
  v.literal("subscription"),
  v.literal("promotion"),
  v.literal("feedback"),
  v.literal("manual"),
  v.literal("early-adopter")
);
export type EntitlementGrantSource = Infer<typeof vEntitlementGrantSource>;
