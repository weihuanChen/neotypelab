import { Doc } from "./_generated/dataModel";
import { isPublicModelCatalogRecord } from "./modelCatalogStatus";
import { QueryCtx } from "./types";

export type BaseUnitWithIpSeries = Awaited<ReturnType<typeof summarizeBaseUnit>>;
export type BaseModelWithHierarchy = ReturnType<typeof summarizeBaseModel> & {
  baseUnit: BaseUnitWithIpSeries;
};

export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels">,
  options?: { publicOnly?: boolean }
): Promise<BaseModelWithHierarchy>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: null,
  options?: { publicOnly?: boolean }
): Promise<null>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels"> | null,
  options?: { publicOnly?: boolean }
): Promise<BaseModelWithHierarchy | null>;
export async function summarizeBaseModelWithHierarchy(
  ctx: QueryCtx,
  baseModel: Doc<"baseModels"> | null,
  options?: { publicOnly?: boolean }
): Promise<BaseModelWithHierarchy | null> {
  if (baseModel === null) {
    return null;
  }
  if (options?.publicOnly === true && !isPublicModelCatalogRecord(baseModel)) {
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
    keyShapeAnchors: baseUnit.keyShapeAnchors,
    nativeEquipment: baseUnit.nativeEquipment ?? [],
    forbiddenChanges: baseUnit.forbiddenChanges,
    promptAnchor: baseUnit.promptAnchor,
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
            rightsOwner: ipSeries.rightsOwner ?? ipSeries.manufacturer,
            visualDNA: ipSeries.visualDNA,
            promptAnchor: ipSeries.promptAnchor,
            status: ipSeries.status,
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
    primaryModelBrand: baseModel.primaryModelBrand ?? baseModel.manufacturer,
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
    status: baseModel.status,
    isActive: baseModel.isActive,
  };
}
