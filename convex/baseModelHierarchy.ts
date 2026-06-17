import { Doc } from "./_generated/dataModel";
import { QueryCtx } from "./types";

export type BaseUnitWithIpSeries = Awaited<ReturnType<typeof summarizeBaseUnit>>;
export type BaseModelWithHierarchy = ReturnType<typeof summarizeBaseModel> & {
  baseUnit: BaseUnitWithIpSeries;
};

export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels">
): Promise<BaseModelWithHierarchy>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: null
): Promise<null>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels"> | null
): Promise<BaseModelWithHierarchy | null>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels"> | null
): Promise<BaseModelWithHierarchy | null> {
  if (baseModel === null) {
    return null;
  }

  const baseUnit = baseModel.baseUnitId ? await ctx.db.get(baseModel.baseUnitId) : null;

  return {
    ...summarizeBaseModel(baseModel),
    baseUnit: await summarizeBaseUnit(ctx, baseUnit),
  };
}

export async function summarizeBaseUnit(
  ctx: QueryCtx,
  baseUnit: Doc<"baseUnits"> | null
) {
  if (baseUnit === null) {
    return null;
  }

  const ipSeries = await ctx.db.get(baseUnit.ipSeriesId);

  return {
    _id: baseUnit._id,
    name: baseUnit.name,
    slug: baseUnit.slug,
    unitCode: baseUnit.unitCode,
    aliases: baseUnit.aliases,
    silhouetteType: baseUnit.silhouetteType,
    proportionDNA: baseUnit.proportionDNA,
    armorDNA: baseUnit.armorDNA,
    keyShapeAnchors: baseUnit.keyShapeAnchors,
    forbiddenChanges: baseUnit.forbiddenChanges,
    isActive: baseUnit.isActive,
    ipSeries:
      ipSeries === null
        ? null
        : {
            _id: ipSeries._id,
            name: ipSeries.name,
            slug: ipSeries.slug,
            universe: ipSeries.universe,
            manufacturer: ipSeries.manufacturer,
            visualDNA: ipSeries.visualDNA,
            promptAnchor: ipSeries.promptAnchor,
            isActive: ipSeries.isActive,
          },
  };
}

export function summarizeBaseModel(baseModel: Doc<"baseModels">) {
  return {
    _id: baseModel._id,
    name: baseModel.name,
    slug: baseModel.slug,
    baseUnitId: baseModel.baseUnitId,
    series: baseModel.series,
    manufacturer: baseModel.manufacturer,
    grade: baseModel.grade,
    scale: baseModel.scale,
    releaseVersion: baseModel.releaseVersion,
    silhouetteType: baseModel.silhouetteType,
    complexityLevel: baseModel.complexityLevel,
    panelDensity: baseModel.panelDensity,
    aliases: baseModel.aliases,
    tags: baseModel.tags,
    thumbnailAssetKey: baseModel.thumbnailAssetKey,
    defaultMaterialPresetId: baseModel.defaultMaterialPresetId,
    promptAnchor: baseModel.promptAnchor,
    isActive: baseModel.isActive,
  };
}
