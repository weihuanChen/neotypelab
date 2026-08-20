import { v } from "convex/values";
import { canManagePlatform, isSuperAdminEmail, requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { summarizeBaseModelWithHierarchy } from "./baseModelHierarchy";
import { buildPaintPlan } from "./paintMappingEngine";
import { buildOptionalModelPromptContext } from "./modelPromptContext";
import { Doc, Id } from "./_generated/dataModel";
import {
  CreditActionType,
  GenerationKind,
  LlmApiFormat,
  LlmCapability,
  LlmProvider,
  MoodTag,
  PromptTemplateKind,
  RenderMode,
  UserAccountStatus,
  UserPlan,
  vCreditActionType,
  vFeedbackPriority,
  vFeedbackResolutionOutcome,
  vFeedbackRootCause,
  vFeedbackStatus,
  vGenerationKind,
  vLlmApiFormat,
  vLlmCapability,
  vLlmProvider,
  vMaterialSpec,
  vModelCatalogStatus,
  vMoodTag,
  vPromptTemplateKind,
  vRenderMode,
  vStyleSpec,
  vUserAccountStatus,
  vUserPlan,
  vWeatheringLevel,
} from "./domain";
import { mutation, query } from "./functions";
import { MutationCtx, QueryCtx } from "./types";
import { normalizeStringForSearch, slugify } from "./utils";
import { getCreatorPackEngagementSnapshot } from "./packEngagement";
import {
  promptTemplateVariableDefinitions,
} from "./promptTemplateVariables";

export const overview = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [
      users,
      creditAccounts,
      baseModels,
      stylePresets,
      materialPresets,
      promptTemplates,
      feedbackReports,
      generationJobs,
      queueItems,
      auditLogs,
      orders,
      paintMappings,
      creatorPacks,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("creditAccounts").collect(),
      ctx.db.query("baseModels").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("promptTemplates").collect(),
      ctx.db.query("feedbackReports").collect(),
      ctx.db.query("generationJobs").collect(),
      ctx.db.query("adminQueue").withIndex("by_priority").order("asc").take(10),
      ctx.db.query("adminAuditLogs").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("paintMappings").collect(),
      ctx.db.query("creatorPacks").collect(),
    ]);

    const recentFailedJobs = generationJobs
      .filter((job) => job.status === "failed")
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 6);
    const recentAudit = auditLogs
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 8);

    return {
      userCount: users.length,
      adminCount: users.filter((user) => canManagePlatform(user)).length,
      superAdminCount: users.filter((user) => isSuperAdminEmail(user.email)).length,
      totalCreditBalance: creditAccounts.reduce((sum, account) => sum + account.balance, 0),
      baseModelCount: baseModels.length,
      stylePresetCount: stylePresets.length,
      materialPresetCount: materialPresets.length,
      promptTemplateCount: promptTemplates.length,
      activePromptTemplateCount: promptTemplates.filter((item) => item.isActive).length,
      openFeedbackCount: feedbackReports.filter((item) => item.status === "open").length,
      queuedGenerationCount: generationJobs.filter((item) => item.status === "queued").length,
      failedGenerationCount: generationJobs.filter((item) => item.status === "failed").length,
      generationJobCount: generationJobs.length,
      orderCount: orders.length,
      auditLogCount: auditLogs.length,
      paintMappingCount: paintMappings.length,
      creatorPackCount: creatorPacks.length,
      queueItems,
      recentFailedJobs: recentFailedJobs.map((job) => ({
        _id: job._id,
        conceptId: job.conceptId,
        provider: job.provider,
        errorMessage: job.errorMessage,
        _creationTime: job._creationTime,
      })),
      recentAudit,
    };
  },
});

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
  },
  async handler(ctx, { search }) {
    requireSuperAdmin(ctx);

    const normalizedSearch = normalizeAdminSearch(search);
    const [users, creditAccounts] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("creditAccounts").collect(),
    ]);

    const accountByUserId = new Map(creditAccounts.map((account) => [account.userId, account]));

    return users
      .filter((user) => {
        if (!normalizedSearch) {
          return true;
        }
        const haystack = normalizeAdminSearch(
          [user.fullName, user.email, user.handle].filter(Boolean).join(" ")
        );
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((user) => {
        const credits = accountByUserId.get(user._id);
        const isSuperAdmin = isSuperAdminEmail(user.email);

        return {
          _id: user._id,
          _creationTime: user._creationTime,
          fullName: user.fullName,
          email: user.email,
          handle: user.handle,
          planType: user.planType,
          accountStatus: user.accountStatus,
          isAdmin: user.isAdmin,
          isVerifiedCreator: user.isVerifiedCreator ?? false,
          isFeaturedCreator: user.isFeaturedCreator ?? false,
          creatorTagline: user.creatorTagline ?? "",
          creatorSpecialties: user.creatorSpecialties ?? [],
          isSuperAdmin,
          canManagePlatform: user.isAdmin || isSuperAdmin,
          credits: {
            balance: credits?.balance ?? 0,
            lifetimeGranted: credits?.lifetimeGranted ?? 0,
            lifetimeSpent: credits?.lifetimeSpent ?? 0,
            lastCreditEventAt: credits?.lastCreditEventAt ?? null,
          },
        };
      });
  },
});

export const listPromptTemplates = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [templates, versions] = await Promise.all([
      ctx.db.query("promptTemplates").collect(),
      ctx.db.query("promptTemplateVersions").collect(),
    ]);

    return templates
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
      .map((template) => ({
        _id: template._id,
        _creationTime: template._creationTime,
        name: template.name,
        slug: template.slug,
        kind: template.kind,
        version: template.version,
        systemPrompt: template.systemPrompt,
        userPromptTemplate: template.userPromptTemplate,
        negativePromptTemplate: template.negativePromptTemplate,
        notePolicy: template.notePolicy,
        isActive: template.isActive,
        versions: versions
          .filter((version) => version.promptTemplateId === template._id)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((version) => ({
            _id: version._id,
            version: version.version,
            status: version.status,
            updatedAt: version.updatedAt,
          })),
      }));
  },
});

export const listPromptTemplateWorkspace = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [templates, versions, bindings, profiles, compositions, jobs, experimentRuns] =
      await Promise.all([
        ctx.db.query("promptTemplates").collect(),
        ctx.db.query("promptTemplateVersions").collect(),
        ctx.db.query("promptTemplateBindings").collect(),
        ctx.db.query("llmProfiles").collect(),
        ctx.db.query("promptCompositions").collect(),
        ctx.db.query("generationJobs").collect(),
        ctx.db.query("promptExperimentRuns").collect(),
      ]);
    const now = Date.now();
    const profileById = new Map(profiles.map((profile) => [profile._id, profile]));
    const jobByCompositionId = new Map(
      jobs
        .filter((job) => job.promptCompositionId !== undefined)
        .map((job) => [job.promptCompositionId!, job])
    );

    return templates
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
      .map((template) => {
        const templateVersions = versions
          .filter((version) => version.promptTemplateId === template._id)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        const templateCompositions = compositions.filter(
          (composition) => composition.promptTemplateId === template._id
        );
        const recentCompositions = templateCompositions.filter(
          (composition) => composition._creationTime >= now - 24 * 60 * 60 * 1000
        );
        const failedJobs = templateCompositions
          .map((composition) => jobByCompositionId.get(composition._id))
          .filter(
            (job): job is NonNullable<typeof job> => job !== undefined && job.status === "failed"
          )
          .sort((a, b) => b._creationTime - a._creationTime);
        const latestExperiment = experimentRuns
          .filter((run) => run.promptTemplateId === template._id)
          .sort((a, b) => b._creationTime - a._creationTime)
          .at(0);
        const templateBindings = bindings
          .filter((binding) => binding.promptTemplateId === template._id)
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.priority - a.priority)
          .map((binding) => {
            const profile = profileById.get(binding.llmProfileId);
            return {
              _id: binding._id,
              generationKind: binding.generationKind,
              renderMode: binding.renderMode,
              isActive: binding.isActive,
              isDefault: binding.isDefault,
              profileName: profile?.name ?? "Missing profile",
              modelId: profile?.modelId ?? "Unresolved model",
            };
          });
        const latestUpdatedAt = Math.max(
          template.updatedAt ?? template._creationTime,
          ...templateVersions.map((version) => version.updatedAt)
        );
        const publishedVersion = template.publishedVersionId
          ? templateVersions.find((version) => version._id === template.publishedVersionId)
          : templateVersions.find((version) => version.status === "published");
        const availableVariables = promptTemplateVariableDefinitions.filter((definition) =>
          definition.kinds.includes(template.kind)
        );

        return {
          _id: template._id,
          _creationTime: template._creationTime,
          name: template.name,
          slug: template.slug,
          kind: template.kind,
          isActive: template.isActive,
          publishedVersionId: publishedVersion?._id,
          updatedAt: latestUpdatedAt,
          current: {
            version: template.version,
            systemPrompt: template.systemPrompt,
            userPromptTemplate: template.userPromptTemplate,
            negativePromptTemplate: template.negativePromptTemplate,
            notePolicy: template.notePolicy,
          },
          versions:
            templateVersions.length > 0
              ? templateVersions.map((version) => ({
                  _id: version._id,
                  version: version.version,
                  status: version.status,
                  systemPrompt: version.systemPrompt,
                  userPromptTemplate: version.userPromptTemplate,
                  negativePromptTemplate: version.negativePromptTemplate,
                  notePolicy: version.notePolicy,
                  createdAt: version.createdAt,
                  updatedAt: version.updatedAt,
                  publishedAt: version.publishedAt,
                  usedVariables: extractTemplateVariables(version.userPromptTemplate),
                }))
              : [
                  {
                    _id: null,
                    version: template.version,
                    status: "published" as const,
                    systemPrompt: template.systemPrompt,
                    userPromptTemplate: template.userPromptTemplate,
                    negativePromptTemplate: template.negativePromptTemplate,
                    notePolicy: template.notePolicy,
                    createdAt: template._creationTime,
                    updatedAt: template.updatedAt ?? template._creationTime,
                    publishedAt: template._creationTime,
                    usedVariables: extractTemplateVariables(template.userPromptTemplate),
                  },
                ],
          variables: availableVariables.map((definition) => ({
            ...definition,
            token: `{{${definition.key}}}`,
          })),
          usage: {
            last24h: recentCompositions.length,
            total: templateCompositions.length,
            lastFailureAt: failedJobs[0]?._creationTime,
            lastFailure: failedJobs[0]?.errorMessage,
            latestExperimentAt: latestExperiment?._creationTime,
            latestExperimentStatus: latestExperiment?.status,
          },
          bindings: templateBindings,
        };
      });
  },
});

export const getPromptTemplateVersion = query({
  args: {
    promptTemplateVersionId: v.id("promptTemplateVersions"),
  },
  async handler(ctx, { promptTemplateVersionId }) {
    requireSuperAdmin(ctx);
    return await ctx.db.get(promptTemplateVersionId);
  },
});

export const listLlmRoutingConfig = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [profiles, bindings, templates] = await Promise.all([
      ctx.db.query("llmProfiles").collect(),
      ctx.db.query("promptTemplateBindings").collect(),
      ctx.db.query("promptTemplates").collect(),
    ]);
    const profileById = new Map(profiles.map((profile) => [profile._id, profile]));
    const templateById = new Map(templates.map((template) => [template._id, template]));

    return {
      profiles: profiles
        .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
        .map((profile) => ({
          _id: profile._id,
          _creationTime: profile._creationTime,
          name: profile.name,
          slug: profile.slug,
          provider: profile.provider,
          capability: profile.capability,
          apiFormat: profile.apiFormat,
          baseUrl: profile.baseUrl,
          keyEnvName: profile.keyEnvName,
          modelId: profile.modelId,
          headersJson: profile.headersJson,
          requestDefaultsJson: profile.requestDefaultsJson,
          timeoutMs: profile.timeoutMs,
          priority: profile.priority,
          notes: profile.notes,
          isActive: profile.isActive,
          updatedAt: profile.updatedAt,
          updatedByUserId: profile.updatedByUserId,
        })),
      bindings: bindings
        .sort((a, b) => b.priority - a.priority || b._creationTime - a._creationTime)
        .map((binding) => {
          const profile = profileById.get(binding.llmProfileId);
          const template = templateById.get(binding.promptTemplateId);

          return {
            _id: binding._id,
            _creationTime: binding._creationTime,
            promptTemplateId: binding.promptTemplateId,
            templateKind: binding.templateKind,
            llmProfileId: binding.llmProfileId,
            generationKind: binding.generationKind,
            renderMode: binding.renderMode,
            parameterOverridesJson: binding.parameterOverridesJson,
            priority: binding.priority,
            notes: binding.notes,
            isDefault: binding.isDefault,
            isActive: binding.isActive,
            updatedAt: binding.updatedAt,
            updatedByUserId: binding.updatedByUserId,
            profile: profile
              ? {
                  _id: profile._id,
                  name: profile.name,
                  slug: profile.slug,
                  provider: profile.provider,
                  capability: profile.capability,
                  modelId: profile.modelId,
                  isActive: profile.isActive,
                }
              : null,
            template: template
              ? {
                  _id: template._id,
                  name: template.name,
                  slug: template.slug,
                  kind: template.kind,
                  version: template.version,
                  isActive: template.isActive,
                }
              : null,
          };
        }),
      promptTemplates: templates
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
        .map((template) => ({
          _id: template._id,
          name: template.name,
          slug: template.slug,
          kind: template.kind,
          version: template.version,
          isActive: template.isActive,
        })),
    };
  },
});

export const createLlmProfile = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    provider: vLlmProvider,
    capability: vLlmCapability,
    apiFormat: v.optional(vLlmApiFormat),
    baseUrl: v.string(),
    keyEnvName: v.string(),
    modelId: v.string(),
    headersJson: v.optional(v.string()),
    requestDefaultsJson: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
    priority: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const now = Date.now();
    const name = requireTrimmedString(args.name, "Profile name");
    const slug = normalizeLlmSlug(args.slug ?? name);
    await assertLlmProfileSlugAvailable(ctx, slug);

    const profileId = await ctx.db.insert("llmProfiles", {
      name,
      slug,
      provider: args.provider,
      capability: args.capability,
      apiFormat: args.apiFormat ?? "openai-compatible",
      baseUrl: normalizeLlmBaseUrl(args.baseUrl),
      keyEnvName: normalizeEnvName(args.keyEnvName),
      modelId: requireTrimmedString(args.modelId, "Model id"),
      headersJson: normalizeHeadersJson(args.headersJson),
      requestDefaultsJson: normalizeJsonObjectString(args.requestDefaultsJson, "Request defaults"),
      timeoutMs: normalizeTimeoutMs(args.timeoutMs),
      priority: normalizePriority(args.priority),
      notes: cleanOptionalString(args.notes),
      isActive: args.isActive ?? true,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "create-llm-profile",
      entityType: "llmProfile",
      entityId: profileId,
      detailsJson: JSON.stringify({
        profileId,
        provider: args.provider,
        capability: args.capability,
        slug,
      }),
    });

    return profileId;
  },
});

export const updateLlmProfile = mutation({
  args: {
    profileId: v.id("llmProfiles"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    provider: v.optional(vLlmProvider),
    capability: v.optional(vLlmCapability),
    apiFormat: v.optional(vLlmApiFormat),
    baseUrl: v.optional(v.string()),
    keyEnvName: v.optional(v.string()),
    modelId: v.optional(v.string()),
    headersJson: v.optional(v.string()),
    requestDefaultsJson: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
    priority: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (profile === null) {
      throw new Error("LLM profile not found");
    }

    const patch: {
      apiFormat?: LlmApiFormat;
      baseUrl?: string;
      capability?: LlmCapability;
      headersJson?: string;
      isActive?: boolean;
      keyEnvName?: string;
      modelId?: string;
      name?: string;
      notes?: string;
      priority?: number;
      provider?: LlmProvider;
      requestDefaultsJson?: string;
      slug?: string;
      timeoutMs?: number;
      updatedAt: number;
      updatedByUserId: Id<"users">;
    } = {
      updatedAt: Date.now(),
      updatedByUserId: viewer._id,
    };

    if (args.name !== undefined) {
      patch.name = requireTrimmedString(args.name, "Profile name");
    }
    if (args.slug !== undefined) {
      const slug = normalizeLlmSlug(args.slug);
      await assertLlmProfileSlugAvailable(ctx, slug, args.profileId);
      patch.slug = slug;
    }
    if (args.provider !== undefined) {
      patch.provider = args.provider;
    }
    if (args.capability !== undefined) {
      patch.capability = args.capability;
    }
    if (args.apiFormat !== undefined) {
      patch.apiFormat = args.apiFormat;
    }
    if (args.baseUrl !== undefined) {
      patch.baseUrl = normalizeLlmBaseUrl(args.baseUrl);
    }
    if (args.keyEnvName !== undefined) {
      patch.keyEnvName = normalizeEnvName(args.keyEnvName);
    }
    if (args.modelId !== undefined) {
      patch.modelId = requireTrimmedString(args.modelId, "Model id");
    }
    if (args.headersJson !== undefined) {
      patch.headersJson = normalizeHeadersJson(args.headersJson);
    }
    if (args.requestDefaultsJson !== undefined) {
      patch.requestDefaultsJson = normalizeJsonObjectString(
        args.requestDefaultsJson,
        "Request defaults"
      );
    }
    if (args.timeoutMs !== undefined) {
      patch.timeoutMs = normalizeTimeoutMs(args.timeoutMs);
    }
    if (args.priority !== undefined) {
      patch.priority = normalizePriority(args.priority);
    }
    if (args.notes !== undefined) {
      patch.notes = cleanOptionalString(args.notes);
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.profileId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-llm-profile",
      entityType: "llmProfile",
      entityId: args.profileId,
      detailsJson: JSON.stringify({
        profileId: args.profileId,
        provider: patch.provider ?? profile.provider,
        capability: patch.capability ?? profile.capability,
        isActive: patch.isActive ?? profile.isActive,
      }),
    });
  },
});

export const createPromptTemplateBinding = mutation({
  args: {
    promptTemplateId: v.id("promptTemplates"),
    llmProfileId: v.id("llmProfiles"),
    generationKind: v.optional(vGenerationKind),
    renderMode: v.optional(vRenderMode),
    parameterOverridesJson: v.optional(v.string()),
    priority: v.optional(v.number()),
    notes: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const [template, profile] = await Promise.all([
      ctx.db.get(args.promptTemplateId),
      ctx.db.get(args.llmProfileId),
    ]);
    if (template === null) {
      throw new Error("Prompt template not found");
    }
    if (profile === null) {
      throw new Error("LLM profile not found");
    }
    assertBindingScope(args.generationKind, args.renderMode);

    const now = Date.now();
    if (args.isDefault === true) {
      await clearDefaultTemplateBindings(ctx, args.promptTemplateId, viewer._id, now);
    }

    const bindingId = await ctx.db.insert("promptTemplateBindings", {
      promptTemplateId: args.promptTemplateId,
      templateKind: template.kind,
      llmProfileId: args.llmProfileId,
      generationKind: args.generationKind,
      renderMode: args.renderMode,
      parameterOverridesJson: normalizeJsonObjectString(
        args.parameterOverridesJson,
        "Parameter overrides"
      ),
      priority: normalizePriority(args.priority),
      notes: cleanOptionalString(args.notes),
      isDefault: args.isDefault ?? false,
      isActive: args.isActive ?? true,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "create-prompt-template-binding",
      entityType: "promptTemplateBinding",
      entityId: bindingId,
      detailsJson: JSON.stringify({
        bindingId,
        promptTemplateId: args.promptTemplateId,
        llmProfileId: args.llmProfileId,
        templateKind: template.kind,
        profileSlug: profile.slug,
      }),
    });

    return bindingId;
  },
});

export const updatePromptTemplateBinding = mutation({
  args: {
    bindingId: v.id("promptTemplateBindings"),
    llmProfileId: v.optional(v.id("llmProfiles")),
    generationKind: v.optional(vGenerationKind),
    renderMode: v.optional(vRenderMode),
    parameterOverridesJson: v.optional(v.string()),
    priority: v.optional(v.number()),
    notes: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const binding = await ctx.db.get(args.bindingId);
    if (binding === null) {
      throw new Error("Prompt template binding not found");
    }
    if (args.llmProfileId !== undefined) {
      const profile = await ctx.db.get(args.llmProfileId);
      if (profile === null) {
        throw new Error("LLM profile not found");
      }
    }

    const generationKind = args.generationKind ?? binding.generationKind;
    const renderMode = args.renderMode ?? binding.renderMode;
    assertBindingScope(generationKind, renderMode);

    const now = Date.now();
    if (args.isDefault === true) {
      await clearDefaultTemplateBindings(
        ctx,
        binding.promptTemplateId,
        viewer._id,
        now,
        args.bindingId
      );
    }

    const patch: {
      generationKind?: GenerationKind;
      isActive?: boolean;
      isDefault?: boolean;
      llmProfileId?: Id<"llmProfiles">;
      notes?: string;
      parameterOverridesJson?: string;
      priority?: number;
      renderMode?: RenderMode;
      updatedAt: number;
      updatedByUserId: Id<"users">;
    } = {
      updatedAt: now,
      updatedByUserId: viewer._id,
    };
    if (args.llmProfileId !== undefined) {
      patch.llmProfileId = args.llmProfileId;
    }
    if (args.generationKind !== undefined) {
      patch.generationKind = args.generationKind;
    }
    if (args.renderMode !== undefined) {
      patch.renderMode = args.renderMode;
    }
    if (args.parameterOverridesJson !== undefined) {
      patch.parameterOverridesJson = normalizeJsonObjectString(
        args.parameterOverridesJson,
        "Parameter overrides"
      );
    }
    if (args.priority !== undefined) {
      patch.priority = normalizePriority(args.priority);
    }
    if (args.notes !== undefined) {
      patch.notes = cleanOptionalString(args.notes);
    }
    if (args.isDefault !== undefined) {
      patch.isDefault = args.isDefault;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.bindingId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-prompt-template-binding",
      entityType: "promptTemplateBinding",
      entityId: args.bindingId,
      detailsJson: JSON.stringify({
        bindingId: args.bindingId,
        promptTemplateId: binding.promptTemplateId,
        llmProfileId: patch.llmProfileId ?? binding.llmProfileId,
        isDefault: patch.isDefault ?? binding.isDefault,
        isActive: patch.isActive ?? binding.isActive,
      }),
    });
  },
});

export const listPriceRules = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    return (await ctx.db.query("creditPriceRules").withIndex("by_sortOrder").collect()).map(
      (rule) => ({
        _id: rule._id,
        _creationTime: rule._creationTime,
        actionType: rule.actionType,
        label: rule.label,
        generationKind: rule.generationKind,
        creditCost: rule.creditCost,
        description: rule.description,
        sortOrder: rule.sortOrder,
        isActive: rule.isActive,
      })
    );
  },
});

export const composePromptLabPreview = mutation({
  args: {
    promptTemplateId: v.id("promptTemplates"),
    promptTemplateVersionId: v.optional(v.id("promptTemplateVersions")),
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: vWeatheringLevel,
    notes: v.optional(v.string()),
    conceptId: v.optional(v.string()),
    remixSource: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireSuperAdmin(ctx);
    return await composePromptLabPayload(ctx, args);
  },
});

export const listPromptExperimentRuns = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const runs = await ctx.db.query("promptExperimentRuns").collect();
    const users = await ctx.db.query("users").collect();
    const userById = new Map(users.map((user) => [user._id, user]));

    return runs
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 40)
      .map((run) => {
        const inputSnapshot = safeParseJson(run.inputSnapshotJson);
        const templateSnapshot = safeParseJson(run.templateSnapshotJson);
        const actor = userById.get(run.userId);

        return {
          _id: run._id,
          _creationTime: run._creationTime,
          templateKind: run.templateKind,
          templateName: run.templateName,
          templateVersion: run.templateVersion,
          promptTemplateId: run.promptTemplateId,
          promptTemplateVersionId: run.promptTemplateVersionId,
          composedPrompt: run.composedPrompt,
          negativePrompt: run.negativePrompt,
          source: run.source,
          status: run.status,
          providerLabel: run.providerLabel,
          modelLabel: run.modelLabel,
          vendorUrl: run.vendorUrl,
          parameterNotes: run.parameterNotes,
          outputImageUrl: run.outputImageUrl,
          outputNotes: run.outputNotes,
          failureTags: run.failureTags,
          styleHitScore: run.styleHitScore,
          silhouetteScore: run.silhouetteScore,
          paintabilityScore: run.paintabilityScore,
          promptAdherenceScore: run.promptAdherenceScore,
          visualImpactScore: run.visualImpactScore,
          overallScore: run.overallScore,
          selectedAsWinner: run.selectedAsWinner,
          inputSnapshot,
          templateSnapshot,
          actor: actor
            ? {
                _id: actor._id,
                fullName: actor.fullName,
                email: actor.email,
                handle: actor.handle,
              }
            : null,
        };
      });
  },
});

export const listPromptExperimentRunRegistry = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    search: v.optional(v.string()),
    promptTemplateId: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("ready-for-web"),
        v.literal("tested"),
        v.literal("selected"),
        v.literal("rejected"),
        v.literal("archived")
      )
    ),
    selectedRunId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireSuperAdmin(ctx);

    const allRuns = await ctx.db.query("promptExperimentRuns").collect();
    const normalizedTemplateId = args.promptTemplateId
      ? ctx.db.normalizeId("promptTemplates", args.promptTemplateId)
      : null;
    const normalizedSelectedRunId = args.selectedRunId
      ? ctx.db.normalizeId("promptExperimentRuns", args.selectedRunId)
      : null;
    const search = normalizeAdminSearch(args.search);
    const provider = args.provider?.trim().toLowerCase();
    const pageSize = Math.min(100, Math.max(1, Math.round(args.pageSize)));

    const providers = Array.from(
      new Set(
        allRuns
          .map((run) => cleanOptionalString(run.providerLabel))
          .filter((value): value is string => value !== undefined)
      )
    ).sort((a, b) => a.localeCompare(b));
    const filtered = allRuns
      .filter((run) => {
        if (args.promptTemplateId && normalizedTemplateId === null) return false;
        if (normalizedTemplateId && run.promptTemplateId !== normalizedTemplateId) return false;
        if (args.status && run.status !== args.status) return false;
        if (provider && run.providerLabel?.trim().toLowerCase() !== provider) return false;
        if (!search) return true;
        return normalizeAdminSearch(
          [
            run.templateName,
            run.templateVersion,
            run.templateKind,
            run.providerLabel,
            run.modelLabel,
            run.outputNotes,
            run.parameterNotes,
            ...run.failureTags,
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(search);
      })
      .sort((a, b) => b._creationTime - a._creationTime);
    const filteredTotal = filtered.length;
    const pageCount = Math.ceil(filteredTotal / pageSize);
    const pageIndex = Math.min(
      Math.max(0, Math.round(args.page)),
      Math.max(0, pageCount - 1)
    );
    const pageRuns = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    const selectedRun = normalizedSelectedRunId
      ? allRuns.find((run) => run._id === normalizedSelectedRunId) ?? null
      : null;
    const runUsers = Array.from(
      new Set(
        [...pageRuns, ...(selectedRun ? [selectedRun] : [])].map((run) => run.userId)
      )
    );
    const users = await Promise.all(runUsers.map((userId) => ctx.db.get(userId)));
    const userById = new Map(
      users.filter((user) => user !== null).map((user) => [user!._id, user!])
    );
    const serialize = (run: (typeof allRuns)[number]) => {
      const actor = userById.get(run.userId);
      return {
        _id: run._id,
        _creationTime: run._creationTime,
        templateKind: run.templateKind,
        templateName: run.templateName,
        templateVersion: run.templateVersion,
        promptTemplateId: run.promptTemplateId,
        promptTemplateVersionId: run.promptTemplateVersionId,
        composedPrompt: run.composedPrompt,
        negativePrompt: run.negativePrompt,
        source: run.source,
        status: run.status,
        providerLabel: run.providerLabel,
        modelLabel: run.modelLabel,
        vendorUrl: run.vendorUrl,
        parameterNotes: run.parameterNotes,
        outputImageUrl: run.outputImageUrl,
        outputNotes: run.outputNotes,
        failureTags: run.failureTags,
        styleHitScore: run.styleHitScore,
        silhouetteScore: run.silhouetteScore,
        paintabilityScore: run.paintabilityScore,
        promptAdherenceScore: run.promptAdherenceScore,
        visualImpactScore: run.visualImpactScore,
        overallScore: run.overallScore,
        selectedAsWinner: run.selectedAsWinner,
        inputSnapshot: safeParseJson(run.inputSnapshotJson),
        templateSnapshot: safeParseJson(run.templateSnapshotJson),
        actor: actor
          ? {
              _id: actor._id,
              fullName: actor.fullName,
              email: actor.email,
              handle: actor.handle,
            }
          : null,
      };
    };

    return {
      page: pageRuns.map(serialize),
      selectedRun: selectedRun ? serialize(selectedRun) : null,
      pageIndex,
      pageSize,
      pageCount,
      filteredTotal,
      allTotal: allRuns.length,
      providers,
    };
  },
});

export const savePromptExperimentRun = mutation({
  args: {
    promptTemplateId: v.id("promptTemplates"),
    promptTemplateVersionId: v.optional(v.id("promptTemplateVersions")),
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.optional(v.id("stylePresets")),
    materialPresetId: v.optional(v.id("materialPresets")),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: vWeatheringLevel,
    notes: v.optional(v.string()),
    conceptId: v.optional(v.string()),
    remixSource: v.optional(v.string()),
    providerLabel: v.optional(v.string()),
    modelLabel: v.optional(v.string()),
    vendorUrl: v.optional(v.string()),
    parameterNotes: v.optional(v.string()),
    outputImageUrl: v.optional(v.string()),
    outputNotes: v.optional(v.string()),
    failureTags: v.optional(v.array(v.string())),
    styleHitScore: v.optional(v.number()),
    silhouetteScore: v.optional(v.number()),
    paintabilityScore: v.optional(v.number()),
    promptAdherenceScore: v.optional(v.number()),
    visualImpactScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    selectedAsWinner: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const payload = await composePromptLabPayload(ctx, args);
    const selectedAsWinner = args.selectedAsWinner ?? false;
    const runId = await ctx.db.insert("promptExperimentRuns", {
      userId: viewer._id,
      promptTemplateId: payload.template._id,
      promptTemplateVersionId: payload.templateVersionId,
      templateKind: payload.template.kind,
      templateName: payload.template.name,
      templateVersion: payload.templateSnapshot.version,
      templateSnapshotJson: JSON.stringify(payload.templateSnapshot),
      inputSnapshotJson: JSON.stringify(payload.inputSnapshot),
      composedPrompt: payload.composedPrompt,
      negativePrompt: payload.negativePrompt,
      source: "manual-web",
      status: selectedAsWinner
        ? "selected"
        : hasExperimentEvidence(args)
          ? "tested"
          : "ready-for-web",
      providerLabel: cleanOptionalString(args.providerLabel),
      modelLabel: cleanOptionalString(args.modelLabel),
      vendorUrl: cleanOptionalString(args.vendorUrl),
      parameterNotes: cleanOptionalString(args.parameterNotes),
      outputImageUrl: cleanOptionalString(args.outputImageUrl),
      outputNotes: cleanOptionalString(args.outputNotes),
      failureTags: compactStringArray(args.failureTags ?? []),
      styleHitScore: args.styleHitScore,
      silhouetteScore: args.silhouetteScore,
      paintabilityScore: args.paintabilityScore,
      promptAdherenceScore: args.promptAdherenceScore,
      visualImpactScore: args.visualImpactScore,
      overallScore: args.overallScore,
      selectedAsWinner,
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "save-prompt-experiment-run",
      entityType: "promptExperimentRun",
      entityId: runId,
      detailsJson: JSON.stringify({
        runId,
        promptTemplateId: payload.template._id,
        promptTemplateVersionId: payload.templateVersionId,
        templateKind: payload.template.kind,
        templateVersion: payload.templateSnapshot.version,
        providerLabel: args.providerLabel,
        modelLabel: args.modelLabel,
        selectedAsWinner,
      }),
    });

    return {
      runId,
      composedPrompt: payload.composedPrompt,
      warnings: payload.warnings,
    };
  },
});

export const updatePromptExperimentRun = mutation({
  args: {
    runId: v.id("promptExperimentRuns"),
    status: v.optional(
      v.union(
        v.literal("ready-for-web"),
        v.literal("tested"),
        v.literal("selected"),
        v.literal("rejected"),
        v.literal("archived")
      )
    ),
    providerLabel: v.optional(v.string()),
    modelLabel: v.optional(v.string()),
    vendorUrl: v.optional(v.string()),
    parameterNotes: v.optional(v.string()),
    outputImageUrl: v.optional(v.string()),
    outputNotes: v.optional(v.string()),
    failureTags: v.optional(v.array(v.string())),
    styleHitScore: v.optional(v.number()),
    silhouetteScore: v.optional(v.number()),
    paintabilityScore: v.optional(v.number()),
    promptAdherenceScore: v.optional(v.number()),
    visualImpactScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    selectedAsWinner: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const run = await ctx.db.get(args.runId);
    if (run === null) {
      throw new Error("Prompt experiment run not found");
    }

    const selectedAsWinner = args.selectedAsWinner ?? run.selectedAsWinner;
    const patch: {
      failureTags?: string[];
      modelLabel?: string;
      outputImageUrl?: string;
      outputNotes?: string;
      overallScore?: number;
      paintabilityScore?: number;
      parameterNotes?: string;
      providerLabel?: string;
      promptAdherenceScore?: number;
      selectedAsWinner?: boolean;
      silhouetteScore?: number;
      status?: "ready-for-web" | "tested" | "selected" | "rejected" | "archived";
      styleHitScore?: number;
      vendorUrl?: string;
      visualImpactScore?: number;
    } = {
      status:
        args.status ??
        (selectedAsWinner
          ? "selected"
          : hasExperimentEvidence({ ...run, ...args })
            ? "tested"
            : run.status),
      selectedAsWinner,
    };
    if (args.providerLabel !== undefined) {
      patch.providerLabel = cleanOptionalString(args.providerLabel);
    }
    if (args.modelLabel !== undefined) {
      patch.modelLabel = cleanOptionalString(args.modelLabel);
    }
    if (args.vendorUrl !== undefined) {
      patch.vendorUrl = cleanOptionalString(args.vendorUrl);
    }
    if (args.parameterNotes !== undefined) {
      patch.parameterNotes = cleanOptionalString(args.parameterNotes);
    }
    if (args.outputImageUrl !== undefined) {
      patch.outputImageUrl = cleanOptionalString(args.outputImageUrl);
    }
    if (args.outputNotes !== undefined) {
      patch.outputNotes = cleanOptionalString(args.outputNotes);
    }
    if (args.failureTags !== undefined) {
      patch.failureTags = compactStringArray(args.failureTags);
    }
    if (args.styleHitScore !== undefined) {
      patch.styleHitScore = args.styleHitScore;
    }
    if (args.silhouetteScore !== undefined) {
      patch.silhouetteScore = args.silhouetteScore;
    }
    if (args.paintabilityScore !== undefined) {
      patch.paintabilityScore = args.paintabilityScore;
    }
    if (args.promptAdherenceScore !== undefined) {
      patch.promptAdherenceScore = args.promptAdherenceScore;
    }
    if (args.visualImpactScore !== undefined) {
      patch.visualImpactScore = args.visualImpactScore;
    }
    if (args.overallScore !== undefined) {
      patch.overallScore = args.overallScore;
    }

    await ctx.db.patch(args.runId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-prompt-experiment-run",
      entityType: "promptExperimentRun",
      entityId: args.runId,
      detailsJson: JSON.stringify({
        runId: args.runId,
        status: patch.status,
        selectedAsWinner,
      }),
    });
  },
});

export const listAuditLog = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [logs, users] = await Promise.all([
      ctx.db.query("adminAuditLogs").collect(),
      ctx.db.query("users").collect(),
    ]);
    const userById = new Map(users.map((user) => [user._id, user]));

    return logs
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 20)
      .map((log) => ({
        _id: log._id,
        _creationTime: log._creationTime,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        detailsJson: log.detailsJson,
        actor: userById.get(log.userId)
          ? {
              _id: log.userId,
              fullName: userById.get(log.userId)!.fullName,
              email: userById.get(log.userId)!.email,
            }
          : null,
      }));
  },
});

export const listGenerationJobsAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    const [jobs, users, baseModels, stylePresets, materialPresets] =
      await Promise.all([
        ctx.db.query("generationJobs").collect(),
        ctx.db.query("users").collect(),
        ctx.db.query("baseModels").collect(),
        ctx.db.query("stylePresets").collect(),
        ctx.db.query("materialPresets").collect(),
      ]);
    const usersById = new Map(users.map((item) => [item._id, item]));
    const modelsById = new Map(baseModels.map((item) => [item._id, item]));
    const stylesById = new Map(stylePresets.map((item) => [item._id, item]));
    const materialsById = new Map(materialPresets.map((item) => [item._id, item]));

    return jobs
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 200)
      .map((job) => {
        const user = usersById.get(job.userId);
        const model = job.baseModelId ? modelsById.get(job.baseModelId) : undefined;
        const style = job.stylePresetId ? stylesById.get(job.stylePresetId) : undefined;
        const material = job.materialPresetId
          ? materialsById.get(job.materialPresetId)
          : undefined;
        return {
          ...job,
          user: user
            ? { _id: user._id, fullName: user.fullName, email: user.email, handle: user.handle }
            : null,
          model: model ? { _id: model._id, name: model.name, slug: model.slug } : null,
          style: style ? { _id: style._id, name: style.name, slug: style.slug } : null,
          material: material
            ? { _id: material._id, name: material.name, slug: material.slug }
            : null,
        };
      });
  },
});

export const listOrdersAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    const [orders, users, items] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("orderItems").collect(),
    ]);
    const usersById = new Map(users.map((item) => [item._id, item]));
    const itemsByOrderId = new Map<Id<"orders">, Doc<"orderItems">[]>();
    for (const item of items) {
      itemsByOrderId.set(item.orderId, [...(itemsByOrderId.get(item.orderId) ?? []), item]);
    }
    return orders
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((order) => {
        const user = usersById.get(order.userId);
        return {
          ...order,
          user: user
            ? { _id: user._id, fullName: user.fullName, email: user.email, handle: user.handle }
            : null,
          items: itemsByOrderId.get(order._id) ?? [],
        };
      });
  },
});

export const listFeedbackPipeline = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [reports, users] = await Promise.all([
      ctx.db.query("feedbackReports").collect(),
      ctx.db.query("users").collect(),
    ]);
    const userById = new Map(users.map((user) => [user._id, user]));

    const enriched = await Promise.all(
      reports.map(async (report) => {
        const [
          baseModel,
          stylePreset,
          materialPreset,
          concept,
          generationJob,
          attachment,
          resolutionExperiment,
          queueItem,
        ] = await Promise.all([
          report.baseModelId ? ctx.db.get(report.baseModelId) : null,
          report.stylePresetId ? ctx.db.get(report.stylePresetId) : null,
          report.materialPresetId ? ctx.db.get(report.materialPresetId) : null,
          report.conceptId ? ctx.db.get(report.conceptId) : null,
          report.relatedGenerationJobId ? ctx.db.get(report.relatedGenerationJobId) : null,
          report.relatedAssetId ? ctx.db.get(report.relatedAssetId) : null,
          report.resolutionExperimentRunId
            ? ctx.db.get(report.resolutionExperimentRunId)
            : null,
          ctx.db
            .query("adminQueue")
            .withIndex("by_itemType_itemId", (q) =>
              q.eq("itemType", "feedback").eq("itemId", report._id)
            )
            .unique(),
          ]);

        const kitVariantSummary = await summarizeBaseModelWithHierarchy(ctx, baseModel);

        return {
          _id: report._id,
          _creationTime: report._creationTime,
          recordNumber: report.recordNumber,
          category: report.category,
          status: normalizeAdminFeedbackStatus(report.status),
          priority: report.priority ?? priorityFromLegacyQueue(queueItem?.priority),
          title: report.title ?? legacyFeedbackTitle(report.message),
          message: report.title ? report.message : legacyFeedbackMessage(report.message),
          source: report.source ?? inferAdminFeedbackSource(report),
          sourcePage: report.sourcePage,
          contextSnapshot: safeParseJson(report.contextSnapshotJson),
          rootCause: report.rootCause,
          resolutionOutcome: report.resolutionOutcome,
          internalNote: report.internalNote ?? report.adminNotes,
          adminNotes: report.internalNote ?? report.adminNotes,
          userResponseDraft: report.userResponseDraft ?? report.userResponse,
          userResponse: report.userResponse,
          responseSentAt: report.responseSentAt,
          resolvedAt: report.resolvedAt,
          reporter: userById.get(report.userId)
            ? {
                _id: report.userId,
                fullName: userById.get(report.userId)!.fullName,
                email: userById.get(report.userId)!.email,
                handle: userById.get(report.userId)!.handle,
              }
            : null,
          kitVariant: kitVariantSummary,
          baseModel: kitVariantSummary,
          stylePreset: stylePreset
            ? {
                _id: stylePreset._id,
                name: stylePreset.name,
              }
            : null,
          materialPreset: materialPreset
            ? {
                _id: materialPreset._id,
                name: materialPreset.name,
              }
            : null,
          concept: concept
            ? {
                _id: concept._id,
                recordNumber: concept.recordNumber,
                title: concept.title,
                status: concept.status,
              }
            : null,
          attachment: attachment?.publicUrl
            ? {
                _id: attachment._id,
                publicUrl: attachment.publicUrl,
                contentType: attachment.contentType,
              }
            : null,
          resolutionExperiment: resolutionExperiment
            ? {
                _id: resolutionExperiment._id,
                templateName: resolutionExperiment.templateName,
                templateVersion: resolutionExperiment.templateVersion,
                status: resolutionExperiment.status,
              }
            : null,
          assignee: report.assigneeUserId && userById.get(report.assigneeUserId)
            ? {
                _id: report.assigneeUserId,
                fullName: userById.get(report.assigneeUserId)!.fullName,
                handle: userById.get(report.assigneeUserId)!.handle,
              }
            : null,
          generationJob: generationJob
            ? {
                _id: generationJob._id,
                status: generationJob.status,
                provider: generationJob.provider,
                errorMessage: generationJob.errorMessage,
              }
            : null,
          queue: queueItem
            ? {
                _id: queueItem._id,
                priority: queueItem.priority,
                status: queueItem.status,
                assignedToUserId: queueItem.assignedToUserId,
                summary: queueItem.summary,
              }
            : null,
        };
      })
    );

    return enriched.sort((a, b) => {
      const priorityWeight = { high: 0, normal: 1, low: 2 } as const;
      const queuePriorityA = priorityWeight[a.priority];
      const queuePriorityB = priorityWeight[b.priority];
      if (a.status !== b.status) {
        const weight = { open: 0, reviewing: 1, resolved: 2, rejected: 3 } as const;
        return weight[a.status] - weight[b.status];
      }
      if (queuePriorityA !== queuePriorityB) {
        return queuePriorityA - queuePriorityB;
      }
      return b._creationTime - a._creationTime;
    });
  },
});

export const getFeedbackPromptLabContext = query({
  args: { feedbackId: v.string() },
  async handler(ctx, { feedbackId }) {
    requireSuperAdmin(ctx);
    const normalizedId = ctx.db.normalizeId("feedbackReports", feedbackId);
    const report = normalizedId ? await ctx.db.get(normalizedId) : null;
    if (!report) return null;

    const generationJob = report.relatedGenerationJobId
      ? await ctx.db.get(report.relatedGenerationJobId)
      : null;
    const inputSnapshot = safeParseJson(generationJob?.inputSnapshotJson);
    const input = isRecord(inputSnapshot) ? inputSnapshot : {};
    const moodTags = Array.isArray(input.moodTags)
      ? input.moodTags.filter((value): value is MoodTag =>
          typeof value === "string" && [
            "command-presence",
            "stealth-tension",
            "industrial-hazard",
            "reactor-glow",
            "field-fatigue",
            "ceremonial-clean",
          ].includes(value)
        )
      : [];
    const weatheringLevel: "clean" | "light" | "heavy" = input.weatheringLevel === "light" || input.weatheringLevel === "heavy"
      ? input.weatheringLevel
      : "clean";

    return {
      _id: report._id,
      reference: report.recordNumber
        ? `FB-${String(report.recordNumber).padStart(4, "0")}`
        : `FB-${report._id.slice(-4).toUpperCase()}`,
      title: report.title ?? legacyFeedbackTitle(report.message),
      message: report.title ? report.message : legacyFeedbackMessage(report.message),
      kitVariantId: report.baseModelId,
      stylePresetId: report.stylePresetId,
      materialPresetId: report.materialPresetId,
      conceptId: report.conceptId,
      generationJobId: report.relatedGenerationJobId,
      moodTags,
      weatheringLevel,
    };
  },
});

export const listCatalogData = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [kitVariantsRaw, stylePresets, materialPresets, paintMappings, creatorPacks] = await Promise.all([
      ctx.db.query("baseModels").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("paintMappings").collect(),
      ctx.db.query("creatorPacks").collect(),
    ]);

    const kitVariants = await Promise.all(
      kitVariantsRaw
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((model) => summarizeBaseModelWithHierarchy(ctx, model))
    );

    return {
      kitVariants,
      baseModels: kitVariants,
      stylePresets: stylePresets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((preset) => ({
          _id: preset._id,
          name: preset.name,
          slug: preset.slug,
          category: preset.category,
          shortDescription: preset.shortDescription,
          contrastLevel: preset.contrastLevel,
          weatheringProfile: preset.weatheringProfile,
          promptKeywords: preset.promptKeywords,
          negativeKeywords: preset.negativeKeywords,
          recommendedMaterialSlugs: preset.recommendedMaterialSlugs,
          seoKeywords: preset.seoKeywords,
          systemPromptFragment: preset.systemPromptFragment,
          styleSpec: preset.styleSpec,
          promptVersion: preset.promptVersion,
          visibilityWeight: preset.visibilityWeight,
          creatorUserId: preset.creatorUserId,
          isFeaturedStyle: preset.isFeaturedStyle ?? false,
          isActive: preset.isActive,
        })),
      materialPresets: materialPresets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((preset) => ({
          _id: preset._id,
          name: preset.name,
          slug: preset.slug,
          finishType: preset.finishType,
          reflectivityLevel: preset.reflectivityLevel,
          materialSpec: preset.materialSpec,
          promptKeywords: preset.promptKeywords,
          paintFinish: preset.paintFinish,
          difficultyLevel: preset.difficultyLevel,
          sheenLevel: preset.sheenLevel,
          shortDescription: preset.shortDescription,
          isActive: preset.isActive,
        })),
      paintMappings: paintMappings
        .sort((a, b) => a.brand.localeCompare(b.brand) || a.colorName.localeCompare(b.colorName))
        .map((mapping) => ({
          _id: mapping._id,
          mappingKey: mapping.mappingKey,
          brand: mapping.brand,
          line: mapping.line,
          code: mapping.code,
          colorName: mapping.colorName,
          finishType: mapping.finishType,
          paintType: mapping.paintType,
          availabilityRegion: mapping.availabilityRegion,
          affiliateUrl: mapping.affiliateUrl,
          hexPreview: mapping.hexPreview,
          isActive: mapping.isActive,
        })),
      creatorPacks: await Promise.all(
        creatorPacks
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (pack) => {
            const [engagement, publicConcepts] = await Promise.all([
              getCreatorPackEngagementSnapshot(ctx, pack._id),
              ctx.db
                .query("concepts")
                .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
                .collect()
                .then((items) =>
                  items.filter(
                    (concept) =>
                      (concept.status === "generated" || concept.status === "archived") &&
                      pack.stylePresetIds.includes(concept.stylePresetId as any)
                  )
                ),
            ]);

            return {
              _id: pack._id,
              name: pack.name,
              slug: pack.slug,
              creatorUserId: pack.creatorUserId,
              description: pack.description,
              tagline: pack.tagline,
              stylePresetIds: pack.stylePresetIds,
              kitVariantIds: pack.baseModelIds,
              baseModelIds: pack.baseModelIds,
              materialPresetIds: pack.materialPresetIds,
              packType: pack.packType,
              isFeatured: pack.isFeatured,
              isActive: pack.isActive,
              analytics: {
                packLikes: engagement.likeCount,
                packSaves: engagement.saveCount,
                publicConceptCount: publicConcepts.length,
              },
            };
          })
      ),
    };
  },
});

export const listStylePresetsAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    const [styles, users] = await Promise.all([
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("users").collect(),
    ]);
    const usersById = new Map(users.map((user) => [user._id, user]));
    return {
      styles: styles
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((style) => {
          const creator = style.creatorUserId ? usersById.get(style.creatorUserId) : null;
          return {
            ...style,
            isFeaturedStyle: style.isFeaturedStyle ?? false,
            creator: creator
              ? { _id: creator._id, fullName: creator.fullName, email: creator.email, handle: creator.handle }
              : null,
          };
        }),
      creators: users
        .filter((user) => user.isVerifiedCreator || user.isFeaturedCreator || canManagePlatform(user))
        .map((user) => ({ _id: user._id, fullName: user.fullName, email: user.email, handle: user.handle })),
    };
  },
});

export const listMaterialPresetsAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    return (await ctx.db.query("materialPresets").collect()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },
});

export const listPaintMappingsAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    return (await ctx.db.query("paintMappings").collect()).sort(
      (a, b) => a.brand.localeCompare(b.brand) || a.code.localeCompare(b.code)
    );
  },
});

export const listCreatorPacksAdmin = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    const [packs, users, styles, materials, kitVariantsRaw] = await Promise.all([
      ctx.db.query("creatorPacks").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("baseModels").collect(),
    ]);
    const usersById = new Map(users.map((user) => [user._id, user]));
    const kitVariants = await Promise.all(
      kitVariantsRaw
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((model) => summarizeBaseModelWithHierarchy(ctx, model))
    );
    return {
      packs: await Promise.all(
        packs
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(async (pack) => {
            const creator = usersById.get(pack.creatorUserId);
            const engagement = await getCreatorPackEngagementSnapshot(ctx, pack._id);
            return {
              ...pack,
              creator: creator
                ? { _id: creator._id, fullName: creator.fullName, email: creator.email, handle: creator.handle }
                : null,
              analytics: { likes: engagement.likeCount, saves: engagement.saveCount },
            };
          })
      ),
      creators: users
        .filter((user) => user.isVerifiedCreator || user.isFeaturedCreator || canManagePlatform(user))
        .map((user) => ({ _id: user._id, fullName: user.fullName, email: user.email, handle: user.handle })),
      styles: styles
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((style) => ({ _id: style._id, name: style.name, slug: style.slug, isActive: style.isActive })),
      materials: materials
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((material) => ({ _id: material._id, name: material.name, slug: material.slug, isActive: material.isActive })),
      kitVariants: kitVariants.map((kit) => ({
        _id: kit._id,
        name: kit.name,
        slug: kit.slug,
        isActive: kit.isActive,
        baseUnitName: kit.baseUnit?.name ?? null,
      })),
    };
  },
});

export const upsertCreatorPack = mutation({
  args: {
    creatorPackId: v.optional(v.id("creatorPacks")),
    name: v.string(),
    creatorUserId: v.id("users"),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    stylePresetIds: v.array(v.id("stylePresets")),
    baseModelIds: v.optional(v.array(v.id("baseModels"))),
    kitVariantIds: v.optional(v.array(v.id("baseModels"))),
    materialPresetIds: v.array(v.id("materialPresets")),
    packType: v.union(v.literal("free"), v.literal("premium")),
    isFeatured: v.boolean(),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);

    const name = args.name.trim();
    if (name.length < 3) {
      throw new Error("Creator pack name must be at least 3 characters");
    }

    const slug = slugify(name);
    const selectedKitVariantIds = args.kitVariantIds ?? args.baseModelIds ?? [];
    const patch = {
      name,
      slug,
      creatorUserId: args.creatorUserId,
      description: args.description || undefined,
      tagline: args.tagline || undefined,
      stylePresetIds: args.stylePresetIds,
      baseModelIds: selectedKitVariantIds,
      materialPresetIds: args.materialPresetIds,
      packType: args.packType,
      isFeatured: args.isFeatured,
      isActive: args.isActive,
      searchText: buildCreatorPackSearchText({
        name,
        tagline: args.tagline,
        description: args.description,
      }),
    };

    let creatorPackId = args.creatorPackId;
    if (creatorPackId) {
      const existing = await ctx.db.get(creatorPackId);
      if (existing === null) {
        throw new Error("Creator pack not found");
      }
      await ctx.db.patch(creatorPackId, patch);
    } else {
      creatorPackId = await ctx.db.insert("creatorPacks", patch);
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.creatorPackId ? "update-creator-pack" : "create-creator-pack",
      entityType: "creatorPack",
      entityId: creatorPackId,
      detailsJson: JSON.stringify({
        creatorPackId,
        creatorUserId: args.creatorUserId,
        packType: args.packType,
        isFeatured: args.isFeatured,
        isActive: args.isActive,
      }),
    });

    return creatorPackId;
  },
});

export const adjustUserCredits = mutation({
  args: {
    userId: v.id("users"),
    delta: v.number(),
    description: v.string(),
  },
  async handler(ctx, { userId, delta, description }) {
    const { viewer } = requireSuperAdmin(ctx);

    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("Credit delta must be a non-zero integer");
    }

    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("Target user not found");
    }

    let account = await ctx.db
      .query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (account === null) {
      const accountId = await ctx.db.insert("creditAccounts", {
        userId,
        balance: 0,
        lifetimeGranted: 0,
        lifetimeSpent: 0,
        lastCreditEventAt: Date.now(),
      });
      account = await ctx.db.get(accountId);
      if (account === null) {
        throw new Error("Failed to initialize credit account");
      }
    }

    const balanceAfter = account.balance + delta;
    if (balanceAfter < 0) {
      throw new Error("Credit adjustment would produce a negative balance");
    }

    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeGranted: delta > 0 ? account.lifetimeGranted + delta : account.lifetimeGranted,
      lifetimeSpent: delta < 0 ? account.lifetimeSpent + Math.abs(delta) : account.lifetimeSpent,
      lastCreditEventAt: Date.now(),
    });

    const transactionId = await ctx.db.insert("creditTransactions", {
      userId,
      actionType: "admin-adjustment",
      delta,
      creditAmount: Math.abs(delta),
      balanceAfter,
      referenceTable: "users",
      referenceId: userId,
      description,
      sourceType: "admin-adjustment",
      operatorUserId: viewer._id,
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "adjust-user-credits",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({
        targetUserId: userId,
        transactionId,
        delta,
        description,
        balanceAfter,
      }),
    });

    return {
      balanceAfter,
      transactionId,
    };
  },
});

export const reviewFeedback = mutation({
  args: {
    feedbackId: v.id("feedbackReports"),
    adminNotes: v.optional(v.string()),
    internalNote: v.optional(v.string()),
    userResponse: v.optional(v.string()),
    status: vFeedbackStatus,
    queueStatus: v.optional(v.union(v.literal("open"), v.literal("in-review"), v.literal("done"))),
    priority: v.optional(v.union(vFeedbackPriority, v.number())),
    rootCause: v.optional(vFeedbackRootCause),
    resolutionOutcome: v.optional(vFeedbackResolutionOutcome),
    assigneeUserId: v.optional(v.id("users")),
    assignToSelf: v.optional(v.boolean()),
    sendResponse: v.optional(v.boolean()),
    resolutionExperimentRunId: v.optional(v.id("promptExperimentRuns")),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const {
      feedbackId,
      adminNotes,
      internalNote,
      userResponse,
      rootCause,
      resolutionOutcome,
      assigneeUserId,
      assignToSelf,
      sendResponse,
      resolutionExperimentRunId,
    } = args;
    const status = normalizeAdminFeedbackStatus(args.status);
    const priority = normalizeAdminFeedbackPriority(args.priority);
    const report = await ctx.db.get(feedbackId);
    if (report === null) {
      throw new Error("Feedback report not found");
    }

    const queueItem = await ctx.db
      .query("adminQueue")
      .withIndex("by_itemType_itemId", (q) =>
        q.eq("itemType", "feedback").eq("itemId", feedbackId)
      )
      .unique();

    if (sendResponse && !userResponse?.trim()) {
      throw new Error("Add a user response before sending it");
    }
    if ((status === "resolved" || status === "rejected") && !resolutionOutcome) {
      throw new Error("Choose a resolution outcome before closing the report");
    }
    if (resolutionExperimentRunId && !(await ctx.db.get(resolutionExperimentRunId))) {
      throw new Error("The selected Prompt Lab experiment no longer exists");
    }

    const queueStatus = args.queueStatus ?? (
      status === "open" ? "open" : status === "reviewing" ? "in-review" : "done"
    );
    const now = Date.now();
    await ctx.db.patch(feedbackId, {
      status,
      priority,
      internalNote: internalNote ?? adminNotes,
      userResponseDraft: userResponse?.trim() || undefined,
      userResponse: sendResponse
        ? userResponse?.trim() || undefined
        : report.userResponse,
      rootCause,
      resolutionOutcome,
      assigneeUserId: assignToSelf ? viewer._id : assigneeUserId,
      responseSentAt: sendResponse ? now : report.responseSentAt,
      resolvedAt: status === "resolved" || status === "rejected" ? report.resolvedAt ?? now : undefined,
      resolutionExperimentRunId,
    });

    if (queueItem !== null) {
      const queuePatch: {
        assignedToUserId?: typeof viewer._id;
        priority?: number;
        status: "open" | "in-review" | "done";
        summary?: string;
      } = {
        status: queueStatus,
      };
      if (assignToSelf) {
        queuePatch.assignedToUserId = viewer._id;
      }
      if (priority !== undefined) {
        queuePatch.priority = feedbackPriorityToQueue(priority);
      }
      if (adminNotes !== undefined) {
        queuePatch.summary = queueItem.summary;
      }
      await ctx.db.patch(queueItem._id, queuePatch);
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "review-feedback",
      entityType: "feedbackReport",
      entityId: feedbackId,
      detailsJson: JSON.stringify({
        feedbackId,
        status,
        queueStatus,
        priority,
        rootCause,
        resolutionOutcome,
        assignToSelf: Boolean(assignToSelf),
        sendResponse: Boolean(sendResponse),
        resolutionExperimentRunId,
      }),
    });
  },
});

export const updateBaseModel = mutation({
  args: {
    baseModelId: v.id("baseModels"),
    name: v.optional(v.string()),
    series: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    primaryModelBrand: v.optional(v.string()),
    grade: v.optional(v.string()),
    scale: v.optional(v.string()),
    releaseVersion: v.optional(v.string()),
    silhouetteType: v.optional(v.string()),
    complexityLevel: v.optional(v.string()),
    panelDensity: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    thumbnailAssetKey: v.optional(v.string()),
    defaultMaterialPresetId: v.optional(v.id("materialPresets")),
    promptAnchor: v.optional(v.string()),
    status: v.optional(vModelCatalogStatus),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    await updateKitVariantFields(ctx, {
      ...args,
      kitVariantId: args.baseModelId,
      auditAction: "update-base-model",
      auditEntityType: "baseModel",
    });
  },
});

export const updateKitVariant = mutation({
  args: {
    kitVariantId: v.id("baseModels"),
    name: v.optional(v.string()),
    series: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    primaryModelBrand: v.optional(v.string()),
    grade: v.optional(v.string()),
    scale: v.optional(v.string()),
    releaseVersion: v.optional(v.string()),
    silhouetteType: v.optional(v.string()),
    complexityLevel: v.optional(v.string()),
    panelDensity: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    thumbnailAssetKey: v.optional(v.string()),
    defaultMaterialPresetId: v.optional(v.id("materialPresets")),
    promptAnchor: v.optional(v.string()),
    status: v.optional(vModelCatalogStatus),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    await updateKitVariantFields(ctx, {
      ...args,
      auditAction: "update-kit-variant",
      auditEntityType: "kitVariant",
    });
  },
});

export const updateStylePreset = mutation({
  args: {
    stylePresetId: v.id("stylePresets"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    contrastLevel: v.optional(v.string()),
    weatheringProfile: v.optional(v.string()),
    promptKeywords: v.optional(v.array(v.string())),
    negativeKeywords: v.optional(v.array(v.string())),
    recommendedMaterialSlugs: v.optional(v.array(v.string())),
    seoKeywords: v.optional(v.array(v.string())),
    systemPromptFragment: v.optional(v.string()),
    styleSpec: v.optional(v.union(vStyleSpec, v.null())),
    promptVersion: v.optional(v.string()),
    visibilityWeight: v.optional(v.number()),
    creatorUserId: v.optional(v.id("users")),
    isFeaturedStyle: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const preset = await ctx.db.get(args.stylePresetId);
    if (preset === null) {
      throw new Error("Style preset not found");
    }

    const patch: Partial<typeof preset> = {};
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.category !== undefined) {
      patch.category = args.category || undefined;
    }
    if (args.shortDescription !== undefined) {
      patch.shortDescription = args.shortDescription || undefined;
    }
    if (args.contrastLevel !== undefined) {
      patch.contrastLevel = args.contrastLevel || undefined;
    }
    if (args.weatheringProfile !== undefined) {
      patch.weatheringProfile = args.weatheringProfile || undefined;
    }
    if (args.promptKeywords !== undefined) {
      patch.promptKeywords = compactStringArray(args.promptKeywords);
    }
    if (args.negativeKeywords !== undefined) {
      patch.negativeKeywords = compactStringArray(args.negativeKeywords);
    }
    if (args.recommendedMaterialSlugs !== undefined) {
      patch.recommendedMaterialSlugs = compactStringArray(args.recommendedMaterialSlugs);
    }
    if (args.seoKeywords !== undefined) {
      patch.seoKeywords = compactStringArray(args.seoKeywords);
    }
    if (args.systemPromptFragment !== undefined) {
      patch.systemPromptFragment = args.systemPromptFragment || undefined;
    }
    if (args.styleSpec !== undefined) {
      patch.styleSpec = args.styleSpec ?? undefined;
    }
    if (args.promptVersion !== undefined) {
      patch.promptVersion = args.promptVersion || undefined;
    }
    if (args.visibilityWeight !== undefined) {
      patch.visibilityWeight = args.visibilityWeight;
    }
    if (args.creatorUserId !== undefined) {
      patch.creatorUserId = args.creatorUserId;
    }
    if (args.isFeaturedStyle !== undefined) {
      patch.isFeaturedStyle = args.isFeaturedStyle;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    patch.searchText = buildStylePresetSearchText({
      name: patch.name ?? preset.name,
      category: patch.category ?? preset.category,
      shortDescription: patch.shortDescription ?? preset.shortDescription,
      promptKeywords: patch.promptKeywords ?? preset.promptKeywords,
      seoKeywords: patch.seoKeywords ?? preset.seoKeywords,
    });

    await ctx.db.patch(args.stylePresetId, patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-style-preset",
      entityType: "stylePreset",
      entityId: args.stylePresetId,
      detailsJson: JSON.stringify({ stylePresetId: args.stylePresetId, isActive: patch.isActive }),
    });
  },
});

export const upsertStylePresetAdmin = mutation({
  args: {
    stylePresetId: v.optional(v.id("stylePresets")),
    name: v.string(),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    contrastLevel: v.optional(v.string()),
    weatheringProfile: v.optional(v.string()),
    promptKeywords: v.array(v.string()),
    negativeKeywords: v.array(v.string()),
    recommendedMaterialSlugs: v.array(v.string()),
    seoKeywords: v.array(v.string()),
    systemPromptFragment: v.optional(v.string()),
    styleSpec: vStyleSpec,
    promptVersion: v.optional(v.string()),
    visibilityWeight: v.optional(v.union(v.number(), v.null())),
    creatorUserId: v.optional(v.union(v.id("users"), v.null())),
    isFeaturedStyle: v.boolean(),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Style name is required");
    const styleSlug = slugify(args.slug?.trim() || name);
    const duplicate = await ctx.db
      .query("stylePresets")
      .withIndex("by_slug", (q) => q.eq("slug", styleSlug))
      .unique();
    if (duplicate && duplicate._id !== args.stylePresetId) {
      throw new Error(`Style slug "${styleSlug}" is already in use`);
    }
    const promptKeywords = compactStringArray(args.promptKeywords);
    const seoKeywords = compactStringArray(args.seoKeywords);
    const patch = {
      name,
      slug: styleSlug,
      category: args.category?.trim() || undefined,
      shortDescription: args.shortDescription?.trim() || undefined,
      contrastLevel: args.contrastLevel?.trim() || undefined,
      weatheringProfile: args.weatheringProfile?.trim() || undefined,
      promptKeywords,
      negativeKeywords: compactStringArray(args.negativeKeywords),
      recommendedMaterialSlugs: compactStringArray(args.recommendedMaterialSlugs),
      seoKeywords,
      systemPromptFragment: args.systemPromptFragment?.trim() || undefined,
      styleSpec: args.styleSpec,
      promptVersion: args.promptVersion?.trim() || undefined,
      visibilityWeight: args.visibilityWeight ?? undefined,
      creatorUserId: args.creatorUserId ?? undefined,
      isFeaturedStyle: args.isFeaturedStyle,
      isActive: args.isActive,
      searchText: buildStylePresetSearchText({
        name,
        category: args.category,
        shortDescription: args.shortDescription,
        promptKeywords,
        seoKeywords,
      }),
    };
    const stylePresetId = args.stylePresetId
      ? (await ctx.db.patch(args.stylePresetId, patch), args.stylePresetId)
      : await ctx.db.insert("stylePresets", patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.stylePresetId ? "update-style-preset" : "create-style-preset",
      entityType: "stylePreset",
      entityId: stylePresetId,
      detailsJson: JSON.stringify({ stylePresetId, slug: styleSlug, isActive: args.isActive }),
    });
    return stylePresetId;
  },
});

export const updateMaterialPreset = mutation({
  args: {
    materialPresetId: v.id("materialPresets"),
    name: v.optional(v.string()),
    finishType: v.optional(v.string()),
    reflectivityLevel: v.optional(v.string()),
    materialSpec: v.optional(v.union(vMaterialSpec, v.null())),
    promptKeywords: v.optional(v.array(v.string())),
    paintFinish: v.optional(v.string()),
    difficultyLevel: v.optional(v.string()),
    sheenLevel: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const preset = await ctx.db.get(args.materialPresetId);
    if (preset === null) {
      throw new Error("Material preset not found");
    }

    const patch: Partial<typeof preset> = {};
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.finishType !== undefined) {
      patch.finishType = args.finishType;
    }
    if (args.reflectivityLevel !== undefined) {
      patch.reflectivityLevel = args.reflectivityLevel || undefined;
    }
    if (args.materialSpec !== undefined) {
      patch.materialSpec = args.materialSpec ?? undefined;
    }
    if (args.promptKeywords !== undefined) {
      patch.promptKeywords = compactStringArray(args.promptKeywords);
    }
    if (args.paintFinish !== undefined) {
      patch.paintFinish = args.paintFinish || undefined;
    }
    if (args.difficultyLevel !== undefined) {
      patch.difficultyLevel = args.difficultyLevel || undefined;
    }
    if (args.sheenLevel !== undefined) {
      patch.sheenLevel = args.sheenLevel || undefined;
    }
    if (args.shortDescription !== undefined) {
      patch.shortDescription = args.shortDescription || undefined;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.materialPresetId, patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-material-preset",
      entityType: "materialPreset",
      entityId: args.materialPresetId,
      detailsJson: JSON.stringify({ materialPresetId: args.materialPresetId, isActive: patch.isActive }),
    });
  },
});

export const upsertMaterialPresetAdmin = mutation({
  args: {
    materialPresetId: v.optional(v.id("materialPresets")),
    name: v.string(),
    slug: v.optional(v.string()),
    finishType: v.string(),
    reflectivityLevel: v.optional(v.string()),
    materialSpec: vMaterialSpec,
    promptKeywords: v.array(v.string()),
    paintFinish: v.optional(v.string()),
    difficultyLevel: v.optional(v.string()),
    sheenLevel: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const name = args.name.trim();
    const finishType = args.finishType.trim();
    if (!name) throw new Error("Material name is required");
    if (!finishType) throw new Error("Finish type is required");
    const materialSlug = slugify(args.slug?.trim() || name);
    const duplicate = await ctx.db
      .query("materialPresets")
      .withIndex("by_slug", (q) => q.eq("slug", materialSlug))
      .unique();
    if (duplicate && duplicate._id !== args.materialPresetId) {
      throw new Error(`Material slug "${materialSlug}" is already in use`);
    }
    const patch = {
      name,
      slug: materialSlug,
      finishType,
      reflectivityLevel: args.reflectivityLevel?.trim() || undefined,
      materialSpec: args.materialSpec,
      promptKeywords: compactStringArray(args.promptKeywords),
      paintFinish: args.paintFinish?.trim() || undefined,
      difficultyLevel: args.difficultyLevel?.trim() || undefined,
      sheenLevel: args.sheenLevel?.trim() || undefined,
      shortDescription: args.shortDescription?.trim() || undefined,
      isActive: args.isActive,
    };
    const materialPresetId = args.materialPresetId
      ? (await ctx.db.patch(args.materialPresetId, patch), args.materialPresetId)
      : await ctx.db.insert("materialPresets", patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.materialPresetId ? "update-material-preset" : "create-material-preset",
      entityType: "materialPreset",
      entityId: materialPresetId,
      detailsJson: JSON.stringify({ materialPresetId, slug: materialSlug, isActive: args.isActive }),
    });
    return materialPresetId;
  },
});

export const updatePaintMapping = mutation({
  args: {
    paintMappingId: v.id("paintMappings"),
    brand: v.optional(v.string()),
    line: v.optional(v.string()),
    code: v.optional(v.string()),
    colorName: v.optional(v.string()),
    finishType: v.optional(v.string()),
    paintType: v.optional(v.string()),
    availabilityRegion: v.optional(v.string()),
    affiliateUrl: v.optional(v.string()),
    hexPreview: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const mapping = await ctx.db.get(args.paintMappingId);
    if (mapping === null) {
      throw new Error("Paint mapping not found");
    }

    const patch: Partial<typeof mapping> = {};
    if (args.brand !== undefined) {
      patch.brand = args.brand;
    }
    if (args.line !== undefined) {
      patch.line = args.line || undefined;
    }
    if (args.code !== undefined) {
      patch.code = args.code;
    }
    if (args.colorName !== undefined) {
      patch.colorName = args.colorName;
    }
    if (args.finishType !== undefined) {
      patch.finishType = args.finishType || undefined;
    }
    if (args.paintType !== undefined) {
      patch.paintType = args.paintType || undefined;
    }
    if (args.availabilityRegion !== undefined) {
      patch.availabilityRegion = args.availabilityRegion || undefined;
    }
    if (args.affiliateUrl !== undefined) {
      patch.affiliateUrl = args.affiliateUrl || undefined;
    }
    if (args.hexPreview !== undefined) {
      patch.hexPreview = args.hexPreview || undefined;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    patch.searchText = buildPaintMappingSearchText({
      brand: patch.brand ?? mapping.brand,
      line: patch.line ?? mapping.line,
      code: patch.code ?? mapping.code,
      colorName: patch.colorName ?? mapping.colorName,
      finishType: patch.finishType ?? mapping.finishType,
    });

    await ctx.db.patch(args.paintMappingId, patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-paint-mapping",
      entityType: "paintMapping",
      entityId: args.paintMappingId,
      detailsJson: JSON.stringify({ paintMappingId: args.paintMappingId, isActive: patch.isActive }),
    });
  },
});

export const upsertPaintMappingAdmin = mutation({
  args: {
    paintMappingId: v.optional(v.id("paintMappings")),
    mappingKey: v.optional(v.string()),
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
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const brand = args.brand.trim();
    const code = args.code.trim();
    const colorName = args.colorName.trim();
    if (!brand || !code || !colorName) {
      throw new Error("Brand, code, and color name are required");
    }
    const mappingKey = slugify(
      args.mappingKey?.trim() || [brand, args.line, code, colorName].filter(Boolean).join(" ")
    );
    const duplicate = await ctx.db
      .query("paintMappings")
      .withIndex("by_mappingKey", (q) => q.eq("mappingKey", mappingKey))
      .unique();
    if (duplicate && duplicate._id !== args.paintMappingId) {
      throw new Error(`Paint mapping key "${mappingKey}" is already in use`);
    }
    const hexPreview = args.hexPreview?.trim() || undefined;
    if (hexPreview && !/^#[0-9a-fA-F]{6}$/.test(hexPreview)) {
      throw new Error("Hex preview must use the format #RRGGBB");
    }
    const patch = {
      mappingKey,
      brand,
      line: args.line?.trim() || undefined,
      code,
      colorName,
      finishType: args.finishType?.trim() || undefined,
      paintType: args.paintType?.trim() || undefined,
      availabilityRegion: args.availabilityRegion?.trim() || undefined,
      affiliateUrl: args.affiliateUrl?.trim() || undefined,
      hexPreview,
      isActive: args.isActive,
      searchText: buildPaintMappingSearchText({
        brand,
        line: args.line,
        code,
        colorName,
        finishType: args.finishType,
      }),
    };
    const paintMappingId = args.paintMappingId
      ? (await ctx.db.patch(args.paintMappingId, patch), args.paintMappingId)
      : await ctx.db.insert("paintMappings", patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.paintMappingId ? "update-paint-mapping" : "create-paint-mapping",
      entityType: "paintMapping",
      entityId: paintMappingId,
      detailsJson: JSON.stringify({ paintMappingId, mappingKey, isActive: args.isActive }),
    });
    return paintMappingId;
  },
});

export const updateUserAccess = mutation({
  args: {
    userId: v.id("users"),
    planType: v.optional(vUserPlan),
    accountStatus: v.optional(vUserAccountStatus),
    isAdmin: v.optional(v.boolean()),
    isVerifiedCreator: v.optional(v.boolean()),
    isFeaturedCreator: v.optional(v.boolean()),
    creatorTagline: v.optional(v.string()),
    creatorSpecialties: v.optional(v.array(v.string())),
  },
  async handler(ctx, { userId, planType, accountStatus, isAdmin, isVerifiedCreator, isFeaturedCreator, creatorTagline, creatorSpecialties }) {
    const { viewer } = requireSuperAdmin(ctx);
    const user = await ctx.db.get(userId);

    if (user === null) {
      throw new Error("Target user not found");
    }

    const isEnvSuperAdmin = isSuperAdminEmail(user.email);
    if (isEnvSuperAdmin && isAdmin === false) {
      throw new Error("Environment-defined super admin cannot be demoted");
    }

    const patch: {
      accountStatus?: UserAccountStatus;
      isAdmin?: boolean;
      planType?: UserPlan;
      isVerifiedCreator?: boolean;
      isFeaturedCreator?: boolean;
      creatorTagline?: string;
      creatorSpecialties?: string[];
    } = {};
    if (planType !== undefined) {
      patch.planType = planType;
    }
    if (accountStatus !== undefined) {
      patch.accountStatus = accountStatus;
    }
    if (isEnvSuperAdmin) {
      patch.isAdmin = true;
    } else if (isAdmin !== undefined) {
      patch.isAdmin = isAdmin;
    }
    if (isVerifiedCreator !== undefined) {
      patch.isVerifiedCreator = isVerifiedCreator;
    }
    if (isFeaturedCreator !== undefined) {
      patch.isFeaturedCreator = isFeaturedCreator;
    }
    if (creatorTagline !== undefined) {
      patch.creatorTagline = creatorTagline || undefined;
    }
    if (creatorSpecialties !== undefined) {
      patch.creatorSpecialties = compactStringArray(creatorSpecialties);
    }

    await ctx.db.patch(userId, patch);

    const changedFields = Object.keys(patch);
    if (changedFields.length > 0) {
      await ctx.db.insert("userActivityEvents", {
        userId,
        eventType: "account-access-updated",
        entityType: "user",
        entityId: userId,
        summary: `Account access updated: ${changedFields.join(", ")}`,
        metadataJson: JSON.stringify(patch),
        occurredAt: Date.now(),
      });
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-user-access",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({
        targetUserId: userId,
        planType,
        accountStatus,
        isAdmin: patch.isAdmin,
        isVerifiedCreator: patch.isVerifiedCreator,
        isFeaturedCreator: patch.isFeaturedCreator,
      }),
    });
  },
});

export const updatePromptTemplate = mutation({
  args: {
    promptTemplateId: v.id("promptTemplates"),
    name: v.optional(v.string()),
    version: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    userPromptTemplate: v.optional(v.string()),
    negativePromptTemplate: v.optional(v.string()),
    notePolicy: v.optional(v.string()),
    kind: v.optional(vPromptTemplateKind),
    isActive: v.optional(v.boolean()),
  },
  async handler(
    ctx,
    {
      promptTemplateId,
      name,
      version,
      systemPrompt,
      userPromptTemplate,
      negativePromptTemplate,
      notePolicy,
      kind,
      isActive,
    }
  ) {
    const { viewer } = requireSuperAdmin(ctx);
    const template = await ctx.db.get(promptTemplateId);

    if (template === null) {
      throw new Error("Prompt template not found");
    }

    const patch: {
      isActive?: boolean;
      kind?: PromptTemplateKind;
      name?: string;
      negativePromptTemplate?: string;
      notePolicy?: string;
      systemPrompt?: string;
      userPromptTemplate?: string;
      version?: string;
    } = {};
    if (name !== undefined) {
      patch.name = name;
    }
    if (version !== undefined) {
      patch.version = version;
    }
    if (systemPrompt !== undefined) {
      patch.systemPrompt = systemPrompt;
    }
    if (userPromptTemplate !== undefined) {
      patch.userPromptTemplate = userPromptTemplate;
    }
    if (negativePromptTemplate !== undefined) {
      patch.negativePromptTemplate = negativePromptTemplate;
    }
    if (notePolicy !== undefined) {
      patch.notePolicy = notePolicy;
    }
    if (kind !== undefined) {
      patch.kind = kind;
    }
    if (isActive !== undefined) {
      patch.isActive = isActive;
    }

    await ctx.db.patch(promptTemplateId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-prompt-template",
      entityType: "promptTemplate",
      entityId: promptTemplateId,
      detailsJson: JSON.stringify({
        promptTemplateId,
        name,
        version,
        kind,
        isActive,
      }),
    });
  },
});

export const createPromptTemplateDraft = mutation({
  args: {
    promptTemplateId: v.id("promptTemplates"),
  },
  async handler(ctx, { promptTemplateId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const template = await ctx.db.get(promptTemplateId);
    if (template === null) {
      throw new Error("Prompt template not found");
    }

    await ensurePromptTemplateVersionHistory(ctx, template, viewer._id);
    const versions = await ctx.db
      .query("promptTemplateVersions")
      .withIndex("by_template", (q) => q.eq("promptTemplateId", promptTemplateId))
      .collect();
    const existingDraft = versions
      .filter((version) => version.status === "draft")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .at(0);
    if (existingDraft) {
      return { versionId: existingDraft._id, version: existingDraft.version, reused: true };
    }

    const published = versions.find((version) => version.status === "published");
    const now = Date.now();
    const version = nextPromptTemplateVersion(
      versions.map((item) => item.version),
      published?.version ?? template.version
    );
    const versionId = await ctx.db.insert("promptTemplateVersions", {
      promptTemplateId,
      version,
      status: "draft",
      systemPrompt: published?.systemPrompt ?? template.systemPrompt,
      userPromptTemplate: published?.userPromptTemplate ?? template.userPromptTemplate,
      negativePromptTemplate:
        published?.negativePromptTemplate ?? template.negativePromptTemplate,
      notePolicy: published?.notePolicy ?? template.notePolicy,
      createdAt: now,
      updatedAt: now,
      createdByUserId: viewer._id,
      updatedByUserId: viewer._id,
    });
    await ctx.db.patch(promptTemplateId, { updatedAt: now, updatedByUserId: viewer._id });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "create-prompt-template-draft",
      entityType: "promptTemplateVersion",
      entityId: versionId,
      detailsJson: JSON.stringify({ promptTemplateId, versionId, version }),
    });
    return { versionId, version, reused: false };
  },
});

export const updatePromptTemplateDraft = mutation({
  args: {
    promptTemplateVersionId: v.id("promptTemplateVersions"),
    systemPrompt: v.string(),
    userPromptTemplate: v.string(),
    negativePromptTemplate: v.optional(v.string()),
    notePolicy: v.optional(v.string()),
  },
  async handler(
    ctx,
    {
      promptTemplateVersionId,
      systemPrompt,
      userPromptTemplate,
      negativePromptTemplate,
      notePolicy,
    }
  ) {
    const { viewer } = requireSuperAdmin(ctx);
    const version = await ctx.db.get(promptTemplateVersionId);
    if (version === null) {
      throw new Error("Prompt template version not found");
    }
    if (version.status !== "draft") {
      throw new Error("Only draft versions can be edited");
    }
    validatePromptTemplateContent(systemPrompt, userPromptTemplate);
    const now = Date.now();
    await ctx.db.patch(promptTemplateVersionId, {
      systemPrompt,
      userPromptTemplate,
      negativePromptTemplate,
      notePolicy,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });
    await ctx.db.patch(version.promptTemplateId, {
      updatedAt: now,
      updatedByUserId: viewer._id,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-prompt-template-draft",
      entityType: "promptTemplateVersion",
      entityId: promptTemplateVersionId,
      detailsJson: JSON.stringify({
        promptTemplateId: version.promptTemplateId,
        promptTemplateVersionId,
        version: version.version,
        usedVariables: extractTemplateVariables(userPromptTemplate),
      }),
    });
    return {
      updatedAt: now,
      usedVariables: extractTemplateVariables(userPromptTemplate),
    };
  },
});

export const publishPromptTemplateVersion = mutation({
  args: {
    promptTemplateVersionId: v.id("promptTemplateVersions"),
  },
  async handler(ctx, { promptTemplateVersionId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const version = await ctx.db.get(promptTemplateVersionId);
    if (version === null) {
      throw new Error("Prompt template version not found");
    }
    if (version.status !== "draft") {
      throw new Error("Only a draft version can be published");
    }
    const template = await ctx.db.get(version.promptTemplateId);
    if (template === null) {
      throw new Error("Prompt template not found");
    }
    validatePromptTemplateContent(version.systemPrompt, version.userPromptTemplate);
    const availableVariableKeys = new Set(
      promptTemplateVariableDefinitions
        .filter((definition) => definition.kinds.includes(template.kind))
        .map((definition) => definition.key)
    );
    const unresolvedVariables = extractTemplateVariables(version.userPromptTemplate).filter(
      (variable) => !availableVariableKeys.has(variable)
    );
    if (unresolvedVariables.length > 0) {
      throw new Error(
        `Cannot publish with unsupported variables: ${unresolvedVariables
          .map((variable) => `{{${variable}}}`)
          .join(", ")}`
      );
    }

    const versions = await ctx.db
      .query("promptTemplateVersions")
      .withIndex("by_template", (q) => q.eq("promptTemplateId", template._id))
      .collect();
    const now = Date.now();
    for (const current of versions) {
      if (current.status === "published" && current._id !== promptTemplateVersionId) {
        await ctx.db.patch(current._id, {
          status: "archived",
          updatedAt: now,
          updatedByUserId: viewer._id,
        });
      }
    }
    await ctx.db.patch(promptTemplateVersionId, {
      status: "published",
      publishedAt: now,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });
    await ctx.db.patch(template._id, {
      version: version.version,
      systemPrompt: version.systemPrompt,
      userPromptTemplate: version.userPromptTemplate,
      negativePromptTemplate: version.negativePromptTemplate,
      notePolicy: version.notePolicy,
      isActive: true,
      publishedVersionId: promptTemplateVersionId,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "publish-prompt-template-version",
      entityType: "promptTemplateVersion",
      entityId: promptTemplateVersionId,
      detailsJson: JSON.stringify({
        promptTemplateId: template._id,
        promptTemplateVersionId,
        version: version.version,
      }),
    });
    return { publishedAt: now, version: version.version };
  },
});

export const archivePromptTemplateVersion = mutation({
  args: {
    promptTemplateVersionId: v.id("promptTemplateVersions"),
  },
  async handler(ctx, { promptTemplateVersionId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const version = await ctx.db.get(promptTemplateVersionId);
    if (version === null) {
      throw new Error("Prompt template version not found");
    }
    if (version.status === "published") {
      throw new Error("Published versions cannot be archived directly");
    }
    const now = Date.now();
    await ctx.db.patch(promptTemplateVersionId, {
      status: "archived",
      updatedAt: now,
      updatedByUserId: viewer._id,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "archive-prompt-template-version",
      entityType: "promptTemplateVersion",
      entityId: promptTemplateVersionId,
      detailsJson: JSON.stringify({
        promptTemplateId: version.promptTemplateId,
        promptTemplateVersionId,
        version: version.version,
      }),
    });
  },
});

export const updatePriceRule = mutation({
  args: {
    priceRuleId: v.id("creditPriceRules"),
    actionType: v.optional(vCreditActionType),
    label: v.optional(v.string()),
    creditCost: v.optional(v.number()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  async handler(
    ctx,
    { priceRuleId, actionType, label, creditCost, description, sortOrder, isActive }
  ) {
    const { viewer } = requireSuperAdmin(ctx);
    const rule = await ctx.db.get(priceRuleId);

    if (rule === null) {
      throw new Error("Price rule not found");
    }
    if (creditCost !== undefined && creditCost < 0) {
      throw new Error("Credit cost cannot be negative");
    }

    const patch: {
      actionType?: CreditActionType;
      creditCost?: number;
      description?: string;
      isActive?: boolean;
      label?: string;
      sortOrder?: number;
    } = {};
    if (actionType !== undefined) {
      patch.actionType = actionType;
    }
    if (label !== undefined) {
      patch.label = label;
    }
    if (creditCost !== undefined) {
      patch.creditCost = creditCost;
    }
    if (description !== undefined) {
      patch.description = description;
    }
    if (sortOrder !== undefined) {
      patch.sortOrder = sortOrder;
    }
    if (isActive !== undefined) {
      patch.isActive = isActive;
    }

    await ctx.db.patch(priceRuleId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-price-rule",
      entityType: "creditPriceRule",
      entityId: priceRuleId,
      detailsJson: JSON.stringify({
        priceRuleId,
        actionType,
        label,
        creditCost,
        isActive,
      }),
    });
  },
});

function requireTrimmedString(value: string, label: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function normalizeLlmSlug(value: string) {
  const slug = slugify(value);
  if (slug.length === 0) {
    throw new Error("Profile slug must include at least one ASCII letter or number");
  }
  return slug;
}

async function assertLlmProfileSlugAvailable(
  ctx: MutationCtx,
  slug: string,
  exceptProfileId?: Id<"llmProfiles">
) {
  const existing = await ctx.db
    .query("llmProfiles")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();

  if (existing !== null && existing._id !== exceptProfileId) {
    throw new Error("LLM profile slug is already in use");
  }
}

function normalizeLlmBaseUrl(value: string) {
  const trimmed = requireTrimmedString(value, "Base URL").replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Base URL must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Base URL must use http or https");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeEnvName(value: string) {
  const trimmed = requireTrimmedString(value, "API key env name");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error("API key env name must look like OPENAI_API_KEY");
  }
  return trimmed;
}

function normalizePriority(value?: number) {
  if (value === undefined) {
    return 0;
  }
  if (!Number.isFinite(value)) {
    throw new Error("Priority must be a finite number");
  }
  return Math.round(value);
}

function normalizeTimeoutMs(value?: number) {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value < 1000 || value > 300000) {
    throw new Error("Timeout must be between 1000 and 300000 milliseconds");
  }
  return Math.round(value);
}

function normalizeHeadersJson(value?: string) {
  const headers = parseOptionalJsonObject(value, "Headers");
  if (headers === undefined) {
    return undefined;
  }
  for (const [key, headerValue] of Object.entries(headers)) {
    if (key.trim().length === 0) {
      throw new Error("Header names cannot be blank");
    }
    if (typeof headerValue !== "string") {
      throw new Error("Header values must be strings");
    }
  }
  return JSON.stringify(headers);
}

function normalizeJsonObjectString(value: string | undefined, label: string) {
  const parsed = parseOptionalJsonObject(value, label);
  return parsed === undefined ? undefined : JSON.stringify(parsed);
}

function parseOptionalJsonObject(value: string | undefined, label: string) {
  const trimmed = cleanOptionalString(value);
  if (trimmed === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertBindingScope(
  generationKind?: GenerationKind,
  renderMode?: RenderMode
) {
  if (generationKind === "palette-plan" && renderMode !== undefined) {
    throw new Error("Render mode bindings only apply to hd-preview jobs");
  }
}

async function clearDefaultTemplateBindings(
  ctx: MutationCtx,
  promptTemplateId: Id<"promptTemplates">,
  viewerId: Id<"users">,
  updatedAt: number,
  exceptBindingId?: Id<"promptTemplateBindings">
) {
  const bindings = await ctx.db
    .query("promptTemplateBindings")
    .withIndex("by_template", (q) => q.eq("promptTemplateId", promptTemplateId))
    .collect();

  await Promise.all(
    bindings
      .filter((binding) => binding.isDefault && binding._id !== exceptBindingId)
      .map((binding) =>
        ctx.db.patch(binding._id, {
          isDefault: false,
          updatedAt,
          updatedByUserId: viewerId,
        })
      )
  );
}

function normalizeAdminSearch(value?: string) {
  return normalizeStringForSearch(value ?? "").trim().toLowerCase();
}

function compactStringArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function buildBaseModelSearchText(input: {
  name: string;
  series?: string;
  manufacturer?: string;
  primaryModelBrand?: string;
  grade?: string;
  scale?: string;
  releaseVersion?: string;
  silhouetteType?: string;
  complexityLevel?: string;
  panelDensity?: string;
  aliases: string[];
  tags: string[];
  promptAnchor?: string;
}) {
  return [
    input.name,
    input.series,
    input.primaryModelBrand ?? input.manufacturer,
    input.grade,
    input.scale,
    input.releaseVersion,
    input.silhouetteType,
    input.complexityLevel,
    input.panelDensity,
    input.promptAnchor,
    ...input.aliases,
    ...input.tags,
  ]
    .filter(Boolean)
    .join(" ");
}

async function updateKitVariantFields(
  ctx: MutationCtx,
  args: {
    kitVariantId: Id<"baseModels">;
    name?: string;
    series?: string;
    manufacturer?: string;
    primaryModelBrand?: string;
    grade?: string;
    scale?: string;
    releaseVersion?: string;
    silhouetteType?: string;
    complexityLevel?: string;
    panelDensity?: string;
    aliases?: string[];
    tags?: string[];
    thumbnailAssetKey?: string;
    defaultMaterialPresetId?: Id<"materialPresets">;
    promptAnchor?: string;
    status?: "active" | "prerelease" | "archived";
    isActive?: boolean;
    auditAction: string;
    auditEntityType: string;
  }
) {
  const { viewer } = requireSuperAdmin(ctx);
  const variant = await ctx.db.get(args.kitVariantId);
  if (variant === null) {
    throw new Error("Kit variant not found");
  }

  const patch: Partial<typeof variant> = {};
  if (args.name !== undefined) {
    patch.name = args.name;
  }
  if (args.series !== undefined) {
    patch.series = args.series;
  }
  if (args.manufacturer !== undefined) {
    patch.manufacturer = args.manufacturer;
  }
  if (args.primaryModelBrand !== undefined) {
    patch.primaryModelBrand = args.primaryModelBrand || undefined;
  }
  if (args.grade !== undefined) {
    patch.grade = args.grade;
  }
  if (args.scale !== undefined) {
    patch.scale = args.scale || undefined;
  }
  if (args.releaseVersion !== undefined) {
    patch.releaseVersion = args.releaseVersion || undefined;
  }
  if (args.silhouetteType !== undefined) {
    patch.silhouetteType = args.silhouetteType;
  }
  if (args.complexityLevel !== undefined) {
    patch.complexityLevel = args.complexityLevel;
  }
  if (args.panelDensity !== undefined) {
    patch.panelDensity = args.panelDensity || undefined;
  }
  if (args.aliases !== undefined) {
    patch.aliases = compactStringArray(args.aliases);
  }
  if (args.tags !== undefined) {
    patch.tags = compactStringArray(args.tags);
  }
  if (args.thumbnailAssetKey !== undefined) {
    patch.thumbnailAssetKey = args.thumbnailAssetKey || undefined;
  }
  if (args.defaultMaterialPresetId !== undefined) {
    patch.defaultMaterialPresetId = args.defaultMaterialPresetId;
  }
  if (args.promptAnchor !== undefined) {
    patch.promptAnchor = args.promptAnchor || undefined;
  }
  if (args.status !== undefined) {
    patch.status = args.status;
    patch.isActive = args.status === "active";
  }
  if (args.isActive !== undefined) {
    patch.isActive = args.isActive;
    patch.status = args.isActive ? "active" : "archived";
  }

  patch.searchText = buildBaseModelSearchText({
    name: patch.name ?? variant.name,
    series: patch.series ?? variant.series,
    manufacturer: patch.manufacturer ?? variant.manufacturer,
    primaryModelBrand: patch.primaryModelBrand ?? variant.primaryModelBrand ?? variant.manufacturer,
    grade: patch.grade ?? variant.grade,
    scale: patch.scale ?? variant.scale,
    releaseVersion: patch.releaseVersion ?? variant.releaseVersion,
    silhouetteType: patch.silhouetteType ?? variant.silhouetteType,
    complexityLevel: patch.complexityLevel ?? variant.complexityLevel,
    panelDensity: patch.panelDensity ?? variant.panelDensity,
    aliases: patch.aliases ?? variant.aliases,
    tags: patch.tags ?? variant.tags,
    promptAnchor: patch.promptAnchor ?? variant.promptAnchor,
  });

  await ctx.db.patch(args.kitVariantId, patch);
  await writeAdminAuditLog(ctx, {
    actorUserId: viewer._id,
    action: args.auditAction,
    entityType: args.auditEntityType,
    entityId: args.kitVariantId,
    detailsJson: JSON.stringify({
      kitVariantId: args.kitVariantId,
      baseModelId: args.kitVariantId,
      isActive: patch.isActive,
    }),
  });
}

function buildStylePresetSearchText(input: {
  name: string;
  category?: string;
  shortDescription?: string;
  promptKeywords: string[];
  seoKeywords: string[];
}) {
  return [
    input.name,
    input.category,
    input.shortDescription,
    ...input.promptKeywords,
    ...input.seoKeywords,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPaintMappingSearchText(input: {
  brand: string;
  line?: string;
  code: string;
  colorName: string;
  finishType?: string;
}) {
  return [input.brand, input.line, input.code, input.colorName, input.finishType]
    .filter(Boolean)
    .join(" ");
}

function buildCreatorPackSearchText(input: {
  name: string;
  tagline?: string;
  description?: string;
}) {
  return [input.name, input.tagline, input.description].filter(Boolean).join(" ");
}

async function composePromptLabPayload(
  ctx: MutationCtx | QueryCtx,
  input: {
    promptTemplateId: Id<"promptTemplates">;
    promptTemplateVersionId?: Id<"promptTemplateVersions">;
    baseModelId?: Id<"baseModels">;
    kitVariantId?: Id<"baseModels">;
    stylePresetId?: Id<"stylePresets">;
    materialPresetId?: Id<"materialPresets">;
    moodTags?: MoodTag[];
    weatheringLevel: "clean" | "light" | "heavy";
    notes?: string;
    conceptId?: string;
    remixSource?: string;
  }
) {
  const selectedKitVariantId = input.kitVariantId ?? input.baseModelId;
  const [
    template,
    templateVersion,
    kitVariant,
    stylePreset,
    materialPreset,
    colorRoles,
    paintMappings,
  ] = await Promise.all([
    ctx.db.get(input.promptTemplateId),
    input.promptTemplateVersionId ? ctx.db.get(input.promptTemplateVersionId) : null,
    selectedKitVariantId ? ctx.db.get(selectedKitVariantId) : null,
    input.stylePresetId ? ctx.db.get(input.stylePresetId) : null,
    input.materialPresetId ? ctx.db.get(input.materialPresetId) : null,
    ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
    ctx.db.query("paintMappings").collect(),
  ]);

  if (template === null) {
    throw new Error("Prompt template not found");
  }
  if (templateVersion !== null && templateVersion.promptTemplateId !== template._id) {
    throw new Error("Prompt template version does not belong to the selected template");
  }
  const promptSource = templateVersion ?? template;

  const sanitizedMoodTags = Array.from(new Set(input.moodTags ?? []));
  const sanitizedNotes = cleanOptionalString(input.notes);
  const modelPromptContext = await buildOptionalModelPromptContext(ctx, kitVariant);
  const conceptTitle = `${kitVariant?.name ?? "Unselected kit variant"} / ${
    stylePreset?.name ?? "Unselected Style DNA"
  } prompt lab`;
  const paintPlan =
    kitVariant && stylePreset && materialPreset
      ? buildPaintPlan({
          conceptTitle,
          baseModelName: kitVariant.name,
          stylePresetName: stylePreset.name,
          styleSlug: stylePreset.slug,
          materialPresetName: materialPreset.name,
          materialSlug: materialPreset.slug,
          moodTags: sanitizedMoodTags,
          weatheringLevel: input.weatheringLevel,
          colorRoles,
          paintMappings,
        })
      : null;
  const topPalette =
    paintPlan?.entries
      .slice(0, 6)
      .map((entry) =>
        entry.suggestedPaint
          ? `${entry.roleName}: ${entry.suggestedPaint.brand} ${entry.suggestedPaint.code} ${entry.suggestedPaint.colorName}`
          : `${entry.roleName}: no active mapping`
      )
      .join(" | ") ?? "No palette lock available.";
  const availableStyles = await ctx.db
    .query("stylePresets")
    .collect()
    .then((items) =>
      items
        .filter((preset) => preset.isActive)
        .map((preset) => preset.name)
        .sort((a, b) => a.localeCompare(b))
        .join(", ")
    );
  const values = {
    availableStyles,
    baseModel: modelPromptContext?.promptText ?? "Unselected kit variant",
    colorRoles: colorRoles.map((role) => role.name).join(", "),
    conceptId: input.conceptId?.trim() || "prompt-lab-manual-web",
    kitVariant: modelPromptContext?.promptText ?? "Unselected kit variant",
    materialPreset: materialPreset?.name ?? "Unselected material profile",
    mood: formatMoodTagsForPrompt(sanitizedMoodTags),
    notes: sanitizedNotes ?? "No extra notes.",
    remixSource: input.remixSource?.trim() || "",
    stylePreset: stylePreset?.name ?? "Unselected Style DNA",
    topPalette,
    weatheringLevel: input.weatheringLevel,
  };
  const composedPrompt = appendPromptFallbackLines(
    applyTemplate(promptSource.userPromptTemplate, values),
    promptSource.userPromptTemplate,
    {
      stylePreset: `Style DNA: ${values.stylePreset}`,
      materialPreset: `Material Profile: ${values.materialPreset}`,
      mood: `Mood Vector: ${values.mood}`,
      weatheringLevel: `Weathering: ${values.weatheringLevel}`,
      notes: `Operator notes: ${values.notes}`,
      topPalette: `Palette Lock: ${values.topPalette}`,
      colorRoles: `Priority color roles: ${values.colorRoles}`,
      remixSource: values.remixSource ? `Remix Source: ${values.remixSource}` : "",
    }
  );
  const negativePrompt = promptSource.negativePromptTemplate;
  const usedVariables = extractTemplateVariables(promptSource.userPromptTemplate);
  const availableVariables = Object.keys(values).sort();
  const unresolvedVariables = usedVariables.filter((variable) => !(variable in values));
  const emptySelectionWarnings = [
    kitVariant === null ? "Kit variant is not selected; prompt uses a placeholder value." : null,
    stylePreset === null ? "Style DNA is not selected; prompt uses a placeholder value." : null,
    materialPreset === null
      ? "Material profile is not selected; prompt uses a placeholder value."
      : null,
  ].filter((warning): warning is string => warning !== null);
  const warnings = [
    ...emptySelectionWarnings,
    ...unresolvedVariables.map((variable) => `Template variable {{${variable}}} is not supported by Prompt Lab.`),
  ];
  const inputSnapshot = {
    baseModel: modelPromptContext?.snapshot ?? null,
    kitVariant: modelPromptContext?.snapshot ?? null,
    stylePreset: stylePreset
      ? {
          id: stylePreset._id,
          name: stylePreset.name,
          slug: stylePreset.slug,
          category: stylePreset.category,
          promptKeywords: stylePreset.promptKeywords,
          negativeKeywords: stylePreset.negativeKeywords,
          systemPromptFragment: stylePreset.systemPromptFragment,
          promptVersion: stylePreset.promptVersion,
        }
      : null,
    materialPreset: materialPreset
      ? {
          id: materialPreset._id,
          name: materialPreset.name,
          slug: materialPreset.slug,
          finishType: materialPreset.finishType,
          promptKeywords: materialPreset.promptKeywords,
        }
      : null,
    moodTags: sanitizedMoodTags,
    weatheringLevel: input.weatheringLevel,
    notes: sanitizedNotes,
    conceptId: values.conceptId,
    remixSource: values.remixSource || undefined,
    paintPlan,
    values,
    usedVariables,
    availableVariables,
    warnings,
  };
  const templateSnapshot = {
    id: template._id,
    name: template.name,
    slug: template.slug,
    kind: template.kind,
    versionId: templateVersion?._id,
    version: promptSource.version,
    versionStatus: templateVersion?.status ?? "published",
    systemPrompt: promptSource.systemPrompt,
    userPromptTemplate: promptSource.userPromptTemplate,
    negativePromptTemplate: promptSource.negativePromptTemplate,
    notePolicy: promptSource.notePolicy,
    isActive: template.isActive,
  };

  return {
    template,
    templateVersionId: templateVersion?._id,
    templateSnapshot,
    inputSnapshot,
    composedPrompt,
    negativePrompt,
    warnings,
    usedVariables,
    availableVariables,
    copyBlocks: {
      systemPrompt: promptSource.systemPrompt,
      userPrompt: composedPrompt,
      negativePrompt: negativePrompt ?? "",
    },
  };
}

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function appendPromptFallbackLines(
  prompt: string,
  template: string,
  fallbackLinesByVariable: Record<string, string>
) {
  const appendedLines = Object.entries(fallbackLinesByVariable)
    .filter(([variable, line]) => !template.includes(`{{${variable}}}`) && line.trim().length > 0)
    .map(([, line]) => line);

  if (appendedLines.length === 0) {
    return prompt;
  }

  return `${prompt}\n${appendedLines.join("\n")}`;
}

async function ensurePromptTemplateVersionHistory(
  ctx: MutationCtx,
  template: Doc<"promptTemplates">,
  actorUserId: Id<"users">
) {
  const versions = await ctx.db
    .query("promptTemplateVersions")
    .withIndex("by_template", (q) => q.eq("promptTemplateId", template._id))
    .collect();
  const published = versions.find((version) => version.status === "published");
  if (published) {
    if (template.publishedVersionId !== published._id) {
      await ctx.db.patch(template._id, { publishedVersionId: published._id });
    }
    return published._id;
  }

  const now = Date.now();
  const publishedVersionId = await ctx.db.insert("promptTemplateVersions", {
    promptTemplateId: template._id,
    version: template.version,
    status: "published",
    systemPrompt: template.systemPrompt,
    userPromptTemplate: template.userPromptTemplate,
    negativePromptTemplate: template.negativePromptTemplate,
    notePolicy: template.notePolicy,
    createdAt: template._creationTime,
    updatedAt: template.updatedAt ?? now,
    publishedAt: template.updatedAt ?? template._creationTime,
    createdByUserId: template.updatedByUserId ?? actorUserId,
    updatedByUserId: template.updatedByUserId ?? actorUserId,
  });
  await ctx.db.patch(template._id, {
    publishedVersionId,
    updatedAt: template.updatedAt ?? now,
    updatedByUserId: template.updatedByUserId ?? actorUserId,
  });
  return publishedVersionId;
}

function nextPromptTemplateVersion(existingVersions: string[], fallback: string) {
  const parsed = [...existingVersions, fallback]
    .map((version) => /^p(\d+)\.v(\d+)/i.exec(version))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ major: Number(match[1]), minor: Number(match[2]) }))
    .sort((a, b) => b.major - a.major || b.minor - a.minor)
    .at(0);
  if (!parsed) {
    return `${fallback.replace(/\s+/g, "-")}-draft`;
  }
  return `p${parsed.major}.v${parsed.minor + 1}`;
}

function validatePromptTemplateContent(systemPrompt: string, userPromptTemplate: string) {
  if (systemPrompt.trim().length === 0) {
    throw new Error("System prompt cannot be empty");
  }
  if (userPromptTemplate.trim().length === 0) {
    throw new Error("User prompt template cannot be empty");
  }
}

function extractTemplateVariables(template: string) {
  return Array.from(template.matchAll(/\{\{(\w+)\}\}/g))
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b));
}

function formatMoodTagsForPrompt(moodTags: MoodTag[]) {
  if (moodTags.length === 0) {
    return "No mood vector selected.";
  }
  return moodTags.join(", ");
}

function cleanOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAdminFeedbackStatus(status: string) {
  return status === "triaged" ? "reviewing" as const : status as "open" | "reviewing" | "resolved" | "rejected";
}

function normalizeAdminFeedbackPriority(priority?: string | number) {
  if (typeof priority === "number") return priorityFromLegacyQueue(priority);
  if (priority === "low" || priority === "normal" || priority === "high") return priority;
  return "normal" as const;
}

function priorityFromLegacyQueue(priority?: number) {
  if (priority !== undefined && priority <= 10) return "high" as const;
  if (priority !== undefined && priority >= 30) return "low" as const;
  return "normal" as const;
}

function feedbackPriorityToQueue(priority: "low" | "normal" | "high") {
  return priority === "high" ? 10 : priority === "low" ? 30 : 20;
}

function inferAdminFeedbackSource(report: Doc<"feedbackReports">) {
  if (report.relatedGenerationJobId) return "generation-result" as const;
  if (report.conceptId) return "prototype" as const;
  return "standalone" as const;
}

function legacyFeedbackTitle(message: string) {
  const [firstLine] = message.split("\n");
  return firstLine.length <= 80 ? firstLine : "Feedback report";
}

function legacyFeedbackMessage(message: string) {
  const parts = message.split(/\n\s*\n/);
  return parts.length > 1 ? parts.slice(1).join("\n\n") : message;
}

function safeParseJson(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExperimentEvidence(input: {
  modelLabel?: string;
  outputImageUrl?: string;
  outputNotes?: string;
  overallScore?: number;
  providerLabel?: string;
}) {
  return Boolean(
    cleanOptionalString(input.providerLabel) ||
      cleanOptionalString(input.modelLabel) ||
      cleanOptionalString(input.outputImageUrl) ||
      cleanOptionalString(input.outputNotes) ||
      input.overallScore !== undefined
  );
}
