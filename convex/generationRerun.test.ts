import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { debitCredits } from "./creditLedger";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("generation job rerun", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  async function balance(userId: Id<"users">) {
    return t.run(async (ctx) =>
      (await ctx.db.query("creditAccounts").withIndex("by_userId", (q) => q.eq("userId", userId)).unique())?.balance
    );
  }

  /** A standalone render that was charged 5, failed, and was auto-refunded. */
  async function failedRefundedJob(userId: Id<"users">, fields: { creationRunId?: Id<"creationRuns"> } = {}) {
    const generationJobId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("generationJobs", {
        userId, kind: "hd-preview", status: "failed", requestedCredits: 5, ...fields,
      });
      await debitCredits(ctx, {
        userId, actionType: "generate-hd-render", amount: 5,
        metadata: { referenceTable: "generationJobs", referenceId: id, generationJobId: id, sourceType: "generation-spend" },
      });
      return id;
    });
    await t.mutation(internal.generation.refundFailedJobCredits, { generationJobId });
    return generationJobId;
  }

  it("rejects anonymous callers and other users' jobs", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "owner", email: "owner@example.test", balance: 20 });
    const other = await seedUser(t, { tokenIdentifier: "other", email: "other@example.test", balance: 20 });
    const generationJobId = await failedRefundedJob(owner.userId);

    await expect(t.action(api.generationNode.rerunJob, { generationJobId })).rejects.toThrow();
    await expect(other.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId }))
      .rejects.toThrow(/not found/);
    expect((await t.run((ctx) => ctx.db.get(generationJobId)))?.status).toBe("failed");
    expect(await balance(other.userId)).toBe(20);
  });

  it("charges a refunded job again, and a concurrent second retry is a no-op", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "owner", email: "owner@example.test", balance: 20 });
    const generationJobId = await failedRefundedJob(owner.userId);
    expect(await balance(owner.userId)).toBe(20);

    expect(await owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId }))
      .toEqual({ claimed: true });
    expect((await t.run((ctx) => ctx.db.get(generationJobId)))?.status).toBe("queued");
    expect(await balance(owner.userId)).toBe(15);

    expect(await owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId }))
      .toEqual({ claimed: false });
    expect(await balance(owner.userId)).toBe(15);
  });

  it("refunds a retry that fails again, exactly once", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "owner", email: "owner@example.test", balance: 20 });
    const generationJobId = await failedRefundedJob(owner.userId);
    await owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId });
    await t.run((ctx) => ctx.db.patch(generationJobId, { status: "failed" }));

    await t.mutation(internal.generation.refundFailedJobCredits, { generationJobId });
    await t.mutation(internal.generation.refundFailedJobCredits, { generationJobId });
    expect(await balance(owner.userId)).toBe(20);
  });

  it("does not charge again when the failed attempt was not refunded", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "owner", email: "owner@example.test", balance: 20 });
    const generationJobId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("generationJobs", {
        userId: owner.userId, kind: "hd-preview", status: "failed", requestedCredits: 5,
      });
      await debitCredits(ctx, {
        userId: owner.userId, actionType: "generate-hd-render", amount: 5,
        metadata: { referenceTable: "generationJobs", referenceId: id, generationJobId: id, sourceType: "generation-spend" },
      });
      return id;
    });
    await owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId });
    expect(await balance(owner.userId)).toBe(15);
  });

  it("refuses creation-run jobs, non-render jobs, and short balances", async () => {
    const owner = await seedUser(t, { tokenIdentifier: "owner", email: "owner@example.test", balance: 2 });
    const runJob = await t.run(async (ctx) => {
      const creationRunId = await ctx.db.insert("creationRuns", {
        userId: owner.userId, requestKey: "run", inputJson: "{}", inputKey: "run", status: "failed",
        stage: "render", cost: 5, attempt: 1, refunded: true, updatedAt: Date.now(),
      });
      return ctx.db.insert("generationJobs", {
        userId: owner.userId, kind: "hd-preview", status: "failed", requestedCredits: 0, creationRunId,
      });
    });
    await expect(owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId: runJob }))
      .rejects.toThrow(/preview run/);
    const textJob = await t.run((ctx) => ctx.db.insert("generationJobs", {
      userId: owner.userId, kind: "palette-plan", status: "failed", requestedCredits: 1,
    }));
    await expect(owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId: textJob }))
      .rejects.toThrow(/cannot be retried/);

    const renderJob = await t.run((ctx) => ctx.db.insert("generationJobs", {
      userId: owner.userId, kind: "hd-preview", status: "failed", requestedCredits: 5,
    }));
    await expect(owner.client.mutation(internal.generationRerun.claimJobRerun, { generationJobId: renderJob }))
      .rejects.toThrow(/Insufficient credits/);
    expect((await t.run((ctx) => ctx.db.get(renderJob)))?.status).toBe("failed");
  });
});
