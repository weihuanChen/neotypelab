import { v } from "convex/values";
import { requireSuperAdmin } from "./adminAccess";
import { Doc, Id } from "./_generated/dataModel";
import {
  SpecPresetKind,
  vSpecPresetKind,
  vSpecPresetStatus,
  vSpecPresetTestStatus,
} from "./domain";
import { query, mutation } from "./functions";
import { buildModelPromptContext } from "./modelPromptContext";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import {
  compileHdRenderPrompt,
  compileHdRenderPromptSections,
} from "./promptCompiler";
import { MutationCtx, QueryCtx } from "./types";
import { slugify } from "./utils";

type SpecAdminCtx = QueryCtx | MutationCtx;

export const listPresets = query({
  args: {
    kind: vSpecPresetKind,
  },
  async handler(ctx, { kind }) {
    requireSuperAdmin(ctx);

    const presets = await ctx.db
      .query("specPresets")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .collect();

    return presets.sort((a, b) => a.name.localeCompare(b.name)).map((preset) => ({
      _id: preset._id,
      _creationTime: preset._creationTime,
      kind: preset.kind,
      name: preset.name,
      slug: preset.slug,
      status: preset.status,
      specJson: preset.specJson,
      renderBehaviorText: preset.renderBehaviorText,
      testNotes: preset.testNotes,
      version: preset.version,
      changelog: preset.changelog,
      testStatus: preset.testStatus,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    }));
  },
});

export const createPreset = mutation({
  args: {
    kind: vSpecPresetKind,
  },
  async handler(ctx, { kind }) {
    const { viewer } = requireSuperAdmin(ctx);
    const now = Date.now();
    const defaults = getPresetDefaults(kind);
    const slug = await buildUniqueSpecSlug(ctx, kind, defaults.slug);
    const renderPriority = getRenderPriorityDefaults(kind);

    return await ctx.db.insert("specPresets", {
      kind,
      name: defaults.name,
      slug,
      status: "draft",
      specJson: JSON.stringify(defaults.spec, null, 2),
      renderBehaviorText: defaults.renderBehaviorText,
      testNotes: "",
      version: "v0.1",
      changelog: "Initial calibration draft.",
      testStatus: "untested",
      createdAt: now,
      updatedAt: now,
      createdByUserId: viewer._id,
      updatedByUserId: viewer._id,
      ...(renderPriority ? { renderPriority } : {}),
    });
  },
});

export const updatePreset = mutation({
  args: {
    presetId: v.id("specPresets"),
    name: v.string(),
    slug: v.string(),
    status: vSpecPresetStatus,
    specJson: v.string(),
    renderBehaviorText: v.string(),
    testNotes: v.optional(v.string()),
    version: v.string(),
    changelog: v.optional(v.string()),
    testStatus: vSpecPresetTestStatus,
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const preset = await ctx.db.get(args.presetId);
    if (preset === null) {
      throw new Error("Spec preset not found");
    }

    const name = args.name.trim();
    const slug = normalizeSlug(args.slug || name);
    const renderBehaviorText = args.renderBehaviorText.trim();
    const version = args.version.trim();

    if (!name) {
      throw new Error("Spec preset name is required");
    }
    if (!slug) {
      throw new Error("Spec preset slug is required");
    }
    if (!version) {
      throw new Error("Spec preset version is required");
    }

    await assertUniqueSpecSlug(ctx, preset.kind, slug, args.presetId);

    const parsedSpec = parseSpecJson(args.specJson);
    const normalizedSpecJson = JSON.stringify(parsedSpec, null, 2);

    await ctx.db.patch(args.presetId, {
      name,
      slug,
      status: args.status,
      specJson: normalizedSpecJson,
      renderBehaviorText,
      testNotes: cleanOptionalString(args.testNotes),
      version,
      changelog: cleanOptionalString(args.changelog),
      testStatus: args.testStatus,
      updatedAt: Date.now(),
      updatedByUserId: viewer._id,
    });
  },
});

export const listPromptPreviewOptions = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [baseModelsRaw, presets] = await Promise.all([
      ctx.db.query("baseModels").collect(),
      ctx.db.query("specPresets").collect(),
    ]);

    const baseModels = await Promise.all(
      baseModelsRaw
        .filter(isPublicModelCatalogRecord)
        .map(async (baseModel) => {
          const context = await buildModelPromptContext(ctx, baseModel);
          return {
            _id: baseModel._id,
            name: context.shortLabel,
            slug: baseModel.slug,
          };
        })
    );

    return {
      baseModels: baseModels.sort((a, b) => a.name.localeCompare(b.name)),
      presets: presets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((preset) => ({
          _id: preset._id,
          kind: preset.kind,
          name: preset.name,
          slug: preset.slug,
          status: preset.status,
          version: preset.version,
          testStatus: preset.testStatus,
        })),
    };
  },
});

export const compilePromptPreview = query({
  args: {
    baseModelId: v.optional(v.id("baseModels")),
    materialSpecId: v.optional(v.id("specPresets")),
    paintFinishSpecId: v.optional(v.id("specPresets")),
    styleSpecId: v.optional(v.id("specPresets")),
    weatheringSpecId: v.optional(v.id("specPresets")),
    identityLockId: v.optional(v.id("specPresets")),
  },
  async handler(ctx, args) {
    requireSuperAdmin(ctx);

    const [
      baseModel,
      materialSpec,
      paintFinishSpec,
      styleSpec,
      weatheringSpec,
      identityLock,
    ] = await Promise.all([
      args.baseModelId ? ctx.db.get(args.baseModelId) : null,
      getPresetByExpectedKind(ctx, args.materialSpecId, "material"),
      getPresetByExpectedKind(ctx, args.paintFinishSpecId, "paint-finish"),
      getPresetByExpectedKind(ctx, args.styleSpecId, "style"),
      getPresetByExpectedKind(ctx, args.weatheringSpecId, "weathering"),
      getPresetByExpectedKind(ctx, args.identityLockId, "identity-lock"),
    ]);

    const modelContext =
      baseModel !== null && isPublicModelCatalogRecord(baseModel)
        ? await buildModelPromptContext(ctx, baseModel)
        : null;

    const compilerInput = {
      baseModelSummary: modelContext?.promptText,
      identityLock,
      materialSpec,
      paintFinishSpec,
      weatheringSpec,
      styleSpec,
    };
    const sections = compileHdRenderPromptSections(compilerInput);
    const compiledPrompt = compileHdRenderPrompt(compilerInput);

    return {
      compiledPrompt,
      sections,
    };
  },
});

export const listTestRecords = query({
  args: {
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireSuperAdmin(ctx);

    const limit = Math.min(Math.max(Math.floor(args.limit ?? 40), 1), 100);
    const records = await ctx.db
      .query("specTestRecords")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    return await Promise.all(records.map((record) => decorateTestRecord(ctx, record)));
  },
});

export const createTestRecord = mutation({
  args: {
    title: v.string(),
    testStatus: vSpecPresetTestStatus,
    compiledPrompt: v.string(),
    resultImageUrl: v.optional(v.string()),
    testNotes: v.optional(v.string()),
    baseModelId: v.optional(v.id("baseModels")),
    materialSpecId: v.optional(v.id("specPresets")),
    paintFinishSpecId: v.optional(v.id("specPresets")),
    weatheringSpecId: v.optional(v.id("specPresets")),
    styleSpecId: v.optional(v.id("specPresets")),
    identityLockId: v.optional(v.id("specPresets")),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const title = args.title.trim() || "Untitled spec test";
    const compiledPrompt = args.compiledPrompt.trim();

    if (!compiledPrompt) {
      throw new Error("Compiled prompt is required before saving a test record");
    }

    await validateSpecTestSelection(ctx, args);

    const now = Date.now();
    return await ctx.db.insert("specTestRecords", {
      title,
      testStatus: args.testStatus,
      compiledPrompt,
      resultImageUrl: cleanOptionalString(args.resultImageUrl),
      testNotes: cleanOptionalString(args.testNotes),
      baseModelId: args.baseModelId,
      materialSpecId: args.materialSpecId,
      paintFinishSpecId: args.paintFinishSpecId,
      weatheringSpecId: args.weatheringSpecId,
      styleSpecId: args.styleSpecId,
      identityLockId: args.identityLockId,
      createdAt: now,
      updatedAt: now,
      createdByUserId: viewer._id,
      updatedByUserId: viewer._id,
    });
  },
});

export const applyTestRecord = mutation({
  args: {
    testRecordId: v.id("specTestRecords"),
  },
  async handler(ctx, { testRecordId }) {
    const { viewer } = requireSuperAdmin(ctx);
    const record = await ctx.db.get(testRecordId);
    if (record === null) {
      throw new Error("Spec test record not found");
    }

    const now = Date.now();
    const specPresetIds = collectSpecPresetIds(record);
    let appliedCount = 0;

    for (const presetId of specPresetIds) {
      const preset = await ctx.db.get(presetId);
      if (preset === null) {
        continue;
      }
      await ctx.db.patch(presetId, {
        testStatus: record.testStatus,
        testNotes: buildAppliedTestNotes(preset.testNotes, record, now),
        updatedAt: now,
        updatedByUserId: viewer._id,
      });
      appliedCount += 1;
    }

    await ctx.db.patch(testRecordId, {
      appliedAt: now,
      appliedByUserId: viewer._id,
      updatedAt: now,
      updatedByUserId: viewer._id,
    });

    return { appliedCount };
  },
});

async function getPresetByExpectedKind(
  ctx: SpecAdminCtx,
  presetId: Id<"specPresets"> | undefined,
  kind: SpecPresetKind
) {
  if (!presetId) {
    return null;
  }
  const preset = await ctx.db.get(presetId);
  if (preset === null) {
    throw new Error("Spec preset not found");
  }
  if (preset.kind !== kind) {
    throw new Error(`Expected ${kind} spec preset but received ${preset.kind}`);
  }
  return preset;
}

async function validateSpecTestSelection(
  ctx: SpecAdminCtx,
  selection: {
    baseModelId?: Id<"baseModels">;
    materialSpecId?: Id<"specPresets">;
    paintFinishSpecId?: Id<"specPresets">;
    weatheringSpecId?: Id<"specPresets">;
    styleSpecId?: Id<"specPresets">;
    identityLockId?: Id<"specPresets">;
  }
) {
  const [
    baseModel,
    materialSpec,
    paintFinishSpec,
    weatheringSpec,
    styleSpec,
    identityLock,
  ] = await Promise.all([
    selection.baseModelId ? ctx.db.get(selection.baseModelId) : null,
    getPresetByExpectedKind(ctx, selection.materialSpecId, "material"),
    getPresetByExpectedKind(ctx, selection.paintFinishSpecId, "paint-finish"),
    getPresetByExpectedKind(ctx, selection.weatheringSpecId, "weathering"),
    getPresetByExpectedKind(ctx, selection.styleSpecId, "style"),
    getPresetByExpectedKind(ctx, selection.identityLockId, "identity-lock"),
  ]);

  if (selection.baseModelId && baseModel === null) {
    throw new Error("Base model not found");
  }

  return {
    baseModel,
    materialSpec,
    paintFinishSpec,
    weatheringSpec,
    styleSpec,
    identityLock,
  };
}

async function decorateTestRecord(ctx: SpecAdminCtx, record: Doc<"specTestRecords">) {
  const [
    baseModel,
    materialSpec,
    paintFinishSpec,
    weatheringSpec,
    styleSpec,
    identityLock,
  ] = await Promise.all([
    record.baseModelId ? ctx.db.get(record.baseModelId) : null,
    record.materialSpecId ? ctx.db.get(record.materialSpecId) : null,
    record.paintFinishSpecId ? ctx.db.get(record.paintFinishSpecId) : null,
    record.weatheringSpecId ? ctx.db.get(record.weatheringSpecId) : null,
    record.styleSpecId ? ctx.db.get(record.styleSpecId) : null,
    record.identityLockId ? ctx.db.get(record.identityLockId) : null,
  ]);

  return {
    _id: record._id,
    _creationTime: record._creationTime,
    title: record.title,
    testStatus: record.testStatus,
    compiledPrompt: record.compiledPrompt,
    resultImageUrl: record.resultImageUrl,
    testNotes: record.testNotes,
    baseModelId: record.baseModelId,
    materialSpecId: record.materialSpecId,
    paintFinishSpecId: record.paintFinishSpecId,
    weatheringSpecId: record.weatheringSpecId,
    styleSpecId: record.styleSpecId,
    identityLockId: record.identityLockId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    appliedAt: record.appliedAt,
    baseModelName: baseModel?.name ?? null,
    specs: {
      material: formatSpecSummary(materialSpec),
      paintFinish: formatSpecSummary(paintFinishSpec),
      weathering: formatSpecSummary(weatheringSpec),
      style: formatSpecSummary(styleSpec),
      identityLock: formatSpecSummary(identityLock),
    },
  };
}

function formatSpecSummary(preset: Doc<"specPresets"> | null) {
  if (preset === null) {
    return null;
  }

  return {
    name: preset.name,
    slug: preset.slug,
    status: preset.status,
    testStatus: preset.testStatus,
    version: preset.version,
  };
}

function collectSpecPresetIds(selection: {
  materialSpecId?: Id<"specPresets">;
  paintFinishSpecId?: Id<"specPresets">;
  weatheringSpecId?: Id<"specPresets">;
  styleSpecId?: Id<"specPresets">;
  identityLockId?: Id<"specPresets">;
}) {
  return [
    selection.materialSpecId,
    selection.paintFinishSpecId,
    selection.weatheringSpecId,
    selection.styleSpecId,
    selection.identityLockId,
  ].filter((presetId): presetId is Id<"specPresets"> => Boolean(presetId));
}

function buildAppliedTestNotes(
  existingNotes: string | undefined,
  record: Doc<"specTestRecords">,
  appliedAt: number
) {
  const appliedSummary = [
    `[${new Date(appliedAt).toISOString()}] Applied spec test "${record.title}" as ${record.testStatus}.`,
    record.resultImageUrl ? `Result: ${record.resultImageUrl}` : undefined,
    record.testNotes ? `Notes: ${record.testNotes}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const trimmedExisting = existingNotes?.trim();

  return trimmedExisting ? `${trimmedExisting}\n\n${appliedSummary}` : appliedSummary;
}

function formatPresetForPreview(
  preset: null | {
    name: string;
    slug: string;
    status: "draft" | "active";
    specJson: string;
    renderBehaviorText: string;
    version: string;
    changelog?: string;
    testStatus: "untested" | "testing" | "passed" | "failed";
  }
) {
  if (preset === null) {
    return "No spec selected.";
  }

  return [
    `Name: ${preset.name}`,
    `Slug: ${preset.slug}`,
    `Status: ${preset.status}`,
    `Version: ${preset.version}`,
    `Test Status: ${preset.testStatus}`,
    preset.changelog ? `Changelog: ${preset.changelog}` : undefined,
    `Render Behavior Text: ${preset.renderBehaviorText || "Not provided."}`,
    "Spec JSON:",
    preset.specJson,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function getRenderPriorityDefaults(kind: SpecPresetKind) {
  if (kind !== "paint-finish") {
    return undefined;
  }

  return {
    matte: 1.3,
    semiGloss: 1.0,
    gloss: 1.1,
  };
}

function getPresetDefaults(kind: SpecPresetKind) {
  if (kind === "material") {
    return {
      name: "New Material Spec",
      slug: "new-material-spec",
      renderBehaviorText: "Derived from material semantic tags.",
      spec: {
        materialFamily: "ceramic-coating",
        surface: ["smooth-painted", "low-reflectivity", "soft-specular"],
        optics: ["opaque-painted-color", "ceramic-depth"],
        reflection: ["studio-soft", "broad-diffuse", "crisp-panel-readability"],
        exclusions: ["full-chrome", "metallic-flakes", "wet-plastic"],
      },
    };
  }

  if (kind === "paint-finish") {
    return {
      name: "New Paint Finish Spec",
      slug: "new-paint-finish-spec",
      renderBehaviorText:
        "Render final paint clear-coat, gloss, sheen, and specular response according to the spec JSON.",
      spec: {
        finishType: "matte",
        glossLevel: 0.05,
        specularStrength: 0.1,
        surfaceSheen: "very low",
        clearCoatBehavior: "flat clear coat with minimal specular response",
        weatheringInteraction:
          "dust and chipping remain visible above the finish without becoming glossy",
        renderBehaviorText:
          "Render as a final matte paint finish with very low sheen and restrained specular highlights.",
      },
    };
  }

  if (kind === "weathering") {
    return {
      name: "New Weathering Spec",
      slug: "new-weathering-spec",
      renderBehaviorText:
        "Render weathering according to the calibrated intensity and readability constraints.",
      spec: {
        level: "light",
        edgeWear: "minor",
        dustAccumulation: "subtle",
        paintChipping: "minimal",
        staining: "controlled",
        intensityCap: "display-grade; never overwhelms color hierarchy",
        renderBehaviorText:
          "Render restrained scale-model weathering while preserving primary color readability.",
      },
    };
  }

  if (kind === "style") {
    return {
      name: "New Style Spec",
      slug: "new-style-spec",
      renderBehaviorText: "Derived from style semantic tags.",
      spec: {
        styleFamily: "neo-zeon",
        shapeLanguage: ["heavy-armor", "large-curves", "layered-plating"],
        visualTone: ["military-industrial", "commander-unit"],
        surfaceLanguage: ["katoki-paneling", "warning-markings"],
        visualExclusions: ["heroic-proportions", "super-robot"],
      },
    };
  }

  return {
    name: "New Identity Lock",
    slug: "new-identity-lock",
    renderBehaviorText:
      "Preserve the selected base model identity, proportions, native equipment, and silhouette.",
    spec: {
      silhouetteRule: "preserve native silhouette and proportions",
      armorStructureRule: "do not simplify, merge, or redesign armor segmentation",
      nativeEquipmentRule: "preserve native equipment unless explicitly absent from selected base model",
      forbiddenChanges: [
        "no alternate mecha body",
        "no extra weapons",
        "no fused proportions",
        "no character redesign",
      ],
      renderBehaviorText:
        "Render the selected kit as itself; repaint only the surface colors, materials, markings, finish, and wear.",
    },
  };
}

async function buildUniqueSpecSlug(
  ctx: SpecAdminCtx,
  kind: SpecPresetKind,
  baseSlug: string
) {
  const normalizedBase = normalizeSlug(baseSlug) || "spec-preset";
  let candidate = normalizedBase;
  let index = 2;

  while ((await findPresetByKindSlug(ctx, kind, candidate)) !== null) {
    candidate = `${normalizedBase}-${index}`;
    index += 1;
  }

  return candidate;
}

async function assertUniqueSpecSlug(
  ctx: SpecAdminCtx,
  kind: SpecPresetKind,
  slug: string,
  currentId: Id<"specPresets">
) {
  const existing = await findPresetByKindSlug(ctx, kind, slug);
  if (existing !== null && existing._id !== currentId) {
    throw new Error("Another spec preset with this slug already exists for this kind");
  }
}

async function findPresetByKindSlug(
  ctx: SpecAdminCtx,
  kind: SpecPresetKind,
  slug: string
) {
  return await ctx.db
    .query("specPresets")
    .withIndex("by_kind_slug", (q) => q.eq("kind", kind).eq("slug", slug))
    .unique();
}

function parseSpecJson(value: string) {
  if (!value.trim()) {
    throw new Error("Spec JSON is required");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Spec JSON is invalid: ${message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Spec JSON must be a JSON object");
  }
  return parsed;
}

function normalizeSlug(value: string) {
  return slugify(value.trim());
}

function cleanOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
