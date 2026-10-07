import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { creativeTemplateSeeds } from "./creativeContracts";

const CREATIVE_TEMPLATE_VERSION = "creation.v2";

export const HD_RENDER_SYSTEM_PATCH =
  "Render the selected visual color targets only. Never render paint brands, product codes, HEX strings, catalog numbers, palette legends, color charts, callout lines, specification sheets, or technical annotation text. Preserve native in-universe markings only.";
export const HD_RENDER_NEGATIVE_PATCH =
  "paint brand labels, paint product codes, catalog numbers, HEX text, palette legend, color chart, specification sheet, technical callouts";

export function mergeSystemPrompt(existing: string, patch: string) {
  const stripped = existing.split(patch).join(" ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return `${stripped}\n\n${patch}`;
}

export function mergeNegativePrompt(existing: string | undefined, patch: string) {
  const seen = new Set<string>();
  const clauses: string[] = [];
  for (const clause of `${existing ?? ""}, ${patch}`.split(",")) {
    const trimmed = clause.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    clauses.push(trimmed);
  }
  return clauses.join(", ");
}

export const configure = internalMutation({
  args: { textModelId: v.string() },
  handler: async (ctx, { textModelId }) => {
    if (!/^gemini-[a-z0-9.-]+$/.test(textModelId)) throw new Error("A verified Gemini model ID is required");
    const now = Date.now();
    const profileDefs = [
      { name: "Gemini Official · Creative Text", slug: "gemini-official-creative-text", capability: "text" as const,
        apiFormat: "openai-compatible" as const,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: textModelId, keyEnvName: "GEMINI_API_KEY_OFFCIAL", timeoutMs: 120000,
        requestDefaultsJson: JSON.stringify({ temperature: 0.35, max_tokens: 7000 }) },
      { name: "LLMRelay · GPT Image 2", slug: "llmrelay-gpt-image-2", capability: "image" as const,
        apiFormat: "openai-compatible" as const,
        baseUrl: "https://llmrelay.site/v1", modelId: "gpt-image-2", keyEnvName: "OPENAI_IMAGE_FOR_LLM_RELAY", timeoutMs: 180000,
        requestDefaultsJson: JSON.stringify({ size: "1024x1024", quality: "high" }) },
      { name: "Cloudflare · GPT Image 2.5 Sunburst", slug: "cloudflare-gpt-image-2.5-sunburst", capability: "image" as const,
        apiFormat: "cloudflare-ai-run" as const,
        baseUrl: "https://api.cloudflare.com/client/v4", modelId: "openai/gpt-image-2.5-sunburst", keyEnvName: "CLOUDFLARE_IMAGE2_SUNBURST_API_KEY", timeoutMs: 180000,
        requestDefaultsJson: JSON.stringify({ size: "1024x1024", output_format: "png", background: "opaque" }),
        notes: "HD Render primary. Size stays 1024x1024 and quality follows the render mode. The account ID is read from CLOUDFLARE_ACCOUNT_ID." },
    ];
    const profileIds = [];
    for (const def of profileDefs) {
      const record = (await ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", def.slug)).collect()).at(0);
      const fields = { ...def, provider: "custom-openai-compatible" as const, priority: 10, isActive: true, updatedAt: now };
      if (record) { await ctx.db.patch(record._id, fields); profileIds.push(record._id); }
      else profileIds.push(await ctx.db.insert("llmProfiles", fields));
    }
    const templates = [];
    for (const seed of creativeTemplateSeeds) {
      let template = (await ctx.db.query("promptTemplates").withIndex("by_kind", q => q.eq("kind", seed.kind)).collect()).find(t => t.isActive);
      if (!template) {
        const id = await ctx.db.insert("promptTemplates", { ...seed, slug: `${seed.kind}-template`, version: CREATIVE_TEMPLATE_VERSION, isActive: true });
        template = (await ctx.db.get(id))!;
      }
      const versions = await ctx.db.query("promptTemplateVersions").withIndex("by_template", q => q.eq("promptTemplateId", template._id)).collect();
      if (!versions.length) await ctx.db.insert("promptTemplateVersions", {
        promptTemplateId: template._id, version: template.version, status: "archived", systemPrompt: template.systemPrompt,
        userPromptTemplate: template.userPromptTemplate, negativePromptTemplate: template.negativePromptTemplate,
        notePolicy: template.notePolicy, createdAt: now, updatedAt: now,
      });
      for (const version of versions.filter(ver => ver.status === "published" && ver.version !== CREATIVE_TEMPLATE_VERSION)) await ctx.db.patch(version._id, { status: "archived", updatedAt: now });
      let versionId = versions.find(ver => ver.version === CREATIVE_TEMPLATE_VERSION)?._id;
      const content = { systemPrompt: seed.systemPrompt, userPromptTemplate: seed.userPromptTemplate,
        notePolicy: "Structured kit selections and approved palette override operator notes.", status: "published" as const, publishedAt: now, updatedAt: now };
      if (versionId) await ctx.db.patch(versionId, content);
      else versionId = await ctx.db.insert("promptTemplateVersions", { ...content, promptTemplateId: template._id, version: CREATIVE_TEMPLATE_VERSION, createdAt: now });
      await ctx.db.patch(template._id, { name: seed.name, version: CREATIVE_TEMPLATE_VERSION, publishedVersionId: versionId, systemPrompt: seed.systemPrompt,
        userPromptTemplate: seed.userPromptTemplate, notePolicy: content.notePolicy, updatedAt: now });
      const binding = (await ctx.db.query("pipelineTemplateBindings").withIndex("by_action", q => q.eq("action", seed.kind)).collect()).sort((a,b) => b.updatedAt-a.updatedAt).at(0);
      const bindingFields = { action: seed.kind, promptTemplateId: template._id, versionPolicy: "follow-published" as const, isActive: true, effectiveFrom: now, updatedAt: now };
      if (binding) await ctx.db.patch(binding._id, bindingFields);
      else await ctx.db.insert("pipelineTemplateBindings", bindingFields);
      templates.push({ kind: seed.kind, templateId: template._id, versionId });
    }
    const hdTemplates = await ctx.db
      .query("promptTemplates")
      .withIndex("by_kind", (q) => q.eq("kind", "hd-render"))
      .collect();
    for (const template of hdTemplates.filter((item) => item.isActive)) {
      const systemPrompt = mergeSystemPrompt(template.systemPrompt, HD_RENDER_SYSTEM_PATCH);
      const negativePromptTemplate = mergeNegativePrompt(template.negativePromptTemplate, HD_RENDER_NEGATIVE_PATCH);
      const previousVersions = await ctx.db
        .query("promptTemplateVersions")
        .withIndex("by_template", (q) => q.eq("promptTemplateId", template._id))
        .collect();
      const existingVersion = previousVersions.find((item) => item.version === "render.v2");
      const version = existingVersion
        ? existingVersion._id
        : await ctx.db.insert("promptTemplateVersions", {
            promptTemplateId: template._id,
            version: "render.v2",
            status: "published",
            systemPrompt,
            userPromptTemplate: template.userPromptTemplate,
            negativePromptTemplate,
            notePolicy: template.notePolicy,
            createdAt: now,
            updatedAt: now,
          });
      if (existingVersion) {
        await ctx.db.patch(version, {
          status: "published",
          systemPrompt,
          userPromptTemplate: template.userPromptTemplate,
          negativePromptTemplate,
          notePolicy: template.notePolicy,
          updatedAt: now,
        });
      }
      for (const previous of previousVersions.filter((item) => item._id !== version && item.status === "published")) {
        await ctx.db.patch(previous._id, { status: "archived", updatedAt: now });
      }
      await ctx.db.patch(template._id, {
        version: "render.v2",
        systemPrompt,
        negativePromptTemplate,
        publishedVersionId: version,
        updatedAt: now,
      });
    }
    const hdTemplate = hdTemplates.find((item) => item.isActive && item.slug === "hd-render-template")
      ?? hdTemplates.find((item) => item.isActive);
    if (hdTemplate) await ensureHdRenderBinding(ctx, hdTemplate._id, now);
    for (const action of ["style-suggestion", "palette-plan", "repaint-concept", "hd-render"] as const) {
      const routes = await ctx.db.query("generationProviderRoutes").withIndex("by_action", q => q.eq("action", action)).collect();
      const existing = routes.sort((a,b) => b.updatedAt-a.updatedAt).at(0);
      const fields = { action, primaryProfileId: action === "hd-render" ? profileIds[2] : profileIds[0], fallbackProfileId: undefined, updatedAt: now };
      if (existing) await ctx.db.patch(existing._id, fields);
      else await ctx.db.insert("generationProviderRoutes", fields);
    }
    return { textProfileId: profileIds[0], imageProfileId: profileIds[2], relayImageProfileId: profileIds[1], textModelId, templates };
  },
});

export const repairHdRenderPipeline = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const templates = (await ctx.db.query("promptTemplates").withIndex("by_kind", (q) => q.eq("kind", "hd-render")).collect())
      .filter((template) => template.isActive);
    const updated: string[] = [];
    for (const template of templates) {
      const systemPrompt = mergeSystemPrompt(template.systemPrompt, HD_RENDER_SYSTEM_PATCH);
      const negativePromptTemplate = mergeNegativePrompt(template.negativePromptTemplate, HD_RENDER_NEGATIVE_PATCH);
      if (systemPrompt !== template.systemPrompt || negativePromptTemplate !== (template.negativePromptTemplate ?? "")) {
        await ctx.db.patch(template._id, { systemPrompt, negativePromptTemplate, updatedAt: now });
        updated.push(template.slug);
      }
      const versions = await ctx.db
        .query("promptTemplateVersions")
        .withIndex("by_template", (q) => q.eq("promptTemplateId", template._id))
        .collect();
      for (const version of versions) {
        if (version.status !== "published") continue;
        const versionSystem = mergeSystemPrompt(version.systemPrompt, HD_RENDER_SYSTEM_PATCH);
        const versionNegative = mergeNegativePrompt(version.negativePromptTemplate, HD_RENDER_NEGATIVE_PATCH);
        if (versionSystem === version.systemPrompt && versionNegative === (version.negativePromptTemplate ?? "")) continue;
        await ctx.db.patch(version._id, {
          systemPrompt: versionSystem,
          negativePromptTemplate: versionNegative,
          updatedAt: now,
        });
      }
    }
    const primary = templates.find((template) => template.slug === "hd-render-template") ?? templates[0];
    const binding = primary ? await ensureHdRenderBinding(ctx, primary._id, now) : "missing-template";
    return { updated, binding };
  },
});

async function ensureHdRenderBinding(ctx: MutationCtx, templateId: Id<"promptTemplates">, now: number) {
  const bindings = await ctx.db.query("pipelineTemplateBindings").withIndex("by_action", (q) => q.eq("action", "hd-render")).collect();
  if (bindings.some((binding) => binding.isActive)) return "existing" as const;
  await ctx.db.insert("pipelineTemplateBindings", {
    action: "hd-render",
    promptTemplateId: templateId,
    versionPolicy: "follow-published",
    isActive: true,
    effectiveFrom: now,
    updatedAt: now,
  });
  return "created" as const;
}
