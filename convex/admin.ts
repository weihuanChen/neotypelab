import { v } from "convex/values";
import { canManagePlatform, isSuperAdminEmail, requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import {
  CreditActionType,
  PromptTemplateKind,
  UserAccountStatus,
  UserPlan,
  vCreditActionType,
  vPromptTemplateKind,
  vUserAccountStatus,
  vUserPlan,
} from "./domain";
import { mutation, query } from "./functions";
import { normalizeStringForSearch, slugify } from "./utils";
import { getCreatorPackEngagementSnapshot } from "./packEngagement";

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

    return (await ctx.db.query("promptTemplates").collect())
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
      }));
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
        const [baseModel, stylePreset, concept, generationJob, queueItem] = await Promise.all([
          report.baseModelId ? ctx.db.get(report.baseModelId) : null,
          report.stylePresetId ? ctx.db.get(report.stylePresetId) : null,
          report.conceptId ? ctx.db.get(report.conceptId) : null,
          report.relatedGenerationJobId ? ctx.db.get(report.relatedGenerationJobId) : null,
          ctx.db
            .query("adminQueue")
            .withIndex("by_itemType_itemId", (q) =>
              q.eq("itemType", "feedback").eq("itemId", report._id)
            )
            .unique(),
        ]);

        return {
          _id: report._id,
          _creationTime: report._creationTime,
          category: report.category,
          status: report.status,
          message: report.message,
          sourcePage: report.sourcePage,
          adminNotes: report.adminNotes,
          reporter: userById.get(report.userId)
            ? {
                _id: report.userId,
                fullName: userById.get(report.userId)!.fullName,
                email: userById.get(report.userId)!.email,
                handle: userById.get(report.userId)!.handle,
              }
            : null,
          baseModel: baseModel
            ? {
                _id: baseModel._id,
                name: baseModel.name,
              }
            : null,
          stylePreset: stylePreset
            ? {
                _id: stylePreset._id,
                name: stylePreset.name,
              }
            : null,
          concept: concept
            ? {
                _id: concept._id,
                title: concept.title,
                status: concept.status,
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
      const queuePriorityA = a.queue?.priority ?? 999;
      const queuePriorityB = b.queue?.priority ?? 999;
      if (a.status !== b.status) {
        const weight = { open: 0, triaged: 1, resolved: 2 } as const;
        return weight[a.status] - weight[b.status];
      }
      if (queuePriorityA !== queuePriorityB) {
        return queuePriorityA - queuePriorityB;
      }
      return b._creationTime - a._creationTime;
    });
  },
});

export const listCatalogData = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [baseModels, stylePresets, materialPresets, paintMappings, creatorPacks] = await Promise.all([
      ctx.db.query("baseModels").collect(),
      ctx.db.query("stylePresets").collect(),
      ctx.db.query("materialPresets").collect(),
      ctx.db.query("paintMappings").collect(),
      ctx.db.query("creatorPacks").collect(),
    ]);

    return {
      baseModels: baseModels
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((model) => ({
          _id: model._id,
          name: model.name,
          slug: model.slug,
          series: model.series,
          manufacturer: model.manufacturer,
          grade: model.grade,
          silhouetteType: model.silhouetteType,
          complexityLevel: model.complexityLevel,
          aliases: model.aliases,
          tags: model.tags,
          thumbnailAssetKey: model.thumbnailAssetKey,
          defaultMaterialPresetId: model.defaultMaterialPresetId,
          isActive: model.isActive,
        })),
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

export const upsertCreatorPack = mutation({
  args: {
    creatorPackId: v.optional(v.id("creatorPacks")),
    name: v.string(),
    creatorUserId: v.id("users"),
    description: v.optional(v.string()),
    tagline: v.optional(v.string()),
    stylePresetIds: v.array(v.id("stylePresets")),
    baseModelIds: v.array(v.id("baseModels")),
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
    const patch = {
      name,
      slug,
      creatorUserId: args.creatorUserId,
      description: args.description || undefined,
      tagline: args.tagline || undefined,
      stylePresetIds: args.stylePresetIds,
      baseModelIds: args.baseModelIds,
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
    status: v.union(v.literal("open"), v.literal("triaged"), v.literal("resolved")),
    queueStatus: v.union(v.literal("open"), v.literal("in-review"), v.literal("done")),
    priority: v.optional(v.number()),
    assignToSelf: v.optional(v.boolean()),
  },
  async handler(ctx, { feedbackId, adminNotes, status, queueStatus, priority, assignToSelf }) {
    const { viewer } = requireSuperAdmin(ctx);
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

    await ctx.db.patch(feedbackId, {
      status,
      adminNotes,
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
        queuePatch.priority = priority;
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
        assignToSelf: Boolean(assignToSelf),
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
    grade: v.optional(v.string()),
    silhouetteType: v.optional(v.string()),
    complexityLevel: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    thumbnailAssetKey: v.optional(v.string()),
    defaultMaterialPresetId: v.optional(v.id("materialPresets")),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const model = await ctx.db.get(args.baseModelId);
    if (model === null) {
      throw new Error("Base model not found");
    }

    const patch: Partial<typeof model> = {};
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.series !== undefined) {
      patch.series = args.series;
    }
    if (args.manufacturer !== undefined) {
      patch.manufacturer = args.manufacturer;
    }
    if (args.grade !== undefined) {
      patch.grade = args.grade;
    }
    if (args.silhouetteType !== undefined) {
      patch.silhouetteType = args.silhouetteType;
    }
    if (args.complexityLevel !== undefined) {
      patch.complexityLevel = args.complexityLevel;
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
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    patch.searchText = buildBaseModelSearchText({
      name: patch.name ?? model.name,
      series: patch.series ?? model.series,
      manufacturer: patch.manufacturer ?? model.manufacturer,
      grade: patch.grade ?? model.grade,
      silhouetteType: patch.silhouetteType ?? model.silhouetteType,
      complexityLevel: patch.complexityLevel ?? model.complexityLevel,
      aliases: patch.aliases ?? model.aliases,
      tags: patch.tags ?? model.tags,
    });

    await ctx.db.patch(args.baseModelId, patch);
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-base-model",
      entityType: "baseModel",
      entityId: args.baseModelId,
      detailsJson: JSON.stringify({ baseModelId: args.baseModelId, isActive: patch.isActive }),
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

export const updateMaterialPreset = mutation({
  args: {
    materialPresetId: v.id("materialPresets"),
    name: v.optional(v.string()),
    finishType: v.optional(v.string()),
    reflectivityLevel: v.optional(v.string()),
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
  grade?: string;
  silhouetteType?: string;
  complexityLevel?: string;
  aliases: string[];
  tags: string[];
}) {
  return [
    input.name,
    input.series,
    input.manufacturer,
    input.grade,
    input.silhouetteType,
    input.complexityLevel,
    ...input.aliases,
    ...input.tags,
  ]
    .filter(Boolean)
    .join(" ");
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
