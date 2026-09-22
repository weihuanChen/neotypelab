import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { CreditActionType, UserPlan } from "./domain";
import { SUBSCRIPTION_CREDIT_BALANCE_MULTIPLIER } from "@/lib/productPricing";

type CreditWriteCtx = Pick<MutationCtx, "db">;
type CreditSourceType = NonNullable<Doc<"creditTransactions">["sourceType"]>;

type TransactionMetadata = {
  generationJobId?: Id<"generationJobs">;
  conceptId?: Id<"concepts">;
  orderId?: Id<"orders">;
  referenceTable?: string;
  referenceId?: string;
  description?: string;
  sourceType?: CreditSourceType;
  reasonCode?: string;
  operatorUserId?: Id<"users">;
  campaignId?: Id<"creditCampaigns">;
  expiresAt?: number;
  internalNote?: string;
};

export type CreditBuckets = {
  permanentBalance: number;
  subscriptionBalance: number;
  balance: number;
};

export function creditBuckets(account: Doc<"creditAccounts">): CreditBuckets {
  if (account.permanentBalance === undefined && account.subscriptionBalance === undefined) {
    return {
      permanentBalance: account.balance,
      subscriptionBalance: 0,
      balance: account.balance,
    };
  }

  const subscriptionBalance = account.subscriptionBalance
    ?? Math.max(0, account.balance - (account.permanentBalance ?? 0));
  const permanentBalance = account.permanentBalance
    ?? Math.max(0, account.balance - subscriptionBalance);
  return {
    permanentBalance,
    subscriptionBalance,
    balance: permanentBalance + subscriptionBalance,
  };
}

export async function ensureCreditAccount(
  ctx: CreditWriteCtx,
  userId: Id<"users">
) {
  const existing = await ctx.db
    .query("creditAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;

  const accountId = await ctx.db.insert("creditAccounts", {
    userId,
    balance: 0,
    permanentBalance: 0,
    subscriptionBalance: 0,
    lifetimeGranted: 0,
    lifetimeSpent: 0,
    lastCreditEventAt: Date.now(),
  });
  const account = await ctx.db.get(accountId);
  if (!account) throw new Error("Credit account could not be initialized");
  return account;
}

export async function debitCredits(
  ctx: CreditWriteCtx,
  input: {
    userId: Id<"users">;
    actionType: CreditActionType;
    amount: number;
    metadata?: TransactionMetadata;
    insufficientMessage?: string;
  }
) {
  requirePositiveInteger(input.amount, "Credit debit");
  const account = await ensureCreditAccount(ctx, input.userId);
  const buckets = creditBuckets(account);
  if (buckets.balance < input.amount) {
    throw new Error(input.insufficientMessage ?? "Insufficient credits");
  }

  const subscriptionSpent = Math.min(buckets.subscriptionBalance, input.amount);
  const permanentSpent = input.amount - subscriptionSpent;
  const subscriptionBalance = buckets.subscriptionBalance - subscriptionSpent;
  const permanentBalance = buckets.permanentBalance - permanentSpent;
  const balanceAfter = permanentBalance + subscriptionBalance;
  const now = Date.now();

  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance,
    subscriptionBalance,
    lifetimeSpent: account.lifetimeSpent + input.amount,
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: input.actionType,
    delta: -input.amount,
    creditAmount: input.amount,
    balanceAfter,
    permanentDelta: -permanentSpent,
    subscriptionDelta: -subscriptionSpent,
    permanentBalanceAfter: permanentBalance,
    subscriptionBalanceAfter: subscriptionBalance,
    ...input.metadata,
  });
  return {
    accountId: account._id,
    transactionId,
    balanceAfter,
    permanentBalance,
    subscriptionBalance,
    permanentSpent,
    subscriptionSpent,
  };
}

export async function grantPermanentCredits(
  ctx: CreditWriteCtx,
  input: {
    userId: Id<"users">;
    actionType: CreditActionType;
    amount: number;
    metadata?: TransactionMetadata;
  }
) {
  requirePositiveInteger(input.amount, "Credit grant");
  const account = await ensureCreditAccount(ctx, input.userId);
  const buckets = creditBuckets(account);
  const permanentBalance = buckets.permanentBalance + input.amount;
  const balanceAfter = permanentBalance + buckets.subscriptionBalance;
  const now = Date.now();

  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance,
    subscriptionBalance: buckets.subscriptionBalance,
    lifetimeGranted: account.lifetimeGranted + input.amount,
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: input.actionType,
    delta: input.amount,
    creditAmount: input.amount,
    balanceAfter,
    permanentDelta: input.amount,
    subscriptionDelta: 0,
    permanentBalanceAfter: permanentBalance,
    subscriptionBalanceAfter: buckets.subscriptionBalance,
    ...input.metadata,
  });
  return {
    accountId: account._id,
    transactionId,
    balanceAfter,
    permanentBalance,
    subscriptionBalance: buckets.subscriptionBalance,
  };
}

export async function grantSubscriptionPeriodCredits(
  ctx: CreditWriteCtx,
  input: {
    userId: Id<"users">;
    subscriptionId: Id<"subscriptions">;
    planType: Exclude<UserPlan, "free">;
    amount: number;
    periodStart: number;
    periodEnd: number;
  }
) {
  requirePositiveInteger(input.amount, "Monthly Credit grant");
  const account = await ensureCreditAccount(ctx, input.userId);
  const buckets = creditBuckets(account);
  const cap = input.amount * SUBSCRIPTION_CREDIT_BALANCE_MULTIPLIER;
  const maximumRollover = Math.max(0, cap - input.amount);
  const rolledBalance = Math.min(buckets.subscriptionBalance, maximumRollover);
  const rolloverExpiredAmount = buckets.subscriptionBalance - rolledBalance;
  const subscriptionBalance = rolledBalance + input.amount;
  const balanceAfterExpiration = buckets.permanentBalance + rolledBalance;
  const balanceAfter = buckets.permanentBalance + subscriptionBalance;
  const now = Date.now();

  let expirationTransactionId: Id<"creditTransactions"> | null = null;
  if (rolloverExpiredAmount > 0) {
    expirationTransactionId = await ctx.db.insert("creditTransactions", {
      userId: input.userId,
      actionType: "subscription-credit-expiration",
      delta: -rolloverExpiredAmount,
      creditAmount: rolloverExpiredAmount,
      balanceAfter: balanceAfterExpiration,
      permanentDelta: 0,
      subscriptionDelta: -rolloverExpiredAmount,
      permanentBalanceAfter: buckets.permanentBalance,
      subscriptionBalanceAfter: rolledBalance,
      referenceTable: "subscriptions",
      referenceId: input.subscriptionId,
      description: "Subscription Credits above the rollover cap expired",
      sourceType: "subscription",
      reasonCode: "rollover-cap",
    });
  }

  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance: buckets.permanentBalance,
    subscriptionBalance,
    subscriptionMonthlyAllowance: input.amount,
    subscriptionBalanceCap: cap,
    subscriptionPlanType: input.planType,
    subscriptionPeriodEnd: input.periodEnd,
    subscriptionBalanceExpiresAt: undefined,
    lifetimeGranted: account.lifetimeGranted + input.amount,
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: "subscription-credit",
    delta: input.amount,
    creditAmount: input.amount,
    balanceAfter,
    permanentDelta: 0,
    subscriptionDelta: input.amount,
    permanentBalanceAfter: buckets.permanentBalance,
    subscriptionBalanceAfter: subscriptionBalance,
    referenceTable: "subscriptions",
    referenceId: input.subscriptionId,
    description: "Subscription monthly Credits",
    sourceType: "subscription",
  });
  return {
    accountId: account._id,
    transactionId,
    expirationTransactionId,
    rolloverExpiredAmount,
    balanceAfter,
    permanentBalance: buckets.permanentBalance,
    subscriptionBalance,
    subscriptionBalanceCap: cap,
  };
}

export async function setSubscriptionBalanceExpiration(
  ctx: CreditWriteCtx,
  userId: Id<"users">,
  expiresAt: number | undefined
) {
  const account = await ensureCreditAccount(ctx, userId);
  const buckets = creditBuckets(account);
  await ctx.db.patch(account._id, {
    balance: buckets.balance,
    permanentBalance: buckets.permanentBalance,
    subscriptionBalance: buckets.subscriptionBalance,
    subscriptionBalanceExpiresAt: expiresAt,
  });
}

export async function expireSubscriptionCredits(
  ctx: CreditWriteCtx,
  input: {
    userId: Id<"users">;
    subscriptionId: Id<"subscriptions">;
    reasonCode: "subscription-ended" | "subscription-refunded";
  }
) {
  const account = await ensureCreditAccount(ctx, input.userId);
  const buckets = creditBuckets(account);
  if (buckets.subscriptionBalance === 0) {
    return { accountId: account._id, transactionId: null, balanceAfter: buckets.balance, expiredAmount: 0 };
  }

  const expiredAmount = buckets.subscriptionBalance;
  const balanceAfter = buckets.permanentBalance;
  const now = Date.now();
  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance: buckets.permanentBalance,
    subscriptionBalance: 0,
    subscriptionBalanceExpiresAt: now,
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: "subscription-credit-expiration",
    delta: -expiredAmount,
    creditAmount: expiredAmount,
    balanceAfter,
    permanentDelta: 0,
    subscriptionDelta: -expiredAmount,
    permanentBalanceAfter: buckets.permanentBalance,
    subscriptionBalanceAfter: 0,
    referenceTable: "subscriptions",
    referenceId: input.subscriptionId,
    description: input.reasonCode === "subscription-refunded"
      ? "Subscription Credits expired after refund"
      : "Subscription Credits expired after paid access ended",
    sourceType: "subscription",
    reasonCode: input.reasonCode,
  });
  return { accountId: account._id, transactionId, balanceAfter, expiredAmount };
}

export async function refundCreditTransaction(
  ctx: CreditWriteCtx,
  input: {
    debitTransactionId: Id<"creditTransactions">;
    actionType: "generation-refund" | "keep-original-refund";
    metadata?: TransactionMetadata;
  }
) {
  const debit = await ctx.db.get(input.debitTransactionId);
  if (!debit || debit.delta >= 0) throw new Error("Credit debit transaction not found");
  const existing = await ctx.db
    .query("creditTransactions")
    .withIndex("by_refund_of", (q) => q.eq("refundOfTransactionId", debit._id))
    .unique();
  if (existing) {
    return {
      transactionId: existing._id,
      balanceAfter: existing.balanceAfter,
      refunded: false,
    };
  }

  const account = await ensureCreditAccount(ctx, debit.userId);
  const buckets = creditBuckets(account);
  const originalSubscriptionAmount = Math.max(0, -(debit.subscriptionDelta ?? 0));
  const originalPermanentAmount = Math.max(
    0,
    -(debit.permanentDelta ?? (debit.delta - (debit.subscriptionDelta ?? 0)))
  );
  const subscriptionExpired = account.subscriptionBalanceExpiresAt !== undefined
    && account.subscriptionBalanceExpiresAt <= Date.now();
  const subscriptionRefund = subscriptionExpired ? 0 : originalSubscriptionAmount;
  const permanentRefund = originalPermanentAmount
    + (subscriptionExpired ? originalSubscriptionAmount : 0);
  const permanentBalance = buckets.permanentBalance + permanentRefund;
  const subscriptionBalance = buckets.subscriptionBalance + subscriptionRefund;
  const amount = permanentRefund + subscriptionRefund;
  const balanceAfter = permanentBalance + subscriptionBalance;
  const now = Date.now();

  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance,
    subscriptionBalance,
    lifetimeSpent: Math.max(0, account.lifetimeSpent - amount),
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: debit.userId,
    actionType: input.actionType,
    delta: amount,
    creditAmount: amount,
    balanceAfter,
    permanentDelta: permanentRefund,
    subscriptionDelta: subscriptionRefund,
    permanentBalanceAfter: permanentBalance,
    subscriptionBalanceAfter: subscriptionBalance,
    refundOfTransactionId: debit._id,
    sourceType: "refund",
    ...input.metadata,
  });
  return { transactionId, balanceAfter, refunded: true };
}

export async function refundUnlinkedCredits(
  ctx: CreditWriteCtx,
  input: {
    userId: Id<"users">;
    actionType: "generation-refund" | "keep-original-refund";
    amount: number;
    metadata?: TransactionMetadata;
  }
) {
  requirePositiveInteger(input.amount, "Credit refund");
  const account = await ensureCreditAccount(ctx, input.userId);
  const buckets = creditBuckets(account);
  const permanentBalance = buckets.permanentBalance + input.amount;
  const balanceAfter = permanentBalance + buckets.subscriptionBalance;
  const now = Date.now();
  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    permanentBalance,
    subscriptionBalance: buckets.subscriptionBalance,
    lifetimeSpent: Math.max(0, account.lifetimeSpent - input.amount),
    lastCreditEventAt: now,
  });
  const transactionId = await ctx.db.insert("creditTransactions", {
    userId: input.userId,
    actionType: input.actionType,
    delta: input.amount,
    creditAmount: input.amount,
    balanceAfter,
    permanentDelta: input.amount,
    subscriptionDelta: 0,
    permanentBalanceAfter: permanentBalance,
    subscriptionBalanceAfter: buckets.subscriptionBalance,
    sourceType: "refund",
    ...input.metadata,
  });
  return { transactionId, balanceAfter, refunded: true };
}

export async function findDebitByReference(
  ctx: CreditWriteCtx,
  referenceTable: string,
  referenceId: string
) {
  const transactions = await ctx.db
    .query("creditTransactions")
    .withIndex("by_reference", (q) =>
      q.eq("referenceTable", referenceTable).eq("referenceId", referenceId)
    )
    .collect();
  return transactions.find((transaction) => transaction.delta < 0) ?? null;
}

export async function findDebitByGenerationJob(
  ctx: CreditWriteCtx,
  userId: Id<"users">,
  generationJobId: Id<"generationJobs">
) {
  const transactions = await ctx.db
    .query("creditTransactions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return transactions.find((transaction) =>
    transaction.generationJobId === generationJobId && transaction.delta < 0
  ) ?? null;
}

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}
