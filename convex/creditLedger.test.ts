import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { debitCredits, refundCreditTransaction } from "./creditLedger";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("Credit bucket ledger", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("migrates legacy aggregate balances into permanent Credits", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "legacy-credit-account",
      email: "legacy-credits@example.test",
      balance: 37,
    });
    await t.run(async (ctx) => {
      const account = await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique();
      if (!account) throw new Error("Credit account missing");
      await ctx.db.patch(account._id, {
        permanentBalance: undefined,
        subscriptionBalance: undefined,
      });
    });

    await expect(t.mutation(internal.credits.migrateLegacyAccountBuckets, {})).resolves.toMatchObject({
      migrated: 1,
      remaining: 0,
    });
    const account = await t.run((ctx) => ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique());
    expect(account).toMatchObject({ balance: 37, permanentBalance: 37, subscriptionBalance: 0 });
  });

  it("makes source-aware refunds idempotent", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "idempotent-credit-refund",
      email: "refund@example.test",
      balance: 25,
    });
    const debit = await t.run((ctx) => debitCredits(ctx, {
      userId: user.userId,
      actionType: "generate-hd-render",
      amount: 5,
      metadata: { referenceTable: "tests", referenceId: "idempotent-refund" },
    }));

    const first = await t.run((ctx) => refundCreditTransaction(ctx, {
      debitTransactionId: debit.transactionId,
      actionType: "generation-refund",
      metadata: { referenceTable: "tests", referenceId: "idempotent-refund" },
    }));
    const second = await t.run((ctx) => refundCreditTransaction(ctx, {
      debitTransactionId: debit.transactionId,
      actionType: "generation-refund",
      metadata: { referenceTable: "tests", referenceId: "idempotent-refund" },
    }));

    expect(first.refunded).toBe(true);
    expect(second.refunded).toBe(false);
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", user.userId)).unique(),
      refunds: await ctx.db.query("creditTransactions").withIndex("by_refund_of", (q) => q.eq("refundOfTransactionId", debit.transactionId)).collect(),
    }));
    expect(state.account).toMatchObject({ balance: 25, permanentBalance: 25, subscriptionBalance: 0 });
    expect(state.refunds).toHaveLength(1);
  });
});
