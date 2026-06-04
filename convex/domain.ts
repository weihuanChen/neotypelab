import { Infer, v } from "convex/values";

export const vWeatheringLevel = v.union(
  v.literal("clean"),
  v.literal("light"),
  v.literal("heavy")
);
export type WeatheringLevel = Infer<typeof vWeatheringLevel>;

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
  v.literal("triaged"),
  v.literal("resolved")
);
export type FeedbackStatus = Infer<typeof vFeedbackStatus>;

export const vGenerationProvider = v.union(
  v.literal("internal"),
  v.literal("openai"),
  v.literal("replicate"),
  v.literal("fal"),
  v.literal("manual")
);
export type GenerationProvider = Infer<typeof vGenerationProvider>;

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
