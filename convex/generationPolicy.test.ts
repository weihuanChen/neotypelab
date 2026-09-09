import { beforeEach, describe, expect, it } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { assertGenerationCapacity, resolvePipelineTemplate } from "./pipelineSettings";
import { seedUser } from "@/tests/convexTestHelpers";

const modules = import.meta.glob("./**/*.ts");
type Backend = TestConvex<typeof schema>;

describe("generation policy integration", () => {
  let t: Backend;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("enforces the configured active-job limit", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "user-token",
      email: "pilot@example.test",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("platformSettings", {
        key: "generation",
        valueJson: JSON.stringify({ concurrentJobsPerUser: 1 }),
        revision: 1,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("generationJobs", {
        userId: user.userId,
        kind: "palette-plan",
        status: "queued",
        requestedCredits: 1,
      });
    });

    await expect(
      t.run((ctx) => assertGenerationCapacity(ctx as never, user.userId))
    ).rejects.toThrow(/current limit is 1/);
  });

  it("resolves the published prompt-template version", async () => {
    const result = await t.run(async (ctx) => {
      const templateId = await ctx.db.insert("promptTemplates", {
        name: "Repaint",
        slug: "repaint",
        kind: "repaint-concept",
        version: "1",
        systemPrompt: "old system",
        userPromptTemplate: "old {{baseModel}}",
        isActive: true,
      });
      const versionId = await ctx.db.insert("promptTemplateVersions", {
        promptTemplateId: templateId,
        version: "2",
        status: "published",
        systemPrompt: "published system",
        userPromptTemplate: "published {{baseModel}}",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.patch(templateId, { publishedVersionId: versionId });
      return resolvePipelineTemplate(ctx as never, "repaint-concept");
    });

    expect(result).toMatchObject({
      version: "2",
      systemPrompt: "published system",
      userPromptTemplate: "published {{baseModel}}",
    });
    expect(result?.promptTemplateVersionId).toBeDefined();
  });

  it("refunds failed generation credits only once", async () => {
    const user = await seedUser(t, {
      tokenIdentifier: "user-token",
      email: "pilot@example.test",
      balance: 3,
    });
    const generationJobId = await t.run(async (ctx) => {
      return ctx.db.insert("generationJobs", {
        userId: user.userId,
        kind: "palette-plan",
        status: "failed",
        requestedCredits: 7,
      });
    });

    await t.mutation(internal.generation.refundFailedJobCredits, { generationJobId });
    await t.mutation(internal.generation.refundFailedJobCredits, { generationJobId });

    const state = await t.run(async (ctx) => ({
      account: await ctx.db
        .query("creditAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", user.userId))
        .unique(),
      refunds: await ctx.db
        .query("creditTransactions")
        .withIndex("by_user_actionType", (q) =>
          q.eq("userId", user.userId).eq("actionType", "generation-refund")
        )
        .collect(),
    }));
    expect(state.account).toMatchObject({ balance: 10, lifetimeSpent: 0 });
    expect(state.refunds).toHaveLength(1);
  });

  it("rejects stale generation settings revisions", async () => {
    const admin = await seedUser(t, {
      tokenIdentifier: "admin-token",
      email: "admin@example.test",
      isAdmin: true,
    });
    const settings = {
      expectedRevision: 0,
      fallbackBehavior: "secondary-provider" as const,
      maxRetryCount: 1,
      timeoutSeconds: 60,
      failureCreditPolicy: "auto-refund" as const,
      concurrentJobsPerUser: 2,
      routes: [],
    };
    await admin.client.mutation(api.admin.saveGenerationSettings, settings);
    await expect(
      admin.client.mutation(api.admin.saveGenerationSettings, settings)
    ).rejects.toThrow(/changed in another session/);
  });
});

describe("text execution route resolution", () => {
  it("selects a text profile instead of a higher priority image profile", async () => {
    const t = convexTest(schema, modules);
    const textProfileId = await t.run(async (ctx) => {
      const shared = {
        provider: "custom-openai-compatible" as const,
        apiFormat: "openai-compatible" as const,
        baseUrl: "https://example.test/v1", modelId: "test-model",
        keyEnvName: "GEMINI_API_KEY_OFFCIAL", isActive: true, updatedAt: Date.now(),
      };
      await ctx.db.insert("llmProfiles", { ...shared, capability: "image", name: "Image", slug: "image", priority: 100 });
      return ctx.db.insert("llmProfiles", { ...shared, capability: "text", name: "Text", slug: "text", priority: 0 });
    });
    const result = await t.query(internal.generation.getTextExecutionContext, { templateKind: "palette-plan" });
    expect(result.route.primary.profile._id).toBe(textProfileId);
  });

  it("rejects an explicit route containing only image profiles", async () => {
    const t = convexTest(schema, modules);
    const user = await seedUser(t, { tokenIdentifier: "route-admin", email: "route@example.test" });
    await t.run(async (ctx) => {
      const shared = { provider: "custom-openai-compatible" as const, apiFormat: "openai-compatible" as const,
        baseUrl: "https://example.test/v1", modelId: "test", keyEnvName: "TEST_KEY", isActive: true, updatedAt: Date.now(), priority: 0 };
      const imageId = await ctx.db.insert("llmProfiles", { ...shared, name: "Image", slug: "image", capability: "image" });
      await ctx.db.insert("llmProfiles", { ...shared, name: "Text", slug: "text", capability: "text" });
      await ctx.db.insert("generationProviderRoutes", { action: "palette-plan", primaryProfileId: imageId, updatedAt: Date.now(), updatedByUserId: user.userId });
    });
    await expect(t.query(internal.generation.getTextExecutionContext, { templateKind: "palette-plan" })).rejects.toThrow(/no active text provider/);
  });
});
