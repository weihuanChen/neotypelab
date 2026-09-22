import { internalMutation, query } from "./functions";
import { creditBuckets } from "./creditLedger";

export const viewerBalance = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return null;
    }

    const account = await ctx.db
      .query("creditAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .unique();

    const buckets = account ? creditBuckets(account) : {
      balance: 0,
      permanentBalance: 0,
      subscriptionBalance: 0,
    };
    return {
      balance: account?.balance ?? 0,
      permanentBalance: buckets.permanentBalance,
      subscriptionBalance: buckets.subscriptionBalance,
      subscriptionMonthlyAllowance: account?.subscriptionMonthlyAllowance ?? null,
      subscriptionBalanceCap: account?.subscriptionBalanceCap ?? null,
      subscriptionPlanType: account?.subscriptionPlanType ?? null,
      subscriptionPeriodEnd: account?.subscriptionPeriodEnd ?? null,
      subscriptionBalanceExpiresAt: account?.subscriptionBalanceExpiresAt ?? null,
      lifetimeGranted: account?.lifetimeGranted ?? 0,
      lifetimeSpent: account?.lifetimeSpent ?? 0,
      lastCreditEventAt: account?.lastCreditEventAt ?? null,
    };
  },
});

export const listPriceRules = query({
  args: {},
  async handler(ctx) {
    return (await ctx.db.query("creditPriceRules").withIndex("by_sortOrder").collect())
      .filter((rule) => rule.isActive)
      .map((rule) => ({
        _id: rule._id,
        actionType: rule.actionType,
        label: rule.label,
        generationKind: rule.generationKind,
        creditCost: rule.creditCost,
        description: rule.description,
      }));
  },
});

export const listViewerTransactions = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return [];
    }

    const transactions = await ctx.db
      .query("creditTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewerX()._id))
      .order("desc")
      .collect();

    return transactions.map((transaction) => ({
      _id: transaction._id,
      actionType: transaction.actionType,
      delta: transaction.delta,
      creditAmount: transaction.creditAmount,
      balanceAfter: transaction.balanceAfter,
      permanentDelta: transaction.permanentDelta ?? null,
      subscriptionDelta: transaction.subscriptionDelta ?? null,
      permanentBalanceAfter: transaction.permanentBalanceAfter ?? null,
      subscriptionBalanceAfter: transaction.subscriptionBalanceAfter ?? null,
      conceptId: transaction.conceptId,
      description: transaction.description,
      _creationTime: transaction._creationTime,
    }));
  },
});

export const migrateLegacyAccountBuckets = internalMutation({
  args: {},
  async handler(ctx) {
    const accounts = await ctx.db.query("creditAccounts").collect();
    const pending = accounts
      .filter((account) =>
        account.permanentBalance === undefined || account.subscriptionBalance === undefined
      )
      .slice(0, 200);
    for (const account of pending) {
      const buckets = creditBuckets(account);
      await ctx.db.patch(account._id, {
        balance: buckets.balance,
        permanentBalance: buckets.permanentBalance,
        subscriptionBalance: buckets.subscriptionBalance,
      });
    }
    return {
      migrated: pending.length,
      remaining: Math.max(0, accounts.filter((account) =>
        account.permanentBalance === undefined || account.subscriptionBalance === undefined
      ).length - pending.length),
    };
  },
});
