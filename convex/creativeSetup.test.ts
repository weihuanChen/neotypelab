/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { HD_RENDER_NEGATIVE_PATCH, HD_RENDER_SYSTEM_PATCH, mergeNegativePrompt, mergeSystemPrompt } from "./creativeSetup";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const patch = HD_RENDER_NEGATIVE_PATCH;

describe("HD render prompt repair", () => {
  test("collapses a repeated guardrail to one copy", () => {
    expect(mergeNegativePrompt(`toy plastic, ${patch}, ${patch}`, patch)).toBe(`toy plastic, ${patch}`);
    expect(mergeSystemPrompt(`Keep the kit.\n\n${patch}\n\n${patch}`, patch)).toBe(`Keep the kit.\n\n${patch}`);
  });

  test("adds the HD binding and removes a duplicated negative prompt", async () => {
    const t = convexTest(schema, modules);
    const templateId = await t.run((ctx) => ctx.db.insert("promptTemplates", {
      name: "HD Render Template",
      slug: "hd-render-template",
      kind: "hd-render",
      version: "render.v2",
      systemPrompt: "Keep the kit.",
      userPromptTemplate: "Kit",
      negativePromptTemplate: `toy plastic, ${patch}, ${patch}`,
      isActive: true,
    }));
    const versionId = await t.run((ctx) => ctx.db.insert("promptTemplateVersions", {
      promptTemplateId: templateId,
      version: "render.v2",
      status: "published",
      systemPrompt: "Keep the kit.",
      userPromptTemplate: "Kit",
      negativePromptTemplate: `${patch}, ${patch}`,
      createdAt: 1,
      updatedAt: 1,
    }));

    const result = await t.mutation(internal.creativeSetup.repairHdRenderPipeline, {});
    expect(result).toMatchObject({ updated: ["hd-render-template"], binding: "created" });
    const again = await t.mutation(internal.creativeSetup.repairHdRenderPipeline, {});
    expect(again).toMatchObject({ updated: [], binding: "existing" });

    const template = await t.run((ctx) => ctx.db.get(templateId));
    const version = await t.run((ctx) => ctx.db.get(versionId));
    expect(template?.negativePromptTemplate).toBe(`toy plastic, ${patch}`);
    expect(version?.negativePromptTemplate).toBe(patch);
    expect(version?.systemPrompt.endsWith(HD_RENDER_SYSTEM_PATCH)).toBe(true);
    expect(version?.systemPrompt.split(HD_RENDER_SYSTEM_PATCH)).toHaveLength(2);
  });

  test("keeps HD render on Cloudflare when setup runs again", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-3.5-flash" });
    const second = await t.mutation(internal.creativeSetup.configure, { textModelId: "gemini-3.5-flash" });
    const [cloudflare, relay] = await t.run(async (ctx) => {
      const cloudflareProfile = await ctx.db.query("llmProfiles").withIndex("by_slug", (q) => q.eq("slug", "cloudflare-gpt-image-2.5-sunburst")).unique();
      const relayProfile = await ctx.db.query("llmProfiles").withIndex("by_slug", (q) => q.eq("slug", "llmrelay-gpt-image-2")).unique();
      return [cloudflareProfile, relayProfile] as const;
    });
    const routes = await t.run((ctx) => ctx.db.query("generationProviderRoutes").withIndex("by_action", (q) => q.eq("action", "hd-render")).collect());
    expect(cloudflare).toMatchObject({
      apiFormat: "cloudflare-ai-run",
      modelId: "openai/gpt-image-2.5-sunburst",
      keyEnvName: "CLOUDFLARE_IMAGE2_SUNBURST_API_KEY",
      baseUrl: "https://api.cloudflare.com/client/v4",
      isActive: true,
    });
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ primaryProfileId: cloudflare?._id });
    expect(routes[0]?.fallbackProfileId).toBeUndefined();
    expect(first.imageProfileId).toBe(cloudflare?._id);
    expect(second.imageProfileId).toBe(cloudflare?._id);
    expect(second.relayImageProfileId).toBe(relay?._id);
    expect(second.textProfileId).not.toBe(cloudflare?._id);
  });
});
