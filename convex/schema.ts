import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAssetKind,
  vAssetPublicationKind,
  vAssetPublicationStatus,
  vAssetRendition,
  vAssetStatus,
  vAssetVersionOrigin,
  vAssetVersionStatus,
  vConceptInteractionKind,
  vConceptStatus,
  vConceptVisibility,
  vCreditActionType,
  vEntitlementGrantSource,
  vFeedbackCategory,
  vFeedbackPriority,
  vFeedbackResolutionOutcome,
  vFeedbackRootCause,
  vFeedbackSource,
  vFeedbackStatus,
  vGenerationKind,
  vGenerationProvider,
  vGenerationStatus,
  vLlmApiFormat,
  vLlmCapability,
  vLlmProvider,
  vMaterialSpec,
  vMediaAssetKind,
  vMediaAssetStatus,
  vModelCatalogStatus,
  vMoodTag,
  vOrderItemType,
  vOrderStatus,
  vPaintFinishRenderPriority,
  vPipelineAction,
  vPromptCompositionStatus,
  vPromptTemplateKind,
  vPromptTemplateVersionStatus,
  vRecommendationFeedbackKind,
  vRenderMode,
  vSimulationStage,
  vSpecPresetKind,
  vSpecPresetStatus,
  vSpecPresetTestStatus,
  vStyleSpec,
  vStorageBucketRole,
  vStorageObjectStatus,
  vTemplateVersionPolicy,
  vSprayPlanStatus,
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
    searchText: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),
    hasOpenFlag: v.optional(v.boolean()),
    entitlementProfileId: v.optional(v.id("entitlementProfiles")),
  })
    .index("by_email", ["email"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_handle", ["handle"])
    .index("by_accountStatus", ["accountStatus"])
    .index("by_planType", ["planType"])
    .index("by_hasOpenFlag", ["hasOpenFlag"])
    .searchIndex("search_users", {
      searchField: "searchText",
      filterFields: ["accountStatus", "planType", "hasOpenFlag"],
    }),

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

  paintPurchaseSources: defineTable({
    paintMappingId: v.id("paintMappings"),
    sourceName: v.string(),
    sourceType: v.union(
      v.literal("amazon"),
      v.literal("official"),
      v.literal("local"),
      v.literal("other")
    ),
    region: v.optional(v.string()),
    url: v.string(),
    affiliate: v.boolean(),
    priceMinor: v.optional(v.number()),
    currency: v.optional(v.string()),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_paintMappingId", ["paintMappingId"])
    .index("by_sourceType", ["sourceType"]),

  paintBenchItems: defineTable({
    userId: v.id("users"),
    paintMappingId: v.id("paintMappings"),
    quantity: v.number(),
    containerSizeMl: v.optional(v.number()),
    status: v.union(
      v.literal("in-stock"),
      v.literal("low"),
      v.literal("empty"),
      v.literal("wishlist")
    ),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_paint", ["userId", "paintMappingId"]),

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
    orderId: v.optional(v.id("orders")),
    referenceTable: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    description: v.optional(v.string()),
    sourceType: v.optional(v.union(
      v.literal("purchased"),
      v.literal("promotional"),
      v.literal("admin-grant"),
      v.literal("admin-adjustment"),
      v.literal("refund"),
      v.literal("activation-code"),
      v.literal("generation-spend"),
      v.literal("starter")
    )),
    reasonCode: v.optional(v.string()),
    operatorUserId: v.optional(v.id("users")),
    campaignId: v.optional(v.id("creditCampaigns")),
    expiresAt: v.optional(v.number()),
    internalNote: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_user_actionType", ["userId", "actionType"]),

  orders: defineTable({
    userId: v.id("users"),
    orderNumber: v.string(),
    status: vOrderStatus,
    currency: v.string(),
    subtotalMinor: v.number(),
    totalMinor: v.number(),
    paymentProvider: v.optional(v.string()),
    externalPaymentId: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_orderNumber", ["orderNumber"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productType: vOrderItemType,
    referenceId: v.optional(v.string()),
    title: v.string(),
    quantity: v.number(),
    unitAmountMinor: v.number(),
    metadataJson: v.optional(v.string()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_productType", ["productType"]),

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

  entitlementProfiles: defineTable({
    name: v.string(),
    slug: v.string(),
    planType: vUserPlan,
    revision: v.number(),
    libraryQuotaBytes: v.number(),
    temporaryOriginalQuotaBytes: v.number(),
    pinnedOriginalQuotaBytes: v.number(),
    originalRetentionDays: v.number(),
    versionRetentionDays: v.number(),
    masterMaxDimensionPx: v.number(),
    exportMaxDimensionPx: v.number(),
    originalPermanentStorage: v.boolean(),
    originalDownloadAllowed: v.boolean(),
    originalPinAllowed: v.boolean(),
    batchDownloadAllowed: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_planType", ["planType"])
    .index("by_plan_revision", ["planType", "revision"]),

  accountEntitlementGrants: defineTable({
    userId: v.id("users"),
    sourceType: vEntitlementGrantSource,
    sourceReference: v.optional(v.string()),
    libraryQuotaBytesDelta: v.optional(v.number()),
    temporaryOriginalQuotaBytesDelta: v.optional(v.number()),
    pinnedOriginalQuotaBytesDelta: v.optional(v.number()),
    originalRetentionDays: v.optional(v.number()),
    versionRetentionDays: v.optional(v.number()),
    masterMaxDimensionPx: v.optional(v.number()),
    exportMaxDimensionPx: v.optional(v.number()),
    originalPermanentStorage: v.optional(v.boolean()),
    originalDownloadAllowed: v.optional(v.boolean()),
    originalPinAllowed: v.optional(v.boolean()),
    batchDownloadAllowed: v.optional(v.boolean()),
    startsAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    note: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_startsAt", ["userId", "startsAt"])
    .index("by_source", ["sourceType", "sourceReference"]),

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
    mediaAssetId: v.optional(v.id("mediaAssets")),
    assetVersionId: v.optional(v.id("assetVersions")),
    storageObjectId: v.optional(v.id("storageObjects")),
  })
    .index("by_userId", ["userId"])
    .index("by_key", ["key"])
    .index("by_mediaAssetId", ["mediaAssetId"])
    .index("by_assetVersionId", ["assetVersionId"])
    .index("by_storageObjectId", ["storageObjectId"]),

  mediaAssets: defineTable({
    userId: v.id("users"),
    kind: vMediaAssetKind,
    conceptId: v.optional(v.id("concepts")),
    title: v.optional(v.string()),
    currentVersionId: v.optional(v.id("assetVersions")),
    status: vMediaAssetStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_conceptId", ["conceptId"])
    .index("by_concept_status", ["conceptId", "status"]),

  assetVersions: defineTable({
    mediaAssetId: v.id("mediaAssets"),
    userId: v.id("users"),
    version: v.number(),
    parentVersionId: v.optional(v.id("assetVersions")),
    generationJobId: v.optional(v.id("generationJobs")),
    origin: vAssetVersionOrigin,
    status: vAssetVersionStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mediaAssetId", ["mediaAssetId"])
    .index("by_media_version", ["mediaAssetId", "version"])
    .index("by_userId", ["userId"])
    .index("by_generationJobId", ["generationJobId"]),

  storageObjects: defineTable({
    mediaAssetId: v.id("mediaAssets"),
    assetVersionId: v.id("assetVersions"),
    userId: v.id("users"),
    legacyAssetId: v.optional(v.id("assets")),
    publicationId: v.optional(v.id("assetPublications")),
    bucketRole: vStorageBucketRole,
    bucket: v.string(),
    key: v.string(),
    rendition: vAssetRendition,
    contentType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    checksum: v.optional(v.string()),
    etag: v.optional(v.string()),
    publicUrl: v.optional(v.string()),
    status: vStorageObjectStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_assetVersionId", ["assetVersionId"])
    .index("by_version_rendition", ["assetVersionId", "rendition"])
    .index("by_version_role_rendition", ["assetVersionId", "bucketRole", "rendition"])
    .index("by_legacyAssetId", ["legacyAssetId"])
    .index("by_publicationId", ["publicationId"])
    .index("by_bucket_key", ["bucket", "key"])
    .index("by_status", ["status"]),

  assetPublications: defineTable({
    mediaAssetId: v.id("mediaAssets"),
    assetVersionId: v.id("assetVersions"),
    userId: v.id("users"),
    conceptId: v.optional(v.id("concepts")),
    kind: vAssetPublicationKind,
    visibility: v.union(v.literal("public"), v.literal("unlisted")),
    status: vAssetPublicationStatus,
    publicPrefix: v.string(),
    publishedAt: v.optional(v.number()),
    withdrawnAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mediaAssetId", ["mediaAssetId"])
    .index("by_assetVersionId", ["assetVersionId"])
    .index("by_conceptId", ["conceptId"])
    .index("by_concept_status", ["conceptId", "status"])
    .index("by_kind_status", ["kind", "status"]),

  archiveCounters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  concepts: defineTable({
    userId: v.id("users"),
    recordNumber: v.optional(v.number()),
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
    mediaAssetId: v.optional(v.id("mediaAssets")),
    currentAssetVersionId: v.optional(v.id("assetVersions")),
    activePublicationId: v.optional(v.id("assetPublications")),
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

  sprayPlans: defineTable({
    userId: v.id("users"),
    conceptId: v.id("concepts"),
    title: v.string(),
    status: vSprayPlanStatus,
    currentVersion: v.number(),
    currentVersionId: v.optional(v.id("sprayPlanVersions")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_concept", ["userId", "conceptId"])
    .index("by_conceptId", ["conceptId"]),

  sprayPlanVersions: defineTable({
    sprayPlanId: v.id("sprayPlans"),
    userId: v.id("users"),
    version: v.number(),
    sourceConceptId: v.id("concepts"),
    sourceConceptCreatedAt: v.number(),
    planSnapshotJson: v.string(),
    changeNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_sprayPlanId", ["sprayPlanId"])
    .index("by_userId", ["userId"])
    .index("by_plan_version", ["sprayPlanId", "version"]),

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
    publishedVersionId: v.optional(v.id("promptTemplateVersions")),
    updatedAt: v.optional(v.number()),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_kind", ["kind"]),

  promptTemplateVersions: defineTable({
    promptTemplateId: v.id("promptTemplates"),
    version: v.string(),
    status: vPromptTemplateVersionStatus,
    systemPrompt: v.string(),
    userPromptTemplate: v.string(),
    negativePromptTemplate: v.optional(v.string()),
    notePolicy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    createdByUserId: v.optional(v.id("users")),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_template", ["promptTemplateId"])
    .index("by_template_status", ["promptTemplateId", "status"]),

  llmProfiles: defineTable({
    name: v.string(),
    slug: v.string(),
    provider: vLlmProvider,
    capability: vLlmCapability,
    apiFormat: vLlmApiFormat,
    baseUrl: v.string(),
    keyEnvName: v.string(),
    modelId: v.string(),
    headersJson: v.optional(v.string()),
    requestDefaultsJson: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
    priority: v.number(),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_provider", ["provider"])
    .index("by_capability", ["capability"]),

  promptTemplateBindings: defineTable({
    promptTemplateId: v.id("promptTemplates"),
    templateKind: vPromptTemplateKind,
    llmProfileId: v.id("llmProfiles"),
    generationKind: v.optional(vGenerationKind),
    renderMode: v.optional(vRenderMode),
    parameterOverridesJson: v.optional(v.string()),
    priority: v.number(),
    notes: v.optional(v.string()),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_template", ["promptTemplateId"])
    .index("by_templateKind", ["templateKind"])
    .index("by_profile", ["llmProfileId"]),

  pipelineTemplateBindings: defineTable({
    action: vPipelineAction,
    promptTemplateId: v.id("promptTemplates"),
    versionPolicy: vTemplateVersionPolicy,
    promptTemplateVersionId: v.optional(v.id("promptTemplateVersions")),
    fallbackPromptTemplateId: v.optional(v.id("promptTemplates")),
    effectiveFrom: v.number(),
    isActive: v.boolean(),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_action", ["action"])
    .index("by_template", ["promptTemplateId"]),

  generationProviderRoutes: defineTable({
    action: vPipelineAction,
    primaryProfileId: v.id("llmProfiles"),
    fallbackProfileId: v.optional(v.id("llmProfiles")),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_action", ["action"])
    .index("by_primaryProfile", ["primaryProfileId"]),

  platformSettings: defineTable({
    key: v.string(),
    valueJson: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  promptCompositions: defineTable({
    userId: v.id("users"),
    conceptId: v.optional(v.id("concepts")),
    generationJobId: v.optional(v.id("generationJobs")),
    promptTemplateId: v.optional(v.id("promptTemplates")),
    promptTemplateVersionId: v.optional(v.id("promptTemplateVersions")),
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
    .index("by_generationJobId", ["generationJobId"])
    .index("by_promptTemplateId", ["promptTemplateId"])
    .index("by_promptTemplateVersionId", ["promptTemplateVersionId"]),

  promptExperimentRuns: defineTable({
    userId: v.id("users"),
    promptTemplateId: v.optional(v.id("promptTemplates")),
    promptTemplateVersionId: v.optional(v.id("promptTemplateVersions")),
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
    .index("by_templateKind", ["templateKind"])
    .index("by_promptTemplateId", ["promptTemplateId"])
    .index("by_promptTemplateVersionId", ["promptTemplateVersionId"]),

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
    outputMediaAssetId: v.optional(v.id("mediaAssets")),
    outputAssetVersionId: v.optional(v.id("assetVersions")),
    errorMessage: v.optional(v.string()),
    inputSnapshotJson: v.optional(v.string()),
    outputSummaryJson: v.optional(v.string()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_conceptId", ["conceptId"])
    .index("by_outputAssetId", ["outputAssetId"])
    .index("by_outputMediaAssetId", ["outputMediaAssetId"])
    .index("by_promptCompositionId", ["promptCompositionId"]),

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
    recordNumber: v.optional(v.number()),
    category: vFeedbackCategory,
    status: vFeedbackStatus,
    title: v.optional(v.string()),
    message: v.string(),
    priority: v.optional(vFeedbackPriority),
    source: v.optional(vFeedbackSource),
    relatedGenerationJobId: v.optional(v.id("generationJobs")),
    relatedAssetId: v.optional(v.id("assets")),
    baseModelId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    conceptId: v.optional(v.id("concepts")),
    sourcePage: v.optional(v.string()),
    contextSnapshotJson: v.optional(v.string()),
    rootCause: v.optional(vFeedbackRootCause),
    resolutionOutcome: v.optional(vFeedbackResolutionOutcome),
    assigneeUserId: v.optional(v.id("users")),
    internalNote: v.optional(v.string()),
    userResponseDraft: v.optional(v.string()),
    userResponse: v.optional(v.string()),
    responseSentAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    resolutionExperimentRunId: v.optional(v.id("promptExperimentRuns")),
    // Legacy only. Never return this field to the user-facing queries.
    adminNotes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"])
    .index("by_assignee", ["assigneeUserId"]),

  userActivityEvents: defineTable({
    userId: v.id("users"),
    eventType: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    summary: v.string(),
    metadataJson: v.optional(v.string()),
    occurredAt: v.number(),
    idempotencyKey: v.optional(v.string()),
  })
    .index("by_user_occurredAt", ["userId", "occurredAt"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  userAdminNotes: defineTable({
    userId: v.id("users"),
    authorUserId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_author", ["authorUserId"]),

  userFlags: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("open"), v.literal("resolved")),
    severity: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    reason: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    createdByUserId: v.id("users"),
    resolvedAt: v.optional(v.number()),
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
