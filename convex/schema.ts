import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAssetKind,
  vAssetStatus,
  vConceptInteractionKind,
  vCreditActionType,
  vRecommendationFeedbackKind,
    vConceptStatus,
    vConceptVisibility,
    vFeedbackCategory,
    vFeedbackStatus,
    vGenerationProvider,
    vGenerationKind,
    vGenerationStatus,
    vMaterialSpec,
    vModelCatalogStatus,
    vMoodTag,
    vPaintFinishRenderPriority,
    vPromptCompositionStatus,
    vPromptTemplateKind,
    vRenderMode,
    vSimulationStage,
    vSpecPresetKind,
    vSpecPresetStatus,
    vSpecPresetTestStatus,
    vStyleSpec,
    vUserAccountStatus,
    vUserPlan,
    vWeatheringLevel,
} from "./domain";

const schema = defineSchema({
  users: defineTable({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.string(),
    pictureUrl: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    planType: vUserPlan,
    accountStatus: vUserAccountStatus,
    isAdmin: v.boolean(),
    email: v.string(),
    tokenIdentifier: v.string(),
    handle: v.string(),
    isVerifiedCreator: v.optional(v.boolean()),
    isFeaturedCreator: v.optional(v.boolean()),
    creatorTagline: v.optional(v.string()),
    creatorSpecialties: v.optional(v.array(v.string())),
  })
    .index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_handle", ["handle"]),

  ipSeries: defineTable({
    name: v.string(),
    slug: v.string(),
    universe: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    rightsOwner: v.optional(v.string()),
    visualDNA: v.optional(v.string()),
    promptAnchor: v.optional(v.string()),
    status: v.optional(vModelCatalogStatus),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  baseUnits: defineTable({
    ipSeriesId: v.id("ipSeries"),
    name: v.string(),
    slug: v.string(),
    unitCode: v.optional(v.string()),
    aliases: v.array(v.string()),
    silhouetteType: v.optional(v.string()),
    proportionDNA: v.optional(v.string()),
    armorDNA: v.optional(v.string()),
    keyShapeAnchors: v.array(v.string()),
    nativeEquipment: v.optional(v.array(v.string())),
    forbiddenChanges: v.array(v.string()),
    promptAnchor: v.optional(v.string()),
    searchText: v.string(),
    status: v.optional(vModelCatalogStatus),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_ipSeriesId", ["ipSeriesId"])
    .searchIndex("searchText", {
      searchField: "searchText",
    }),

  baseModels: defineTable({
    baseUnitId: v.optional(v.id("baseUnits")),
    name: v.string(),
    slug: v.string(),
    series: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    primaryModelBrand: v.optional(v.string()),
    grade: v.optional(v.string()),
    scale: v.optional(v.string()),
    releaseVersion: v.optional(v.string()),
    silhouetteType: v.optional(v.string()),
    complexityLevel: v.optional(v.string()),
    panelDensity: v.optional(v.string()),
    aliases: v.array(v.string()),
    tags: v.array(v.string()),
    thumbnailAssetKey: v.optional(v.string()),
    defaultMaterialPresetId: v.optional(v.id("materialPresets")),
    promptAnchor: v.optional(v.string()),
    status: v.optional(vModelCatalogStatus),
    isActive: v.boolean(),
    searchText: v.string(),
  })
    .index("by_slug", ["slug"])
    .searchIndex("searchText", {
      searchField: "searchText",
    }),

  stylePresets: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    promptKeywords: v.array(v.string()),
    negativeKeywords: v.array(v.string()),
    systemPromptFragment: v.optional(v.string()),
    styleSpec: v.optional(vStyleSpec),
    contrastLevel: v.optional(v.string()),
    weatheringProfile: v.optional(v.string()),
    recommendedMaterialSlugs: v.array(v.string()),
    visibilityWeight: v.optional(v.number()),
    promptVersion: v.optional(v.string()),
    seoKeywords: v.array(v.string()),
    creatorUserId: v.optional(v.id("users")),
    isFeaturedStyle: v.optional(v.boolean()),
    isActive: v.boolean(),
    searchText: v.string(),
  })
    .index("by_slug", ["slug"])
    .searchIndex("searchText", {
      searchField: "searchText",
    }),

  creatorPacks: defineTable({
    name: v.string(),
    slug: v.string(),
    creatorUserId: v.id("users"),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    stylePresetIds: v.array(v.id("stylePresets")),
    baseModelIds: v.array(v.id("baseModels")),
    materialPresetIds: v.array(v.id("materialPresets")),
    packType: v.union(v.literal("free"), v.literal("premium")),
    isFeatured: v.boolean(),
    isActive: v.boolean(),
    searchText: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_creatorUserId", ["creatorUserId"])
    .searchIndex("searchText", {
      searchField: "searchText",
    }),

  materialPresets: defineTable({
    name: v.string(),
    slug: v.string(),
    finishType: v.string(),
    reflectivityLevel: v.optional(v.string()),
    materialSpec: v.optional(vMaterialSpec),
    promptKeywords: v.array(v.string()),
    paintFinish: v.optional(v.string()),
    difficultyLevel: v.optional(v.string()),
    sheenLevel: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  specPresets: defineTable({
    kind: vSpecPresetKind,
    name: v.string(),
    slug: v.string(),
    status: vSpecPresetStatus,
    specJson: v.string(),
    renderBehaviorText: v.string(),
    testNotes: v.optional(v.string()),
    version: v.string(),
    changelog: v.optional(v.string()),
    testStatus: vSpecPresetTestStatus,
    renderPriority: v.optional(vPaintFinishRenderPriority),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByUserId: v.optional(v.id("users")),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_kind", ["kind"])
    .index("by_kind_status", ["kind", "status"])
    .index("by_kind_slug", ["kind", "slug"]),

  specTestRecords: defineTable({
    title: v.string(),
    testStatus: vSpecPresetTestStatus,
    compiledPrompt: v.string(),
    resultImageUrl: v.optional(v.string()),
    testNotes: v.optional(v.string()),
    baseModelId: v.optional(v.id("baseModels")),
    materialSpecId: v.optional(v.id("specPresets")),
    paintFinishSpecId: v.optional(v.id("specPresets")),
    weatheringSpecId: v.optional(v.id("specPresets")),
    styleSpecId: v.optional(v.id("specPresets")),
    identityLockId: v.optional(v.id("specPresets")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByUserId: v.optional(v.id("users")),
    updatedByUserId: v.optional(v.id("users")),
    appliedAt: v.optional(v.number()),
    appliedByUserId: v.optional(v.id("users")),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_testStatus", ["testStatus"]),

  colorRoles: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    visualWeight: v.optional(v.string()),
    recommendedArea: v.optional(v.string()),
    sortOrder: v.number(),
    isCore: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_sortOrder", ["sortOrder"]),

  paintMappings: defineTable({
    mappingKey: v.string(),
    brand: v.string(),
    line: v.optional(v.string()),
    code: v.string(),
    colorName: v.string(),
    finishType: v.optional(v.string()),
    paintType: v.optional(v.string()),
    availabilityRegion: v.optional(v.string()),
    affiliateUrl: v.optional(v.string()),
    hexPreview: v.optional(v.string()),
    isActive: v.boolean(),
    searchText: v.string(),
  })
    .index("by_mappingKey", ["mappingKey"])
    .searchIndex("searchText", {
      searchField: "searchText",
    }),

  creditAccounts: defineTable({
    userId: v.id("users"),
    balance: v.number(),
    lifetimeGranted: v.number(),
    lifetimeSpent: v.number(),
    lastCreditEventAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  creditTransactions: defineTable({
    userId: v.id("users"),
    actionType: vCreditActionType,
    delta: v.number(),
    creditAmount: v.number(),
    balanceAfter: v.number(),
    generationJobId: v.optional(v.id("generationJobs")),
    conceptId: v.optional(v.id("concepts")),
    referenceTable: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    description: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_user_actionType", ["userId", "actionType"]),

  creditPriceRules: defineTable({
    actionType: vCreditActionType,
    label: v.string(),
    generationKind: v.optional(vGenerationKind),
    creditCost: v.number(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  })
    .index("by_actionType", ["actionType"])
    .index("by_sortOrder", ["sortOrder"]),

  creditCampaigns: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    defaultCreditAmount: v.number(),
    maxRedemptions: v.optional(v.number()),
    perUserLimit: v.number(),
    totalRedemptions: v.number(),
    isActive: v.boolean(),
    createdByUserId: v.id("users"),
    lastGeneratedAt: v.optional(v.number()),
  })
    .index("by_isActive", ["isActive"])
    .index("by_createdByUserId", ["createdByUserId"])
    .index("by_time", ["startsAt", "endsAt"]),

  creditActivationCodes: defineTable({
    campaignId: v.id("creditCampaigns"),
    code: v.string(),
    normalizedCode: v.string(),
    creditAmount: v.number(),
    maxRedemptions: v.number(),
    redemptionCount: v.number(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    createdByUserId: v.id("users"),
    lastRedeemedAt: v.optional(v.number()),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_normalizedCode", ["normalizedCode"]),

  creditCodeRedemptions: defineTable({
    campaignId: v.id("creditCampaigns"),
    activationCodeId: v.id("creditActivationCodes"),
    userId: v.id("users"),
    creditTransactionId: v.id("creditTransactions"),
    creditAmount: v.number(),
    balanceAfter: v.number(),
    redeemedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"])
    .index("by_activationCodeId", ["activationCodeId"])
    .index("by_user_campaign", ["userId", "campaignId"])
    .index("by_user_code", ["userId", "activationCodeId"]),

  assets: defineTable({
    userId: v.id("users"),
    key: v.string(),
    bucket: v.string(),
    kind: vAssetKind,
    contentType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    publicUrl: v.optional(v.string()),
    etag: v.optional(v.string()),
    status: vAssetStatus,
  })
    .index("by_userId", ["userId"])
    .index("by_key", ["key"]),

  concepts: defineTable({
    userId: v.id("users"),
    title: v.string(),
    notes: v.optional(v.string()),
    baseModelId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: vWeatheringLevel,
    status: vConceptStatus,
    visibility: vConceptVisibility,
    previewAssetId: v.optional(v.id("assets")),
    sourceConceptId: v.optional(v.id("concepts")),
    generationJobId: v.optional(v.id("generationJobs")),
    searchText: v.string(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_visibility", ["userId", "visibility"])
    .index("by_visibility", ["visibility"])
    .index("by_sourceConceptId", ["sourceConceptId"])
    .searchIndex("searchText", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),

  conceptInteractions: defineTable({
    userId: v.id("users"),
    conceptId: v.id("concepts"),
    kind: vConceptInteractionKind,
  })
    .index("by_userId", ["userId"])
    .index("by_conceptId", ["conceptId"])
    .index("by_concept_kind", ["conceptId", "kind"])
    .index("by_user_concept_kind", ["userId", "conceptId", "kind"]),

  packInteractions: defineTable({
    userId: v.id("users"),
    creatorPackId: v.id("creatorPacks"),
    kind: vConceptInteractionKind,
  })
    .index("by_userId", ["userId"])
    .index("by_creatorPackId", ["creatorPackId"])
    .index("by_pack_kind", ["creatorPackId", "kind"])
    .index("by_user_pack_kind", ["userId", "creatorPackId", "kind"]),

  recommendationFeedback: defineTable({
    userId: v.id("users"),
    conceptId: v.id("concepts"),
    recommendationType: v.string(),
    recommendationValue: v.string(),
    kind: vRecommendationFeedbackKind,
  })
    .index("by_userId", ["userId"])
    .index("by_conceptId", ["conceptId"])
    .index("by_user_concept_recommendation", [
      "userId",
      "conceptId",
      "recommendationType",
      "recommendationValue",
    ]),

  promptTemplates: defineTable({
    name: v.string(),
    slug: v.string(),
    kind: vPromptTemplateKind,
    version: v.string(),
    systemPrompt: v.string(),
    userPromptTemplate: v.string(),
    negativePromptTemplate: v.optional(v.string()),
    notePolicy: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_kind", ["kind"]),

  promptCompositions: defineTable({
    userId: v.id("users"),
    conceptId: v.optional(v.id("concepts")),
    generationJobId: v.optional(v.id("generationJobs")),
    promptTemplateId: v.optional(v.id("promptTemplates")),
    status: vPromptCompositionStatus,
    composedPrompt: v.string(),
    negativePrompt: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    inputSnapshotJson: v.string(),
    outputSummaryJson: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_conceptId", ["conceptId"])
    .index("by_generationJobId", ["generationJobId"]),

  promptExperimentRuns: defineTable({
    userId: v.id("users"),
    promptTemplateId: v.optional(v.id("promptTemplates")),
    templateKind: vPromptTemplateKind,
    templateName: v.string(),
    templateVersion: v.string(),
    templateSnapshotJson: v.string(),
    inputSnapshotJson: v.string(),
    composedPrompt: v.string(),
    negativePrompt: v.optional(v.string()),
    source: v.union(v.literal("manual-web"), v.literal("api")),
    status: v.union(
      v.literal("ready-for-web"),
      v.literal("tested"),
      v.literal("selected"),
      v.literal("rejected"),
      v.literal("archived")
    ),
    providerLabel: v.optional(v.string()),
    modelLabel: v.optional(v.string()),
    vendorUrl: v.optional(v.string()),
    parameterNotes: v.optional(v.string()),
    outputImageUrl: v.optional(v.string()),
    outputNotes: v.optional(v.string()),
    failureTags: v.array(v.string()),
    styleHitScore: v.optional(v.number()),
    silhouetteScore: v.optional(v.number()),
    paintabilityScore: v.optional(v.number()),
    promptAdherenceScore: v.optional(v.number()),
    visualImpactScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    selectedAsWinner: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_templateKind", ["templateKind"]),

  generationJobs: defineTable({
    userId: v.id("users"),
    kind: vGenerationKind,
    status: vGenerationStatus,
    baseModelId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    conceptId: v.optional(v.id("concepts")),
    requestedCredits: v.number(),
    promptCompositionId: v.optional(v.id("promptCompositions")),
    provider: v.optional(vGenerationProvider),
    providerJobId: v.optional(v.string()),
    outputAssetId: v.optional(v.id("assets")),
    errorMessage: v.optional(v.string()),
    inputSnapshotJson: v.optional(v.string()),
    outputSummaryJson: v.optional(v.string()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_conceptId", ["conceptId"]),

  renderOutputs: defineTable({
    userId: v.id("users"),
    conceptId: v.id("concepts"),
    generationJobId: v.id("generationJobs"),
    assetId: v.id("assets"),
    renderMode: vRenderMode,
    simulationStage: v.optional(vSimulationStage),
    label: v.string(),
    status: v.union(v.literal("available"), v.literal("hidden")),
    summaryJson: v.optional(v.string()),
  })
    .index("by_user_concept", ["userId", "conceptId"])
    .index("by_conceptId", ["conceptId"])
    .index("by_generationJobId", ["generationJobId"])
    .index("by_assetId", ["assetId"]),

  feedbackReports: defineTable({
    userId: v.id("users"),
    category: vFeedbackCategory,
    status: vFeedbackStatus,
    message: v.string(),
    relatedGenerationJobId: v.optional(v.id("generationJobs")),
    relatedAssetId: v.optional(v.id("assets")),
    baseModelId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    conceptId: v.optional(v.id("concepts")),
    sourcePage: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"]),

  adminAuditLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    detailsJson: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  adminQueue: defineTable({
    itemType: v.union(
      v.literal("feedback"),
      v.literal("style-preset"),
      v.literal("material-preset"),
      v.literal("generation-failure")
    ),
    itemId: v.string(),
    priority: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("in-review"),
      v.literal("done")
    ),
    assignedToUserId: v.optional(v.id("users")),
    summary: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_itemType_itemId", ["itemType", "itemId"]),
});

export default schema;
