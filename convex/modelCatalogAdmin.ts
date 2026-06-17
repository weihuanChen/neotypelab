import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireSuperAdmin, writeAdminAuditLog } from "./adminAccess";
import { vModelCatalogStatus } from "./domain";
import { mutation, query } from "./functions";
import { resolveModelCatalogStatus } from "./modelCatalogStatus";
import { MutationCtx } from "./types";
import { normalizeStringForSearch } from "./utils";

export const listModelCatalogData = query({
  args: {},
  async handler(ctx) {
    requireSuperAdmin(ctx);

    const [ipSeries, baseUnits, kitVariants, concepts, generationJobs, feedbackReports, creatorPacks] = await Promise.all([
      ctx.db.query("ipSeries").collect(),
      ctx.db.query("baseUnits").collect(),
      ctx.db.query("baseModels").collect(),
      ctx.db.query("concepts").collect(),
      ctx.db.query("generationJobs").collect(),
      ctx.db.query("feedbackReports").collect(),
      ctx.db.query("creatorPacks").collect(),
    ]);

    const ipSeriesById = new Map(ipSeries.map((series) => [series._id, series]));
    const baseUnitsById = new Map(baseUnits.map((unit) => [unit._id, unit]));
    const baseUnitCounts = new Map<Id<"ipSeries">, number>();
    const kitVariantCounts = new Map<Id<"baseUnits">, number>();
    const kitVariantReferences = new Map<
      Id<"baseModels">,
      {
        concepts: number;
        creatorPacks: number;
        feedbackReports: number;
        generationJobs: number;
      }
    >();

    for (const unit of baseUnits) {
      baseUnitCounts.set(unit.ipSeriesId, (baseUnitCounts.get(unit.ipSeriesId) ?? 0) + 1);
    }
    for (const variant of kitVariants) {
      if (variant.baseUnitId) {
        kitVariantCounts.set(
          variant.baseUnitId,
          (kitVariantCounts.get(variant.baseUnitId) ?? 0) + 1
        );
      }
    }
    for (const variant of kitVariants) {
      kitVariantReferences.set(variant._id, {
        concepts: concepts.filter((item) => item.baseModelId === variant._id).length,
        creatorPacks: creatorPacks.filter((item) => item.baseModelIds.includes(variant._id)).length,
        feedbackReports: feedbackReports.filter((item) => item.baseModelId === variant._id).length,
        generationJobs: generationJobs.filter((item) => item.baseModelId === variant._id).length,
      });
    }

    return {
      ipSeries: ipSeries
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((series) => ({
          _id: series._id,
          _creationTime: series._creationTime,
          name: series.name,
          slug: series.slug,
          universe: series.universe,
          manufacturer: series.manufacturer,
          rightsOwner: series.rightsOwner ?? series.manufacturer,
          visualDNA: series.visualDNA,
          promptAnchor: series.promptAnchor,
          status: resolveModelCatalogStatus(series),
          isActive: series.isActive,
          baseUnitCount: baseUnitCounts.get(series._id) ?? 0,
        })),
      baseUnits: baseUnits
        .sort(
          (left, right) =>
            (ipSeriesById.get(left.ipSeriesId)?.name ?? "").localeCompare(
              ipSeriesById.get(right.ipSeriesId)?.name ?? ""
            ) || left.name.localeCompare(right.name)
        )
        .map((unit) => {
          const series = ipSeriesById.get(unit.ipSeriesId);
          return {
            _id: unit._id,
            _creationTime: unit._creationTime,
            ipSeriesId: unit.ipSeriesId,
            ipSeries: series
              ? {
                  _id: series._id,
                  name: series.name,
                  slug: series.slug,
                  universe: series.universe,
                }
              : null,
            name: unit.name,
            slug: unit.slug,
            unitCode: unit.unitCode,
            aliases: unit.aliases,
            silhouetteType: unit.silhouetteType,
            keyShapeAnchors: unit.keyShapeAnchors,
            nativeEquipment: unit.nativeEquipment ?? [],
            forbiddenChanges: unit.forbiddenChanges,
            promptAnchor: unit.promptAnchor,
            status: resolveModelCatalogStatus(unit),
            isActive: unit.isActive,
            kitVariantCount: kitVariantCounts.get(unit._id) ?? 0,
          };
        }),
      kitVariants: kitVariants
        .sort((left, right) => {
          const leftUnitName = left.baseUnitId ? baseUnitsById.get(left.baseUnitId)?.name ?? "" : "";
          const rightUnitName = right.baseUnitId ? baseUnitsById.get(right.baseUnitId)?.name ?? "" : "";
          return leftUnitName.localeCompare(rightUnitName) || left.name.localeCompare(right.name);
        })
        .map((variant) => {
          const unit = variant.baseUnitId ? baseUnitsById.get(variant.baseUnitId) : undefined;
          const series = unit ? ipSeriesById.get(unit.ipSeriesId) : undefined;
          return {
            _id: variant._id,
            _creationTime: variant._creationTime,
            baseUnitId: variant.baseUnitId,
            baseUnit: unit
              ? {
                  _id: unit._id,
                  name: unit.name,
                  slug: unit.slug,
                  unitCode: unit.unitCode,
                }
              : null,
            ipSeries: series
              ? {
                  _id: series._id,
                  name: series.name,
                  slug: series.slug,
                  universe: series.universe,
                }
              : null,
            name: variant.name,
            slug: variant.slug,
            primaryModelBrand: variant.primaryModelBrand ?? variant.manufacturer,
            grade: variant.grade,
            scale: variant.scale,
            releaseVersion: variant.releaseVersion,
            complexityLevel: variant.complexityLevel,
            panelDensity: variant.panelDensity,
            aliases: variant.aliases,
            tags: variant.tags,
            thumbnailAssetKey: variant.thumbnailAssetKey,
            defaultMaterialPresetId: variant.defaultMaterialPresetId,
            promptAnchor: variant.promptAnchor,
            status: resolveModelCatalogStatus(variant),
            isActive: variant.isActive,
            references: kitVariantReferences.get(variant._id) ?? {
              concepts: 0,
              creatorPacks: 0,
              feedbackReports: 0,
              generationJobs: 0,
            },
          };
        }),
    };
  },
});

export const upsertIpSeries = mutation({
  args: {
    ipSeriesId: v.optional(v.id("ipSeries")),
    name: v.string(),
    slug: v.optional(v.string()),
    universe: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    rightsOwner: v.optional(v.string()),
    visualDNA: v.optional(v.string()),
    promptAnchor: v.optional(v.string()),
    status: vModelCatalogStatus,
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const name = requireName(args.name, "IP / Series name");
    const slug = await resolveIpSeriesSlug(ctx, args.slug, name, args.ipSeriesId);
    const patch = {
      name,
      slug,
      universe: cleanOptionalString(args.universe),
      manufacturer: cleanOptionalString(args.manufacturer),
      rightsOwner: cleanOptionalString(args.rightsOwner ?? args.manufacturer),
      visualDNA: cleanOptionalString(args.visualDNA),
      promptAnchor: cleanOptionalString(args.promptAnchor),
      status: args.status,
      isActive: statusToIsActive(args.status),
    };

    const ipSeriesId = args.ipSeriesId
      ? await patchExisting(ctx, "ipSeries", args.ipSeriesId, patch, "IP / Series not found")
      : await ctx.db.insert("ipSeries", patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.ipSeriesId ? "update-ip-series" : "create-ip-series",
      entityType: "ipSeries",
      entityId: ipSeriesId,
      detailsJson: JSON.stringify({ ipSeriesId, slug, status: args.status }),
    });

    return ipSeriesId;
  },
});

export const archiveIpSeries = mutation({
  args: {
    ipSeriesId: v.id("ipSeries"),
    mode: v.union(v.literal("deactivate"), v.literal("delete")),
  },
  async handler(ctx, { ipSeriesId, mode }) {
    const { viewer } = requireSuperAdmin(ctx);
    const series = await ctx.db.get(ipSeriesId);
    if (series === null) {
      throw new Error("IP / Series not found");
    }

    if (mode === "delete") {
      const childUnits = await ctx.db
        .query("baseUnits")
        .withIndex("by_ipSeriesId", (q) => q.eq("ipSeriesId", ipSeriesId))
        .collect();
      if (childUnits.length > 0) {
        throw new Error("Cannot delete an IP / Series while base units are linked to it");
      }
      await ctx.db.delete(ipSeriesId);
    } else {
      await ctx.db.patch(ipSeriesId, { status: "archived", isActive: false });
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: mode === "delete" ? "delete-ip-series" : "deactivate-ip-series",
      entityType: "ipSeries",
      entityId: ipSeriesId,
      detailsJson: JSON.stringify({ ipSeriesId, slug: series.slug }),
    });
  },
});

export const upsertBaseUnit = mutation({
  args: {
    baseUnitId: v.optional(v.id("baseUnits")),
    ipSeriesId: v.id("ipSeries"),
    name: v.string(),
    slug: v.optional(v.string()),
    unitCode: v.optional(v.string()),
    aliases: v.array(v.string()),
    silhouetteType: v.optional(v.string()),
    keyShapeAnchors: v.array(v.string()),
    nativeEquipment: v.array(v.string()),
    forbiddenChanges: v.array(v.string()),
    promptAnchor: v.optional(v.string()),
    status: vModelCatalogStatus,
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const ipSeries = await ctx.db.get(args.ipSeriesId);
    if (ipSeries === null) {
      throw new Error("Select a valid IP / Series before saving the base unit");
    }

    const name = requireName(args.name, "Base unit name");
    const aliases = compactStringArray(args.aliases);
    const keyShapeAnchors = compactStringArray(args.keyShapeAnchors);
    const nativeEquipment = compactStringArray(args.nativeEquipment);
    const forbiddenChanges = compactStringArray(args.forbiddenChanges);
    const slug = await resolveBaseUnitSlug(ctx, args.slug, name, args.baseUnitId);
    const patch = {
      ipSeriesId: args.ipSeriesId,
      name,
      slug,
      unitCode: cleanOptionalString(args.unitCode),
      aliases,
      silhouetteType: cleanOptionalString(args.silhouetteType),
      keyShapeAnchors,
      nativeEquipment,
      forbiddenChanges,
      promptAnchor: cleanOptionalString(args.promptAnchor),
      searchText: buildBaseUnitSearchText({
        name,
        slug,
        unitCode: args.unitCode,
        aliases,
        silhouetteType: args.silhouetteType,
        keyShapeAnchors,
        nativeEquipment,
        forbiddenChanges,
        promptAnchor: args.promptAnchor,
      }),
      status: args.status,
      isActive: statusToIsActive(args.status),
    };

    const baseUnitId = args.baseUnitId
      ? await patchExisting(ctx, "baseUnits", args.baseUnitId, patch, "Base unit not found")
      : await ctx.db.insert("baseUnits", patch);

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.baseUnitId ? "update-base-unit" : "create-base-unit",
      entityType: "baseUnit",
      entityId: baseUnitId,
      detailsJson: JSON.stringify({
        baseUnitId,
        ipSeriesId: args.ipSeriesId,
        slug,
        status: args.status,
      }),
    });

    return baseUnitId;
  },
});

export const archiveBaseUnit = mutation({
  args: {
    baseUnitId: v.id("baseUnits"),
    mode: v.union(v.literal("deactivate"), v.literal("delete")),
  },
  async handler(ctx, { baseUnitId, mode }) {
    const { viewer } = requireSuperAdmin(ctx);
    const unit = await ctx.db.get(baseUnitId);
    if (unit === null) {
      throw new Error("Base unit not found");
    }

    const linkedVariants = await ctx.db
      .query("baseModels")
      .collect()
      .then((items) => items.filter((variant) => variant.baseUnitId === baseUnitId));

    if (mode === "delete") {
      if (linkedVariants.length > 0) {
        throw new Error("Cannot delete a base unit while kit variants are linked to it");
      }
      await ctx.db.delete(baseUnitId);
    } else {
      await ctx.db.patch(baseUnitId, { status: "archived", isActive: false });
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: mode === "delete" ? "delete-base-unit" : "deactivate-base-unit",
      entityType: "baseUnit",
      entityId: baseUnitId,
      detailsJson: JSON.stringify({ baseUnitId, slug: unit.slug, linkedVariantCount: linkedVariants.length }),
    });
  },
});

export const upsertKitVariant = mutation({
  args: {
    kitVariantId: v.optional(v.id("baseModels")),
    baseUnitId: v.optional(v.id("baseUnits")),
    name: v.string(),
    slug: v.optional(v.string()),
    primaryModelBrand: v.optional(v.string()),
    grade: v.optional(v.string()),
    scale: v.optional(v.string()),
    releaseVersion: v.optional(v.string()),
    complexityLevel: v.optional(v.string()),
    panelDensity: v.optional(v.string()),
    aliases: v.array(v.string()),
    tags: v.array(v.string()),
    thumbnailAssetKey: v.optional(v.string()),
    defaultMaterialPresetId: v.optional(v.id("materialPresets")),
    promptAnchor: v.optional(v.string()),
    status: vModelCatalogStatus,
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const { viewer } = requireSuperAdmin(ctx);
    const baseUnit = args.baseUnitId ? await ctx.db.get(args.baseUnitId) : null;
    if (args.baseUnitId && baseUnit === null) {
      throw new Error("Select a valid base unit before saving the kit variant");
    }
    const name = requireName(args.name, "Kit variant name");
    const aliases = compactStringArray(args.aliases);
    const tags = compactStringArray(args.tags);
    const slug = await resolveKitVariantSlug(ctx, args.slug, name, args.kitVariantId);
    const variantFields = {
      baseUnitId: args.baseUnitId,
      name,
      slug,
      primaryModelBrand: cleanOptionalString(args.primaryModelBrand),
      grade: cleanOptionalString(args.grade),
      scale: cleanOptionalString(args.scale),
      releaseVersion: cleanOptionalString(args.releaseVersion),
      complexityLevel: cleanOptionalString(args.complexityLevel),
      panelDensity: cleanOptionalString(args.panelDensity),
      aliases,
      tags,
      thumbnailAssetKey: cleanOptionalString(args.thumbnailAssetKey),
      promptAnchor: cleanOptionalString(args.promptAnchor),
      status: args.status,
      isActive: statusToIsActive(args.status),
      searchText: buildKitVariantSearchText({
        name,
        primaryModelBrand: args.primaryModelBrand,
        grade: args.grade,
        scale: args.scale,
        releaseVersion: args.releaseVersion,
        complexityLevel: args.complexityLevel,
        panelDensity: args.panelDensity,
        promptAnchor: args.promptAnchor,
        unitName: baseUnit?.name,
        unitCode: baseUnit?.unitCode,
        aliases,
        tags,
      }),
    };
    const patch: Partial<Doc<"baseModels">> = { ...variantFields };
    if (args.defaultMaterialPresetId !== undefined) {
      patch.defaultMaterialPresetId = args.defaultMaterialPresetId;
    }

    const kitVariantId = args.kitVariantId
      ? await patchExisting(ctx, "baseModels", args.kitVariantId, patch, "Kit variant not found")
      : await ctx.db.insert("baseModels", {
          ...variantFields,
          defaultMaterialPresetId: args.defaultMaterialPresetId,
        });

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: args.kitVariantId ? "update-kit-variant" : "create-kit-variant",
      entityType: "kitVariant",
      entityId: kitVariantId,
      detailsJson: JSON.stringify({
        kitVariantId,
        baseModelId: kitVariantId,
        baseUnitId: args.baseUnitId,
        slug,
        status: args.status,
      }),
    });

    return kitVariantId;
  },
});

export const archiveKitVariant = mutation({
  args: {
    kitVariantId: v.id("baseModels"),
    mode: v.union(v.literal("deactivate"), v.literal("delete")),
  },
  async handler(ctx, { kitVariantId, mode }) {
    const { viewer } = requireSuperAdmin(ctx);
    const variant = await ctx.db.get(kitVariantId);
    if (variant === null) {
      throw new Error("Kit variant not found");
    }

    const references = await countKitVariantReferences(ctx, kitVariantId);
    const referenceCount =
      references.concepts + references.generationJobs + references.feedbackReports + references.creatorPacks;

    if (mode === "delete") {
      if (referenceCount > 0) {
        throw new Error(
          "Cannot delete a kit variant that is referenced by concepts, generation jobs, feedback, or creator packs"
        );
      }
      await ctx.db.delete(kitVariantId);
    } else {
      await ctx.db.patch(kitVariantId, { status: "archived", isActive: false });
    }

    await writeAdminAuditLog(ctx, {
      actorUserId: viewer._id,
      action: mode === "delete" ? "delete-kit-variant" : "deactivate-kit-variant",
      entityType: "kitVariant",
      entityId: kitVariantId,
      detailsJson: JSON.stringify({ kitVariantId, baseModelId: kitVariantId, references }),
    });
  },
});

async function resolveIpSeriesSlug(
  ctx: MutationCtx,
  slug: string | undefined,
  name: string,
  currentId?: Id<"ipSeries">
) {
  const normalized = normalizeSlug(slug || name);
  const existing = await ctx.db
    .query("ipSeries")
    .withIndex("by_slug", (q) => q.eq("slug", normalized))
    .unique();
  if (existing !== null && existing._id !== currentId) {
    throw new Error(`Slug "${normalized}" is already used`);
  }
  return normalized;
}

async function resolveBaseUnitSlug(
  ctx: MutationCtx,
  slug: string | undefined,
  name: string,
  currentId?: Id<"baseUnits">
) {
  const normalized = normalizeSlug(slug || name);
  const existing = await ctx.db
    .query("baseUnits")
    .withIndex("by_slug", (q) => q.eq("slug", normalized))
    .unique();
  if (existing !== null && existing._id !== currentId) {
    throw new Error(`Slug "${normalized}" is already used`);
  }
  return normalized;
}

async function resolveKitVariantSlug(
  ctx: MutationCtx,
  slug: string | undefined,
  name: string,
  currentId?: Id<"baseModels">
) {
  const normalized = normalizeSlug(slug || name);
  const existing = await ctx.db
    .query("baseModels")
    .withIndex("by_slug", (q) => q.eq("slug", normalized))
    .unique();
  if (existing !== null && existing._id !== currentId) {
    throw new Error(`Slug "${normalized}" is already used`);
  }
  return normalized;
}

async function patchExisting<TTable extends "baseModels" | "baseUnits" | "ipSeries">(
  ctx: MutationCtx,
  table: TTable,
  id: Id<TTable>,
  patch: Partial<Doc<TTable>>,
  missingMessage: string
) {
  const existing = await ctx.db.get(id);
  if (existing === null) {
    throw new Error(missingMessage);
  }
  await ctx.db.patch(id, patch);
  return id;
}

function requireName(value: string, label: string) {
  const normalized = value.trim();
  if (normalized.length < 2) {
    throw new Error(`${label} must be at least 2 characters`);
  }
  return normalized;
}

function normalizeSlug(value: string) {
  const normalized = normalizeStringForSearch(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length < 2) {
    throw new Error("Slug must contain at least 2 alphanumeric characters");
  }
  return normalized;
}

function cleanOptionalString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function compactStringArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function statusToIsActive(status: "active" | "prerelease" | "archived") {
  return status === "active";
}

function buildBaseUnitSearchText(input: {
  name: string;
  slug: string;
  unitCode?: string;
  aliases: string[];
  silhouetteType?: string;
  keyShapeAnchors: string[];
  nativeEquipment: string[];
  forbiddenChanges: string[];
  promptAnchor?: string;
}) {
  return [
    input.name,
    input.slug,
    input.unitCode,
    input.silhouetteType,
    input.promptAnchor,
    ...input.aliases,
    ...input.keyShapeAnchors,
    ...input.nativeEquipment,
    ...input.forbiddenChanges,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildKitVariantSearchText(input: {
  name: string;
  primaryModelBrand?: string;
  grade?: string;
  scale?: string;
  releaseVersion?: string;
  complexityLevel?: string;
  panelDensity?: string;
  aliases: string[];
  tags: string[];
  promptAnchor?: string;
  unitName?: string;
  unitCode?: string;
}) {
  return [
    input.name,
    input.primaryModelBrand,
    input.grade,
    input.scale,
    input.releaseVersion,
    input.complexityLevel,
    input.panelDensity,
    input.promptAnchor,
    input.unitName,
    input.unitCode,
    ...input.aliases,
    ...input.tags,
  ]
    .filter(Boolean)
    .join(" ");
}

async function countKitVariantReferences(ctx: MutationCtx, kitVariantId: Id<"baseModels">) {
  const [concepts, generationJobs, feedbackReports, creatorPacks] = await Promise.all([
    ctx.db
      .query("concepts")
      .collect()
      .then((items) => items.filter((item) => item.baseModelId === kitVariantId).length),
    ctx.db
      .query("generationJobs")
      .collect()
      .then((items) => items.filter((item) => item.baseModelId === kitVariantId).length),
    ctx.db
      .query("feedbackReports")
      .collect()
      .then((items) => items.filter((item) => item.baseModelId === kitVariantId).length),
    ctx.db
      .query("creatorPacks")
      .collect()
      .then((items) => items.filter((item) => item.baseModelIds.includes(kitVariantId)).length),
  ]);

  return {
    concepts,
    generationJobs,
    feedbackReports,
    creatorPacks,
  };
}
