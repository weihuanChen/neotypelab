import { v } from "convex/values";
import { failComposition } from "./creativePipeline";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./functions";
import { internalMutation as systemMutation } from "./_generated/server";
import { styleIntentSchema, styleInterpreterSystemPrompt, styleInterpreterUserPromptTemplate, type StyleIntent } from "./creativeContracts";

const version = "style-interpreter.v1";
export type InterpretationResult = {
  promptCompositionId: string;
  intent: StyleIntent;
  sourceDescription: string;
  model: string;
  profileId: string;
  creditCost: number;
};
type Snapshot = {
  kind: string;
  inputKey: string;
  description: string;
  systemPrompt: string;
  templateVersion: string;
};

function normalizedDescription(description: string) {
  const value = description.trim();
  if (!value || value.length > 2000) throw new Error("Style description must be between 1 and 2000 characters");
  return value;
}

export const begin = internalMutation({
  args: { description: v.string(), requestKey: v.string() },
  handler: async (ctx, args) => {
    const viewer = ctx.viewerX();
    if (viewer.accountStatus === "suspended") throw new Error("Account is suspended");
    const description = normalizedDescription(args.description);
    if (!args.requestKey.trim() || args.requestKey.length > 120) throw new Error("Invalid request key");
    const inputKey = JSON.stringify({ version, description });
    const existing = await ctx.db.query("promptCompositions").withIndex("by_user_request", q =>
      q.eq("userId", viewer._id).eq("requestKey", args.requestKey)).unique();
    if (existing) {
      const snapshot = JSON.parse(existing.inputSnapshotJson) as Snapshot;
      if (snapshot.kind !== "style-interpreter" || snapshot.inputKey !== inputKey) throw new Error("Request key belongs to different creative inputs");
      return existing._id;
    }
    const rows = await ctx.db.query("promptCompositions").withIndex("by_userId", q => q.eq("userId", viewer._id)).collect();
    if (rows.filter(row => row.status === "ready" && row.reservedCredits !== undefined).length >= 2) throw new Error("Two text generations are already active");
    // Reuse the existing text suggestion tariff and route; no new pricing defaults.
    const price = (await ctx.db.query("creditPriceRules").withIndex("by_actionType", q =>
      q.eq("actionType", "generate-style-suggestion")).collect()).find(row => row.isActive);
    const account = await ctx.db.query("creditAccounts").withIndex("by_userId", q => q.eq("userId", viewer._id)).unique();
    if (!price || !account || account.balance < price.creditCost) throw new Error("Insufficient credits or missing active style interpretation price");
    const snapshot: Snapshot = { kind: "style-interpreter", inputKey, description, systemPrompt: styleInterpreterSystemPrompt, templateVersion: version };
    const id = await ctx.db.insert("promptCompositions", {
      userId: viewer._id, requestKey: args.requestKey, reservedCredits: price.creditCost, status: "ready",
      composedPrompt: styleInterpreterUserPromptTemplate.replace("{{description}}", description),
      inputSnapshotJson: JSON.stringify(snapshot),
    });
    const balance = account.balance - price.creditCost;
    await ctx.db.patch(account._id, { balance, lifetimeSpent: account.lifetimeSpent + price.creditCost, lastCreditEventAt: Date.now() });
    await ctx.db.insert("creditTransactions", {
      userId: viewer._id, actionType: "generate-style-suggestion", delta: -price.creditCost,
      creditAmount: price.creditCost, balanceAfter: balance, referenceTable: "promptCompositions",
      referenceId: id, description: "Reserved Custom Style interpretation",
    });
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.creativePipeline.failStale, { promptCompositionId: id });
    return id;
  },
});

export const claim = internalMutation({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }) => {
    const row = await ctx.db.get(promptCompositionId);
    if (!row || row.userId !== ctx.viewerX()._id) throw new Error("Interpretation not found");
    const snapshot = JSON.parse(row.inputSnapshotJson) as Snapshot;
    if (snapshot.kind !== "style-interpreter") throw new Error("Not a style interpretation");
    if (row.status !== "ready" || row.executionStartedAt) return null;
    if (Date.now() >= row._creationTime + 15 * 60 * 1000) {
      await failComposition(ctx, row._id, "Interpretation expired");
      return null;
    }
    await ctx.db.patch(row._id, { executionStartedAt: Date.now() });
    return { systemPrompt: snapshot.systemPrompt, userPrompt: row.composedPrompt };
  },
});

export const complete = systemMutation({
  args: { promptCompositionId: v.id("promptCompositions"), responseJson: v.string(), executionJson: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.promptCompositionId);
    if (!row || row.status !== "ready" || !row.executionStartedAt) return;
    const snapshot = JSON.parse(row.inputSnapshotJson) as Snapshot;
    if (snapshot.kind !== "style-interpreter") throw new Error("Not a style interpretation");
    if (Date.now() >= row._creationTime + 15 * 60 * 1000) throw new Error("Interpretation expired");
    const intent = styleIntentSchema.parse(JSON.parse(args.responseJson));
    if (intent.source !== "private" || intent.styleType !== "custom") throw new Error("Interpreter must return a private custom style");
    const execution = JSON.parse(args.executionJson) as { model?: string; profileId?: string };
    await ctx.db.patch(row._id, {
      status: "consumed", outputSummaryJson: JSON.stringify({ intent, model: execution.model ?? "", profileId: execution.profileId ?? "", execution }),
    });
  },
});

function resultFromRow(row: { _id: string; inputSnapshotJson: string; outputSummaryJson?: string; reservedCredits?: number }): InterpretationResult {
  const snapshot = JSON.parse(row.inputSnapshotJson) as Snapshot;
  const output = JSON.parse(row.outputSummaryJson ?? "{}") as { intent: unknown; model: string; profileId: string };
  return {
    promptCompositionId: row._id, intent: styleIntentSchema.parse(output.intent),
    sourceDescription: snapshot.description, model: output.model, profileId: output.profileId, creditCost: row.reservedCredits ?? 0,
  };
}
export const result = internalQuery({
  args: { promptCompositionId: v.id("promptCompositions") },
  handler: async (ctx, { promptCompositionId }): Promise<InterpretationResult> => {
    const row = await ctx.db.get(promptCompositionId);
    if (!row || row.userId !== ctx.viewerX()._id || JSON.parse(row.inputSnapshotJson).kind !== "style-interpreter") throw new Error("Interpretation not found");
    if (row.status !== "consumed") throw new Error(row.failureReason ?? "Interpretation is running. Retry the same request shortly.");
    return resultFromRow(row);
  },
});
export const latest = query({
  args: { description: v.string() },
  handler: async (ctx, { description }): Promise<InterpretationResult | null> => {
    if (!ctx.viewer || !description.trim() || description.trim().length > 2000) return null;
    const inputKey = JSON.stringify({ version, description: description.trim() });
    const rows = await ctx.db.query("promptCompositions").withIndex("by_userId", q => q.eq("userId", ctx.viewer!._id)).order("desc").take(50);
    const row = rows.find(row => row.status === "consumed" && JSON.parse(row.inputSnapshotJson).inputKey === inputKey);
    return row ? resultFromRow(row) : null;
  },
});

export const requestState = query({
  args: { requestKey: v.string() },
  handler: async (ctx, { requestKey }) => {
    if (!ctx.viewer) return null;
    const row = await ctx.db.query("promptCompositions").withIndex("by_user_request", q =>
      q.eq("userId", ctx.viewer!._id).eq("requestKey", requestKey)).unique();
    if (!row || JSON.parse(row.inputSnapshotJson).kind !== "style-interpreter") return null;
    return { status: row.status };
  },
});
