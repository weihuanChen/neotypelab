import { v } from "convex/values";
import { internal } from "./_generated/api";
import { vConceptVisibility, vMoodTag, vWeatheringLevel } from "./domain";
import { mutation } from "./functions";
import { buildModelPromptContext } from "./modelPromptContext";

const MAX_NOTES_LENGTH = 100;

export const initializePrototype = mutation({
  args: {
    sourceConceptId: v.optional(v.id("concepts")),
    baseModelId: v.optional(v.id("baseModels")),
    kitVariantId: v.optional(v.id("baseModels")),
    stylePresetId: v.id("stylePresets"),
    materialPresetId: v.id("materialPresets"),
    moodTags: v.optional(v.array(vMoodTag)),
    weatheringLevel: vWeatheringLevel,
    visibility: v.optional(vConceptVisibility),
    notes: v.optional(v.string()),
  },
  async handler(
    ctx,
    {
      sourceConceptId,
      baseModelId,
      kitVariantId,
      stylePresetId,
      materialPresetId,
      moodTags,
      weatheringLevel,
      visibility,
      notes,
    }
  ) {
    const viewer = ctx.viewerX();
    const sanitizedNotes = notes?.trim() || undefined;
    const sanitizedMoodTags = Array.from(new Set(moodTags ?? []));
    const nextVisibility = visibility ?? "private";
    const selectedKitVariantId = kitVariantId ?? baseModelId;

    if (sanitizedNotes !== undefined && sanitizedNotes.length > MAX_NOTES_LENGTH) {
      throw new Error(`Additional notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
    }

    const [
      sourceConcept,
      baseModel,
      stylePreset,
      materialPreset,
      colorRoles,
      account,
      template,
      priceRule,
    ] =
      await Promise.all([
        sourceConceptId ? ctx.db.get(sourceConceptId) : null,
        selectedKitVariantId ? ctx.db.get(selectedKitVariantId) : null,
        ctx.db.get(stylePresetId),
        ctx.db.get(materialPresetId),
        ctx.db.query("colorRoles").withIndex("by_sortOrder").collect(),
        ctx.db
          .query("creditAccounts")
          .withIndex("by_userId", (q) => q.eq("userId", viewer._id))
          .unique(),
        ctx.db
          .query("promptTemplates")
          .withIndex("by_kind", (q) => q.eq("kind", "repaint-concept"))
          .collect()
          .then((items) => items.find((item) => item.isActive) ?? null),
        ctx.db
          .query("creditPriceRules")
          .withIndex("by_actionType", (q) =>
            q.eq("actionType", "generate-repaint-concept")
          )
          .collect()
          .then((items) => items.find((item) => item.isActive) ?? null),
      ]);

    if (sourceConceptId && sourceConcept === null) {
      throw new Error("Remix source concept was not found");
    }
    if (
      sourceConcept !== null &&
      (sourceConcept.visibility === "private" ||
        (sourceConcept.status !== "generated" && sourceConcept.status !== "archived"))
    ) {
      throw new Error("Remix source is not available on a shareable surface");
    }
    if (baseModel === null || !baseModel.isActive) {
      throw new Error("Selected kit variant is unavailable");
    }
    if (stylePreset === null || !stylePreset.isActive) {
      throw new Error("Selected Style DNA preset is unavailable");
    }
    if (materialPreset === null || !materialPreset.isActive) {
      throw new Error("Selected material preset is unavailable");
    }
    if (account === null) {
      throw new Error("Credit account is not initialized");
    }
    if (template === null) {
      throw new Error("No active repaint concept prompt template is configured");
    }
    if (priceRule === null) {
      throw new Error("No active price rule is configured for repaint concepts");
    }
    if (account.balance < priceRule.creditCost) {
      throw new Error(
        `Insufficient credits. ${priceRule.creditCost} credits required, ${account.balance} available.`
      );
    }

    const title = sourceConceptId
      ? `${baseModel.name} / ${stylePreset.name} Remix`
      : `${baseModel.name} / ${stylePreset.name}`;
    const colorRoleNames = colorRoles.map((role) => role.name).join(", ");
    const modelPromptContext = await buildModelPromptContext(ctx, baseModel);
    const inputSnapshot = {
      sourceConcept:
        sourceConcept === null
          ? undefined
          : {
              id: sourceConcept._id,
              title: sourceConcept.title,
              visibility: sourceConcept.visibility,
              status: sourceConcept.status,
            },
      baseModel: modelPromptContext.snapshot,
      stylePreset: {
        id: stylePreset._id,
        name: stylePreset.name,
        slug: stylePreset.slug,
        category: stylePreset.category,
      },
      materialPreset: {
        id: materialPreset._id,
        name: materialPreset.name,
        slug: materialPreset.slug,
        finishType: materialPreset.finishType,
      },
      moodTags: sanitizedMoodTags,
      weatheringLevel,
      visibility: nextVisibility,
      additionalNotes: sanitizedNotes,
      colorRoles: colorRoles.map((role) => ({
        slug: role.slug,
        name: role.name,
        recommendedArea: role.recommendedArea,
      })),
    };

    const initialPrompt = composePrompt(template.userPromptTemplate, {
      baseModel: modelPromptContext.promptText,
      stylePreset: stylePreset.name,
      materialPreset: materialPreset.name,
      mood: sanitizedMoodTags.join(", ") || "No mood vector selected.",
      weatheringLevel,
      notes: sanitizedNotes ?? "No extra notes.",
      colorRoles: colorRoleNames,
      conceptId: "pending",
      remixSource: sourceConcept?.title ?? "",
    }, sourceConcept ? `Remix Source: ${sourceConcept.title}` : undefined);

    const conceptId = await ctx.db.insert("concepts", {
      userId: viewer._id,
      title,
      notes: sanitizedNotes,
      baseModelId: baseModel._id,
      stylePresetId: stylePreset._id,
      materialPresetId: materialPreset._id,
      moodTags: sanitizedMoodTags,
      weatheringLevel,
      status: "draft",
      visibility: nextVisibility,
      sourceConceptId: sourceConcept?._id,
      searchText: [
        title,
        sanitizedNotes ?? "",
        sanitizedMoodTags.join(" "),
        stylePreset.name,
        materialPreset.name,
        sourceConcept?.title ?? "",
      ]
        .join(" ")
        .trim(),
    });

    const promptCompositionId = await ctx.db.insert("promptCompositions", {
      userId: viewer._id,
      conceptId,
      promptTemplateId: template._id,
      status: "ready",
      composedPrompt: initialPrompt,
      negativePrompt: template.negativePromptTemplate,
      additionalNotes: sanitizedNotes,
      inputSnapshotJson: JSON.stringify(inputSnapshot),
      outputSummaryJson: JSON.stringify({
        template: template.name,
        templateVersion: template.version,
        styleDNA: stylePreset.name,
        materialProfile: materialPreset.name,
      }),
    });

    const generationJobId = await ctx.db.insert("generationJobs", {
      userId: viewer._id,
      kind: "palette-plan",
      status: "queued",
      baseModelId: baseModel._id,
      stylePresetId: stylePreset._id,
      materialPresetId: materialPreset._id,
      conceptId,
      requestedCredits: priceRule.creditCost,
      promptCompositionId,
      provider: "internal",
      inputSnapshotJson: JSON.stringify(inputSnapshot),
      outputSummaryJson: JSON.stringify({
        phase: "queued",
        label: "INITIALIZING STYLE DNA",
      }),
    });

    const composedPrompt = composePrompt(template.userPromptTemplate, {
      baseModel: modelPromptContext.promptText,
      stylePreset: stylePreset.name,
      materialPreset: materialPreset.name,
      mood: sanitizedMoodTags.join(", ") || "No mood vector selected.",
      weatheringLevel,
      notes: sanitizedNotes ?? "No extra notes.",
      colorRoles: colorRoleNames,
      conceptId,
      remixSource: sourceConcept?.title ?? "",
    }, sourceConcept ? `Remix Source: ${sourceConcept.title}` : undefined);

    await ctx.db.patch(conceptId, {
      generationJobId,
    });
    await ctx.db.patch(promptCompositionId, {
      generationJobId,
      composedPrompt,
    });

    const balanceAfter = account.balance - priceRule.creditCost;
    await ctx.db.patch(account._id, {
      balance: balanceAfter,
      lifetimeSpent: account.lifetimeSpent + priceRule.creditCost,
      lastCreditEventAt: Date.now(),
    });

    await ctx.db.insert("creditTransactions", {
      userId: viewer._id,
      actionType: "generate-repaint-concept",
      delta: -priceRule.creditCost,
      creditAmount: priceRule.creditCost,
      balanceAfter,
      generationJobId,
      conceptId,
      referenceTable: "generationJobs",
      referenceId: generationJobId,
      description: `Queued prototype for ${title}`,
    });

    await ctx.scheduler.runAfter(0, internal.generationNode.executeQueuedJob, {
      generationJobId,
    });

    return {
      conceptId,
      promptCompositionId,
      generationJobId,
      balanceAfter,
      title,
      templateName: template.name,
      promptPreview: composedPrompt,
      priceRule: {
        actionType: priceRule.actionType,
        label: priceRule.label,
        creditCost: priceRule.creditCost,
      },
    };
  },
});

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

function composePrompt(
  template: string,
  values: Record<string, string>,
  remixLine?: string
) {
  const prompt = applyTemplate(template, values);
  const appendedLines: string[] = [];
  if (!template.includes("{{mood}}")) {
    const mood = values.mood?.trim();
    if (mood) {
      appendedLines.push(`Mood Vector: ${mood}`);
    }
  }
  if (remixLine) {
    appendedLines.push(remixLine);
    appendedLines.push("Preserve source lineage cues while branching into a distinct repaint solution.");
  }
  if (appendedLines.length === 0) {
    return prompt;
  }
  return `${prompt}\n${appendedLines.join("\n")}`;
}
