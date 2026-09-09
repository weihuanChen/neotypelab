import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { creativeTemplateSeeds } from "./creativeContracts";

export const configure = internalMutation({
  args: { textModelId: v.string() },
  handler: async (ctx, { textModelId }) => {
    if (!/^gemini-[a-z0-9.-]+$/.test(textModelId)) throw new Error("A verified Gemini model ID is required");
    const now = Date.now();
    const profileDefs = [
      { name: "Gemini Official · Creative Text", slug: "gemini-official-creative-text", capability: "text" as const,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: textModelId, keyEnvName: "GEMINI_API_KEY_OFFCIAL", timeoutMs: 120000,
        requestDefaultsJson: JSON.stringify({ temperature: 0.35, max_tokens: 7000 }) },
      { name: "LLMRelay · GPT Image 2", slug: "llmrelay-gpt-image-2", capability: "image" as const,
        baseUrl: "https://llmrelay.site/v1", modelId: "gpt-image-2", keyEnvName: "OPEMAI_IMAGE_FOR_LLM_RELAY", timeoutMs: 180000,
        requestDefaultsJson: JSON.stringify({ size: "1024x1024", quality: "high" }) },
    ];
    const profileIds = [];
    for (const def of profileDefs) {
      const record = (await ctx.db.query("llmProfiles").withIndex("by_slug", q => q.eq("slug", def.slug)).collect()).at(0);
      const fields = { ...def, provider: "custom-openai-compatible" as const, apiFormat: "openai-compatible" as const, priority: 10, isActive: true, updatedAt: now };
      if (record) { await ctx.db.patch(record._id, fields); profileIds.push(record._id); }
      else profileIds.push(await ctx.db.insert("llmProfiles", fields));
    }
    const templates = [];
    for (const seed of creativeTemplateSeeds) {
      let template = (await ctx.db.query("promptTemplates").withIndex("by_kind", q => q.eq("kind", seed.kind)).collect()).find(t => t.isActive);
      if (!template) {
        const id = await ctx.db.insert("promptTemplates", { ...seed, slug: `${seed.kind}-template`, version: "creation.v1", isActive: true });
        template = (await ctx.db.get(id))!;
      }
      const versions = await ctx.db.query("promptTemplateVersions").withIndex("by_template", q => q.eq("promptTemplateId", template._id)).collect();
      if (!versions.length) await ctx.db.insert("promptTemplateVersions", {
        promptTemplateId: template._id, version: template.version, status: "archived", systemPrompt: template.systemPrompt,
        userPromptTemplate: template.userPromptTemplate, negativePromptTemplate: template.negativePromptTemplate,
        notePolicy: template.notePolicy, createdAt: now, updatedAt: now,
      });
      for (const version of versions.filter(ver => ver.status === "published" && ver.version !== "creation.v1")) await ctx.db.patch(version._id, { status: "archived", updatedAt: now });
      let versionId = versions.find(ver => ver.version === "creation.v1")?._id;
      const content = { systemPrompt: seed.systemPrompt, userPromptTemplate: seed.userPromptTemplate,
        notePolicy: "Structured kit selections and approved palette override operator notes.", status: "published" as const, publishedAt: now, updatedAt: now };
      if (versionId) await ctx.db.patch(versionId, content);
      else versionId = await ctx.db.insert("promptTemplateVersions", { ...content, promptTemplateId: template._id, version: "creation.v1", createdAt: now });
      await ctx.db.patch(template._id, { name: seed.name, version: "creation.v1", publishedVersionId: versionId, systemPrompt: seed.systemPrompt,
        userPromptTemplate: seed.userPromptTemplate, notePolicy: content.notePolicy, updatedAt: now });
      const binding = (await ctx.db.query("pipelineTemplateBindings").withIndex("by_action", q => q.eq("action", seed.kind)).collect()).sort((a,b) => b.updatedAt-a.updatedAt).at(0);
      const bindingFields = { action: seed.kind, promptTemplateId: template._id, versionPolicy: "follow-published" as const, isActive: true, effectiveFrom: now, updatedAt: now };
      if (binding) await ctx.db.patch(binding._id, bindingFields);
      else await ctx.db.insert("pipelineTemplateBindings", bindingFields);
      templates.push({ kind: seed.kind, templateId: template._id, versionId });
    }
    for (const action of ["style-suggestion", "palette-plan", "repaint-concept", "hd-render"] as const) {
      const routes = await ctx.db.query("generationProviderRoutes").withIndex("by_action", q => q.eq("action", action)).collect();
      const existing = routes.sort((a,b) => b.updatedAt-a.updatedAt).at(0);
      const fields = { action, primaryProfileId: action === "hd-render" ? profileIds[1] : profileIds[0], fallbackProfileId: undefined, updatedAt: now };
      if (existing) await ctx.db.patch(existing._id, fields);
      else await ctx.db.insert("generationProviderRoutes", fields);
    }
    return { textProfileId: profileIds[0], imageProfileId: profileIds[1], textModelId, templates };
  },
});
