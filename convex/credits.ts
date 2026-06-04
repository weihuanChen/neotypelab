import { query } from "./functions";

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

    return {
      balance: account?.balance ?? 0,
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
      conceptId: transaction.conceptId,
      description: transaction.description,
      _creationTime: transaction._creationTime,
    }));
  },
});
