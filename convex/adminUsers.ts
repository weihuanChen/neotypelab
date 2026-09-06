import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { internalMutation, mutation, query } from "./functions";
import { vEntitlementGrantSource } from "./domain";
import { resolveEffectiveEntitlements } from "./entitlements";

const GIB = 1024 ** 3;

const vDirectoryFilter = v.union(
  v.literal("all"),
  v.literal("active"),
  v.literal("pro"),
  v.literal("flagged")
);

const vActivityFilter = v.union(
  v.literal("all"),
  v.literal("generation"),
  v.literal("concept"),
  v.literal("feedback"),
  v.literal("credits"),
  v.literal("account")
);

export const getDirectoryStats = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const activeThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      active: users.filter((user) => (user.lastActiveAt ?? user._creationTime) >= activeThreshold).length,
      pro: users.filter((user) => user.planType === "pro").length,
      suspended: users.filter((user) => user.accountStatus === "suspended").length,
      flagged: users.filter((user) => user.hasOpenFlag === true).length,
    };
  },
});

export const listDirectory = query({
  args: {
    search: v.optional(v.string()),
    filter: vDirectoryFilter,
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, { filter, paginationOpts, search }) {
    requireSuperAdmin(ctx);
    const normalizedSearch = search?.trim().toLowerCase();

    const result = normalizedSearch
      ? await searchDirectory(ctx, normalizedSearch, filter, paginationOpts)
      : filter === "active"
        ? await ctx.db.query("users").withIndex("by_accountStatus", (q) => q.eq("accountStatus", "active")).order("desc").paginate(paginationOpts)
        : filter === "pro"
          ? await ctx.db.query("users").withIndex("by_planType", (q) => q.eq("planType", "pro")).order("desc").paginate(paginationOpts)
          : filter === "flagged"
            ? await ctx.db.query("users").withIndex("by_hasOpenFlag", (q) => q.eq("hasOpenFlag", true)).order("desc").paginate(paginationOpts)
            : await ctx.db.query("users").order("desc").paginate(paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map(async (user) => {
        const account = await ctx.db
          .query("creditAccounts")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();
        return directoryUser(user, account?.balance ?? 0);
      })),
    };
  },
});

export const getOverview = query({
  args: { userId: v.id("users") },
  async handler(ctx, { userId }) {
    requireSuperAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const [account, concepts, jobs, reports, interactions, transactions, flags] = await Promise.all([
      ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", userId)).unique(),
      ctx.db.query("concepts").withIndex("by_user_status", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("generationJobs").withIndex("by_user_status", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("feedbackReports").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("conceptInteractions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("creditTransactions").withIndex("by_userId", (q) => q.eq("userId", userId)).order("desc").take(100),
      ctx.db.query("userFlags").withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "open")).collect(),
    ]);
    const activity = buildActivity({ concepts, jobs, reports, transactions, events: [] }).slice(0, 5);
    const positiveTransactions = transactions.filter((item) => item.delta > 0);

    return {
      user: inspectorUser(user),
      metrics: {
        credits: account?.balance ?? 0,
        concepts: concepts.length,
        generations: jobs.length,
        feedback: reports.length,
        saved: interactions.filter((item) => item.kind === "save").length,
        flags: flags.length,
      },
      creditSummary: {
        balance: account?.balance ?? 0,
        granted: positiveTransactions.reduce((sum, item) => sum + item.delta, 0),
        purchased: positiveTransactions.filter((item) => inferCreditSource(item) === "purchased").reduce((sum, item) => sum + item.delta, 0),
        promotional: positiveTransactions.filter((item) => ["promotional", "activation-code", "starter"].includes(inferCreditSource(item))).reduce((sum, item) => sum + item.delta, 0),
        spent: transactions.filter((item) => item.delta < 0).reduce((sum, item) => sum + Math.abs(item.delta), 0),
        lastTransaction: transactions[0] ? creditRow(transactions[0]) : null,
      },
      recentActivity: activity,
    };
  },
});

export const listActivity = query({
  args: { userId: v.id("users"), filter: vActivityFilter },
  async handler(ctx, { filter, userId }) {
    requireSuperAdmin(ctx);
    const [concepts, jobs, reports, transactions, events] = await Promise.all([
      ctx.db.query("concepts").withIndex("by_user_status", (q) => q.eq("userId", userId)).order("desc").take(100),
      ctx.db.query("generationJobs").withIndex("by_user_status", (q) => q.eq("userId", userId)).order("desc").take(100),
      ctx.db.query("feedbackReports").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(100),
      ctx.db.query("creditTransactions").withIndex("by_userId", (q) => q.eq("userId", userId)).order("desc").take(100),
      ctx.db.query("userActivityEvents").withIndex("by_user_occurredAt", (q) => q.eq("userId", userId)).order("desc").take(100),
    ]);
    return buildActivity({ concepts, jobs, reports, transactions, events })
      .filter((item) => filter === "all" || item.group === filter)
      .slice(0, 150);
  },
});

export const listCreditLedger = query({
  args: { userId: v.id("users") },
  async handler(ctx, { userId }) {
    requireSuperAdmin(ctx);
    const [account, transactions] = await Promise.all([
      ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", userId)).unique(),
      ctx.db.query("creditTransactions").withIndex("by_userId", (q) => q.eq("userId", userId)).order("desc").take(150),
    ]);
    return {
      balance: account?.balance ?? 0,
      transactions: transactions.map(creditRow),
    };
  },
});

export const listFeedback = query({
  args: { userId: v.id("users") },
  async handler(ctx, { userId }) {
    requireSuperAdmin(ctx);
    const reports = await ctx.db.query("feedbackReports").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(100);
    return reports.map((report) => ({
      _id: report._id,
      _creationTime: report._creationTime,
      recordNumber: report.recordNumber,
      category: report.category,
      status: report.status,
      title: report.title ?? report.message.split("\n")[0].slice(0, 90),
    }));
  },
});

export const listNotes = query({
  args: { userId: v.id("users") },
  async handler(ctx, { userId }) {
    requireSuperAdmin(ctx);
    const notes = await ctx.db.query("userAdminNotes").withIndex("by_user_createdAt", (q) => q.eq("userId", userId)).order("desc").take(100);
    return await Promise.all(notes.map(async (note) => {
      const author = await ctx.db.get(note.authorUserId);
      return {
        ...note,
        author: author ? { fullName: author.fullName, handle: author.handle } : null,
      };
    }));
  },
});

export const getEntitlementAccess = query({
  args: { userId: v.id("users") },
  async handler(ctx, { userId }) {
    requireSuperAdmin(ctx);
    if (!await ctx.db.get(userId)) return null;
    const now = Date.now();
    const [effective, grants] = await Promise.all([
      resolveEffectiveEntitlements(ctx, userId, now),
      ctx.db
        .query("accountEntitlementGrants")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(100),
    ]);
    return {
      effective,
      grants: grants.map((grant) => ({
        ...grant,
        active: grant.startsAt <= now && grant.revokedAt === undefined &&
          (grant.expiresAt === undefined || grant.expiresAt > now),
      })),
    };
  },
});

export const grantEntitlements = mutation({
  args: {
    userId: v.id("users"),
    sourceType: vEntitlementGrantSource,
    sourceReference: v.optional(v.string()),
    storageGb: v.number(),
    temporaryOriginalStorageGb: v.number(),
    pinnedOriginalStorageGb: v.number(),
    originalRetentionDays: v.number(),
    versionRetentionDays: v.number(),
    masterMaxDimensionPx: v.number(),
    exportMaxDimensionPx: v.number(),
    originalPermanentStorage: v.boolean(),
    originalDownloadAllowed: v.boolean(),
    originalPinAllowed: v.boolean(),
    batchDownloadAllowed: v.boolean(),
    expiresAt: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    if (!await ctx.db.get(args.userId)) throw new Error("Target user not found");
    if (args.sourceType === "subscription") {
      throw new Error("Subscription entitlements must be issued by the billing workflow");
    }
    const values = {
      libraryQuotaBytesDelta: requireGrantGb(args.storageGb, 1_000, "Library storage"),
      temporaryOriginalQuotaBytesDelta: requireGrantGb(args.temporaryOriginalStorageGb, 1_000, "Temporary Original storage"),
      pinnedOriginalQuotaBytesDelta: requireGrantGb(args.pinnedOriginalStorageGb, 1_000, "Pinned Original storage"),
      originalRetentionDays: requireGrantInteger(args.originalRetentionDays, 0, 3_650, "Original retention"),
      versionRetentionDays: requireGrantInteger(args.versionRetentionDays, 0, 3_650, "Version retention"),
      masterMaxDimensionPx: requireGrantDimension(args.masterMaxDimensionPx, "Master resolution"),
      exportMaxDimensionPx: requireGrantDimension(args.exportMaxDimensionPx, "Export resolution"),
    };
    if (
      Object.values(values).every((value) => value === 0) &&
      !args.originalPermanentStorage && !args.originalDownloadAllowed &&
      !args.originalPinAllowed && !args.batchDownloadAllowed
    ) {
      throw new Error("Choose at least one entitlement to grant");
    }
    if (args.expiresAt !== undefined && args.expiresAt <= Date.now()) {
      throw new Error("Grant expiry must be in the future");
    }
    const sourceReference = optionalGrantText(args.sourceReference, 120, "Source reference");
    const note = optionalGrantText(args.note, 1_000, "Grant note");
    if (sourceReference) {
      const duplicates = await ctx.db
        .query("accountEntitlementGrants")
        .withIndex("by_source", (q) =>
          q.eq("sourceType", args.sourceType).eq("sourceReference", sourceReference)
        )
        .collect();
      if (duplicates.length > 0) throw new Error("This source reference has already issued a grant");
    }
    const now = Date.now();
    const grantId = await ctx.db.insert("accountEntitlementGrants", {
      userId: args.userId,
      sourceType: args.sourceType,
      sourceReference,
      libraryQuotaBytesDelta: values.libraryQuotaBytesDelta || undefined,
      temporaryOriginalQuotaBytesDelta: values.temporaryOriginalQuotaBytesDelta || undefined,
      pinnedOriginalQuotaBytesDelta: values.pinnedOriginalQuotaBytesDelta || undefined,
      originalRetentionDays: values.originalRetentionDays || undefined,
      versionRetentionDays: values.versionRetentionDays || undefined,
      masterMaxDimensionPx: values.masterMaxDimensionPx || undefined,
      exportMaxDimensionPx: values.exportMaxDimensionPx || undefined,
      originalPermanentStorage: args.originalPermanentStorage || undefined,
      originalDownloadAllowed: args.originalDownloadAllowed || undefined,
      originalPinAllowed: args.originalPinAllowed || undefined,
      batchDownloadAllowed: args.batchDownloadAllowed || undefined,
      startsAt: now,
      expiresAt: args.expiresAt,
      note,
      createdByUserId: viewer._id,
      createdAt: now,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "grant-user-entitlements",
      entityType: "accountEntitlementGrant",
      entityId: grantId,
      detailsJson: JSON.stringify({ userId: args.userId, sourceType: args.sourceType, expiresAt: args.expiresAt, values }),
    });
    return grantId;
  },
});

export const revokeEntitlementGrant = mutation({
  args: { grantId: v.id("accountEntitlementGrants") },
  async handler(ctx, { grantId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const grant = await ctx.db.get(grantId);
    if (!grant) throw new Error("Entitlement grant not found");
    if (grant.revokedAt !== undefined) return;
    const revokedAt = Date.now();
    await ctx.db.patch(grantId, { revokedAt });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "revoke-user-entitlement-grant",
      entityType: "accountEntitlementGrant",
      entityId: grantId,
      detailsJson: JSON.stringify({ userId: grant.userId, revokedAt }),
    });
  },
});

export const addNote = mutation({
  args: { userId: v.id("users"), body: v.string() },
  async handler(ctx, { body, userId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const normalized = body.trim();
    if (normalized.length < 3 || normalized.length > 2000) throw new Error("Admin note must be between 3 and 2,000 characters");
    if (!await ctx.db.get(userId)) throw new Error("Target user not found");
    const noteId = await ctx.db.insert("userAdminNotes", {
      userId,
      authorUserId: viewer._id,
      body: normalized,
      createdAt: Date.now(),
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "add-user-admin-note",
      entityType: "user",
      entityId: userId,
      detailsJson: JSON.stringify({ noteId }),
    });
    return noteId;
  },
});

export const grantCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    reasonCode: v.string(),
    internalNote: v.optional(v.string()),
    campaignId: v.optional(v.id("creditCampaigns")),
    expiresAt: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    if (!Number.isInteger(args.amount) || args.amount < 1 || args.amount > 10000) throw new Error("Grant amount must be an integer between 1 and 10,000");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Target user not found");
    let account = await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique();
    if (!account) {
      const accountId = await ctx.db.insert("creditAccounts", { userId: args.userId, balance: 0, lifetimeGranted: 0, lifetimeSpent: 0, lastCreditEventAt: Date.now() });
      account = await ctx.db.get(accountId);
    }
    if (!account) throw new Error("Credit account could not be initialized");
    const balanceAfter = account.balance + args.amount;
    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeGranted: account.lifetimeGranted + args.amount,
      lastCreditEventAt: Date.now(),
    });
    const transactionId = await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      actionType: "admin-adjustment",
      delta: args.amount,
      creditAmount: args.amount,
      balanceAfter,
      referenceTable: "users",
      referenceId: args.userId,
      description: formatReason(args.reasonCode),
      sourceType: args.reasonCode === "early-pilot-reward" ? "promotional" : "admin-grant",
      reasonCode: args.reasonCode,
      operatorUserId: viewer._id,
      campaignId: args.campaignId,
      expiresAt: args.expiresAt,
      internalNote: args.internalNote?.trim() || undefined,
    });
    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "grant-user-credits",
      entityType: "user",
      entityId: args.userId,
      detailsJson: JSON.stringify({ transactionId, amount: args.amount, reasonCode: args.reasonCode, balanceAfter }),
    });
    return { transactionId, balanceAfter };
  },
});

export const backfillSearchData = internalMutation({
  args: {},
  async handler(ctx) {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.patch(user._id, {
        searchText: `${user.fullName} ${user.email} ${user.handle}`.toLowerCase(),
      });
    }
    return users.length;
  },
});

async function searchDirectory(
  ctx: Parameters<typeof requireSuperAdmin>[0],
  search: string,
  filter: "all" | "active" | "pro" | "flagged",
  paginationOpts: { numItems: number; cursor: string | null }
) {
  return await ctx.db.query("users").withSearchIndex("search_users", (q) => {
    const searched = q.search("searchText", search);
    if (filter === "active") return searched.eq("accountStatus", "active");
    if (filter === "pro") return searched.eq("planType", "pro");
    if (filter === "flagged") return searched.eq("hasOpenFlag", true);
    return searched;
  }).paginate(paginationOpts);
}

function directoryUser(user: Doc<"users">, balance: number) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    fullName: user.fullName,
    handle: user.handle,
    email: user.email,
    pictureUrl: user.pictureUrl,
    planType: user.planType,
    accountStatus: user.accountStatus,
    hasOpenFlag: user.hasOpenFlag ?? false,
    lastActiveAt: user.lastActiveAt ?? user._creationTime,
    creditBalance: balance,
  };
}

function requireGrantInteger(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requireGrantGb(value: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > max || Math.abs(Math.round(value * 100) - value * 100) > 1e-8) {
    throw new Error(`${label} must be between 0 and ${max} GB with at most two decimal places`);
  }
  return Math.round(value * GIB);
}

function requireGrantDimension(value: number, label: string) {
  if (value === 0) return 0;
  return requireGrantInteger(value, 512, 16_384, label);
}

function optionalGrantText(value: string | undefined, maxLength: number, label: string) {
  const normalized = value?.trim() || undefined;
  if (normalized && normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function inspectorUser(user: Doc<"users">) {
  return {
    ...directoryUser(user, 0),
    isAdmin: user.isAdmin,
    isVerifiedCreator: user.isVerifiedCreator ?? false,
    isFeaturedCreator: user.isFeaturedCreator ?? false,
  };
}

type ActivityInput = {
  concepts: Doc<"concepts">[];
  jobs: Doc<"generationJobs">[];
  reports: Doc<"feedbackReports">[];
  transactions: Doc<"creditTransactions">[];
  events: Doc<"userActivityEvents">[];
};

function buildActivity(input: ActivityInput) {
  const items = [
    ...input.jobs.map((job) => ({
      id: `generation-${job._id}`,
      occurredAt: job._creationTime,
      group: "generation" as const,
      type: "Generation",
      summary: job.status === "failed" ? "Generation failed" : job.status === "succeeded" ? "Generated repaint prototype" : "Requested generation",
      detail: `${formatWords(job.kind)} · ${formatWords(job.status)}`,
      entityType: "generation",
      entityId: job._id,
    })),
    ...input.concepts.map((concept) => ({
      id: `concept-${concept._id}`,
      occurredAt: concept._creationTime,
      group: "concept" as const,
      type: "Concept",
      summary: concept.sourceConceptId ? "Remixed prototype" : "Initialized concept",
      detail: concept.title,
      entityType: "concept",
      entityId: concept._id,
    })),
    ...input.reports.map((report) => ({
      id: `feedback-${report._id}`,
      occurredAt: report._creationTime,
      group: "feedback" as const,
      type: "Feedback",
      summary: `Submitted ${formatWords(report.category)} report`,
      detail: report.title ?? report.message.split("\n")[0].slice(0, 100),
      entityType: "feedback",
      entityId: report._id,
    })),
    ...input.transactions.map((transaction) => ({
      id: `credit-${transaction._id}`,
      occurredAt: transaction._creationTime,
      group: "credits" as const,
      type: "Credit",
      summary: `${transaction.delta > 0 ? "+" : ""}${transaction.delta} credits`,
      detail: transaction.description ?? formatWords(transaction.actionType),
      entityType: "credit",
      entityId: transaction._id,
    })),
    ...input.events.map((event) => ({
      id: `event-${event._id}`,
      occurredAt: event.occurredAt,
      group: "account" as const,
      type: "Account",
      summary: event.summary,
      detail: formatWords(event.eventType),
      entityType: event.entityType ?? "account",
      entityId: event.entityId,
    })),
  ];
  return items.sort((a, b) => b.occurredAt - a.occurredAt);
}

function creditRow(transaction: Doc<"creditTransactions">) {
  return {
    _id: transaction._id,
    _creationTime: transaction._creationTime,
    actionType: transaction.actionType,
    delta: transaction.delta,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description ?? formatWords(transaction.actionType),
    sourceType: transaction.sourceType ?? inferCreditSource(transaction),
    reasonCode: transaction.reasonCode,
    expiresAt: transaction.expiresAt,
  };
}

function inferCreditSource(transaction: Doc<"creditTransactions">) {
  if (transaction.sourceType) return transaction.sourceType;
  if (transaction.actionType === "starter-grant") return "starter";
  if (transaction.actionType === "campaign-code-redemption") return "activation-code";
  if (transaction.actionType === "generation-refund") return "refund";
  if (transaction.delta < 0) return "generation-spend";
  return transaction.actionType === "admin-adjustment" ? "admin-adjustment" : "admin-grant";
}

function formatWords(value: string) {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function formatReason(value: string) {
  return formatWords(value || "manual-adjustment");
}
