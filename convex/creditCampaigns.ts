import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { mutation, query } from "./functions";
import { MutationCtx } from "./types";

const MAX_CODE_BATCH_SIZE = 200;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const listAdminCampaigns = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [campaigns, codes, redemptions, users] = await Promise.all([
      ctx.db.query("creditCampaigns").collect(),
      ctx.db.query("creditActivationCodes").collect(),
      ctx.db.query("creditCodeRedemptions").collect(),
      ctx.db.query("users").collect(),
    ]);

    const userById = new Map(users.map((user) => [user._id, user]));
    const codesByCampaign = groupBy(codes, (code) => code.campaignId);
    const redemptionsByCampaign = groupBy(redemptions, (redemption) => redemption.campaignId);

    return campaigns
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((campaign) => {
        const campaignCodes = codesByCampaign.get(campaign._id) ?? [];
        const campaignRedemptions = redemptionsByCampaign.get(campaign._id) ?? [];
        const activeCodes = campaignCodes.filter(
          (code) => code.isActive && code.redemptionCount < code.maxRedemptions
        );

        return {
          _id: campaign._id,
          _creationTime: campaign._creationTime,
          name: campaign.name,
          description: campaign.description,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          defaultCreditAmount: campaign.defaultCreditAmount,
          maxRedemptions: campaign.maxRedemptions,
          perUserLimit: campaign.perUserLimit,
          totalRedemptions: campaign.totalRedemptions,
          isActive: campaign.isActive,
          lastGeneratedAt: campaign.lastGeneratedAt,
          codeCount: campaignCodes.length,
          activeCodeCount: activeCodes.length,
          codes: campaignCodes
            .sort((a, b) => b._creationTime - a._creationTime)
            .slice(0, 40)
            .map((code) => ({
              _id: code._id,
              _creationTime: code._creationTime,
              code: code.code,
              creditAmount: code.creditAmount,
              maxRedemptions: code.maxRedemptions,
              redemptionCount: code.redemptionCount,
              isActive: code.isActive,
              expiresAt: code.expiresAt,
              lastRedeemedAt: code.lastRedeemedAt,
            })),
          recentRedemptions: campaignRedemptions
            .sort((a, b) => b.redeemedAt - a.redeemedAt)
            .slice(0, 8)
            .map((redemption) => {
              const user = userById.get(redemption.userId);
              const code = campaignCodes.find((item) => item._id === redemption.activationCodeId);
              return {
                _id: redemption._id,
                redeemedAt: redemption.redeemedAt,
                creditAmount: redemption.creditAmount,
                balanceAfter: redemption.balanceAfter,
                code: code?.code ?? "Unknown code",
                user: user
                  ? {
                      _id: user._id,
                      fullName: user.fullName,
                      email: user.email,
                      handle: user.handle,
                    }
                  : null,
              };
            }),
        };
      });
  },
});

export const createCampaign = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    defaultCreditAmount: v.number(),
    maxRedemptions: v.optional(v.number()),
    perUserLimit: v.number(),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const name = normalizeRequiredText(args.name, "Campaign name", 80);
    const description = normalizeOptionalText(args.description, 500);

    validateCampaignWindow(args.startsAt, args.endsAt);
    validatePositiveInteger(args.defaultCreditAmount, "Default credit amount");
    validatePositiveInteger(args.perUserLimit, "Per-user limit");
    if (args.maxRedemptions !== undefined) {
      validatePositiveInteger(args.maxRedemptions, "Campaign redemption cap");
    }

    const campaignId = await ctx.db.insert("creditCampaigns", {
      name,
      description,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      defaultCreditAmount: args.defaultCreditAmount,
      maxRedemptions: args.maxRedemptions,
      perUserLimit: args.perUserLimit,
      totalRedemptions: 0,
      isActive: args.isActive,
      createdByUserId: viewer._id,
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "create-credit-campaign",
      entityType: "creditCampaign",
      entityId: campaignId,
      detailsJson: JSON.stringify({
        campaignId,
        name,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        defaultCreditAmount: args.defaultCreditAmount,
        maxRedemptions: args.maxRedemptions,
        perUserLimit: args.perUserLimit,
        isActive: args.isActive,
      }),
    });

    return { campaignId };
  },
});

export const updateCampaign = mutation({
  args: {
    campaignId: v.id("creditCampaigns"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    defaultCreditAmount: v.optional(v.number()),
    maxRedemptions: v.optional(v.number()),
    perUserLimit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (campaign === null) {
      throw new Error("Credit campaign not found");
    }

    const startsAt = args.startsAt ?? campaign.startsAt;
    const endsAt = args.endsAt ?? campaign.endsAt;
    validateCampaignWindow(startsAt, endsAt);

    const patch: {
      name?: string;
      description?: string;
      startsAt?: number;
      endsAt?: number;
      defaultCreditAmount?: number;
      maxRedemptions?: number;
      perUserLimit?: number;
      isActive?: boolean;
    } = {};

    if (args.name !== undefined) {
      patch.name = normalizeRequiredText(args.name, "Campaign name", 80);
    }
    if (args.description !== undefined) {
      patch.description = normalizeOptionalText(args.description, 500);
    }
    if (args.startsAt !== undefined) {
      patch.startsAt = args.startsAt;
    }
    if (args.endsAt !== undefined) {
      patch.endsAt = args.endsAt;
    }
    if (args.defaultCreditAmount !== undefined) {
      validatePositiveInteger(args.defaultCreditAmount, "Default credit amount");
      patch.defaultCreditAmount = args.defaultCreditAmount;
    }
    if (args.maxRedemptions !== undefined) {
      validatePositiveInteger(args.maxRedemptions, "Campaign redemption cap");
      if (args.maxRedemptions < campaign.totalRedemptions) {
        throw new Error("Campaign cap cannot be lower than existing redemptions");
      }
      patch.maxRedemptions = args.maxRedemptions;
    }
    if (args.perUserLimit !== undefined) {
      validatePositiveInteger(args.perUserLimit, "Per-user limit");
      patch.perUserLimit = args.perUserLimit;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.campaignId, patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "update-credit-campaign",
      entityType: "creditCampaign",
      entityId: args.campaignId,
      detailsJson: JSON.stringify({
        campaignId: args.campaignId,
        ...patch,
      }),
    });
  },
});

export const generateActivationCodes = mutation({
  args: {
    campaignId: v.id("creditCampaigns"),
    count: v.number(),
    creditAmount: v.optional(v.number()),
    maxRedemptionsPerCode: v.optional(v.number()),
    prefix: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (campaign === null) {
      throw new Error("Credit campaign not found");
    }

    validatePositiveInteger(args.count, "Code count");
    if (args.count > MAX_CODE_BATCH_SIZE) {
      throw new Error(`Cannot generate more than ${MAX_CODE_BATCH_SIZE} codes at once`);
    }

    const creditAmount = args.creditAmount ?? campaign.defaultCreditAmount;
    validatePositiveInteger(creditAmount, "Credit amount");

    const maxRedemptionsPerCode = args.maxRedemptionsPerCode ?? 1;
    validatePositiveInteger(maxRedemptionsPerCode, "Max redemptions per code");

    if (args.expiresAt !== undefined && args.expiresAt <= Date.now()) {
      throw new Error("Activation code expiry must be in the future");
    }

    const prefix = normalizeCodePrefix(args.prefix ?? "NTL");
    const generatedCodes: string[] = [];
    let attempts = 0;

    while (generatedCodes.length < args.count) {
      attempts++;
      if (attempts > args.count * 20) {
        throw new Error("Unable to generate enough unique activation codes");
      }

      const code = buildActivationCode(prefix);
      const normalizedCode = normalizeActivationCode(code);
      const existing = await ctx.db
        .query("creditActivationCodes")
        .withIndex("by_normalizedCode", (q) => q.eq("normalizedCode", normalizedCode))
        .unique();

      if (existing !== null) {
        continue;
      }

      await ctx.db.insert("creditActivationCodes", {
        campaignId: args.campaignId,
        code,
        normalizedCode,
        creditAmount,
        maxRedemptions: maxRedemptionsPerCode,
        redemptionCount: 0,
        isActive: true,
        expiresAt: args.expiresAt,
        createdByUserId: viewer._id,
      });
      generatedCodes.push(code);
    }

    await ctx.db.patch(args.campaignId, {
      lastGeneratedAt: Date.now(),
    });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "generate-credit-activation-codes",
      entityType: "creditCampaign",
      entityId: args.campaignId,
      detailsJson: JSON.stringify({
        campaignId: args.campaignId,
        count: args.count,
        creditAmount,
        maxRedemptionsPerCode,
        expiresAt: args.expiresAt,
      }),
    });

    return { codes: generatedCodes };
  },
});

export const setActivationCodeActive = mutation({
  args: {
    activationCodeId: v.id("creditActivationCodes"),
    isActive: v.boolean(),
  },
  async handler(ctx, { activationCodeId, isActive }) {
    const { viewer } = requireSuperAdmin(ctx);
    const activationCode = await ctx.db.get(activationCodeId);
    if (activationCode === null) {
      throw new Error("Activation code not found");
    }

    await ctx.db.patch(activationCodeId, { isActive });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: "set-credit-activation-code-active",
      entityType: "creditActivationCode",
      entityId: activationCodeId,
      detailsJson: JSON.stringify({
        activationCodeId,
        campaignId: activationCode.campaignId,
        isActive,
      }),
    });
  },
});

export const redeemActivationCode = mutation({
  args: {
    code: v.string(),
  },
  async handler(ctx, { code }) {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus !== "active") {
      throw new Error("Account is not active");
    }

    const normalizedCode = normalizeActivationCode(code);
    if (normalizedCode.length < 8) {
      throw new Error("Activation code is too short");
    }

    const activationCode = await ctx.db
      .query("creditActivationCodes")
      .withIndex("by_normalizedCode", (q) => q.eq("normalizedCode", normalizedCode))
      .unique();
    if (activationCode === null) {
      throw new Error("Activation code not found");
    }

    const campaign = await ctx.db.get(activationCode.campaignId);
    if (campaign === null) {
      throw new Error("Credit campaign not found");
    }

    const now = Date.now();
    if (!campaign.isActive) {
      throw new Error("Credit campaign is not active");
    }
    if (now < campaign.startsAt) {
      throw new Error("Credit campaign has not started");
    }
    if (now > campaign.endsAt) {
      throw new Error("Credit campaign has ended");
    }
    if (campaign.maxRedemptions !== undefined && campaign.totalRedemptions >= campaign.maxRedemptions) {
      throw new Error("Credit campaign redemption cap reached");
    }
    if (!activationCode.isActive) {
      throw new Error("Activation code is not active");
    }
    if (activationCode.expiresAt !== undefined && now > activationCode.expiresAt) {
      throw new Error("Activation code has expired");
    }
    if (activationCode.redemptionCount >= activationCode.maxRedemptions) {
      throw new Error("Activation code has already been fully redeemed");
    }

    const existingCodeRedemption = await ctx.db
      .query("creditCodeRedemptions")
      .withIndex("by_user_code", (q) =>
        q.eq("userId", viewer._id).eq("activationCodeId", activationCode._id)
      )
      .unique();
    if (existingCodeRedemption !== null) {
      throw new Error("Activation code has already been redeemed by this account");
    }

    const campaignRedemptions = await ctx.db
      .query("creditCodeRedemptions")
      .withIndex("by_user_campaign", (q) =>
        q.eq("userId", viewer._id).eq("campaignId", campaign._id)
      )
      .collect();
    if (campaignRedemptions.length >= campaign.perUserLimit) {
      throw new Error("Campaign redemption limit reached for this account");
    }

    const account = await ensureCreditAccount(ctx, viewer._id);
    const creditAmount = activationCode.creditAmount;
    const balanceAfter = account.balance + creditAmount;

    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeGranted: account.lifetimeGranted + creditAmount,
      lastCreditEventAt: now,
    });

    const transactionId = await ctx.db.insert("creditTransactions", {
      userId: viewer._id,
      actionType: "campaign-code-redemption",
      delta: creditAmount,
      creditAmount,
      balanceAfter,
      referenceTable: "creditActivationCodes",
      referenceId: activationCode._id,
      description: `Redeemed activation code for ${campaign.name}`,
      sourceType: "activation-code",
      reasonCode: "campaign-code-redemption",
      campaignId: campaign._id,
    });

    await ctx.db.insert("creditCodeRedemptions", {
      campaignId: campaign._id,
      activationCodeId: activationCode._id,
      userId: viewer._id,
      creditTransactionId: transactionId,
      creditAmount,
      balanceAfter,
      redeemedAt: now,
    });

    const nextCodeRedemptionCount = activationCode.redemptionCount + 1;
    await ctx.db.patch(activationCode._id, {
      redemptionCount: nextCodeRedemptionCount,
      lastRedeemedAt: now,
      isActive: nextCodeRedemptionCount < activationCode.maxRedemptions,
    });
    await ctx.db.patch(campaign._id, {
      totalRedemptions: campaign.totalRedemptions + 1,
    });

    return {
      campaignName: campaign.name,
      creditAmount,
      balanceAfter,
    };
  },
});

async function ensureCreditAccount(ctx: MutationCtx, userId: Id<"users">) {
  const account = await ctx.db
    .query("creditAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (account !== null) {
    return account;
  }

  const accountId = await ctx.db.insert("creditAccounts", {
    userId,
    balance: 0,
    lifetimeGranted: 0,
    lifetimeSpent: 0,
    lastCreditEventAt: Date.now(),
  });
  const createdAccount = await ctx.db.get(accountId);
  if (createdAccount === null) {
    throw new Error("Failed to initialize credit account");
  }
  return createdAccount;
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}

function normalizeActivationCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeCodePrefix(prefix: string) {
  const normalized = normalizeActivationCode(prefix).slice(0, 12);
  if (normalized.length < 2) {
    throw new Error("Code prefix must include at least two letters or numbers");
  }
  return normalized;
}

function buildActivationCode(prefix: string) {
  return `${prefix}-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

function randomSegment(length: number) {
  let segment = "";
  for (let index = 0; index < length; index++) {
    segment += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return segment;
}

function validateCampaignWindow(startsAt: number, endsAt: number) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error("Campaign dates must be valid timestamps");
  }
  if (endsAt <= startsAt) {
    throw new Error("Campaign end time must be after the start time");
  }
}

function validatePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new Error(`Description must be ${maxLength} characters or fewer`);
  }
  return normalized;
}
