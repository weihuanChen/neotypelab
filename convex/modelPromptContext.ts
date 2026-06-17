import { Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./types";

type PromptCtx = MutationCtx | QueryCtx;

export type ModelPromptContext = {
  promptText: string;
  shortLabel: string;
  snapshot: {
    id: Doc<"baseModels">["_id"];
    name: string;
    slug: string;
    series?: string;
    manufacturer?: string;
    primaryModelBrand?: string;
    grade?: string;
    scale?: string;
    releaseVersion?: string;
    silhouetteType?: string;
    complexityLevel?: string;
    panelDensity?: string;
    aliases: string[];
    tags: string[];
    promptAnchor?: string;
    baseUnit: null | {
      id: Doc<"baseUnits">["_id"];
      name: string;
      slug: string;
      unitCode?: string;
      aliases: string[];
      silhouetteType?: string;
      keyShapeAnchors: string[];
      nativeEquipment: string[];
      forbiddenChanges: string[];
      promptAnchor?: string;
      ipSeries: null | {
        id: Doc<"ipSeries">["_id"];
        name: string;
        slug: string;
        universe?: string;
        manufacturer?: string;
        rightsOwner?: string;
        visualDNA?: string;
        promptAnchor?: string;
      };
    };
  };
};

export async function buildOptionalModelPromptContext(
  ctx: PromptCtx,
  baseModel: Doc<"baseModels"> | null
) {
  if (baseModel === null) {
    return null;
  }

  return await buildModelPromptContext(ctx, baseModel);
}

export async function buildModelPromptContext(
  ctx: PromptCtx,
  baseModel: Doc<"baseModels">
): Promise<ModelPromptContext> {
  const baseUnit = baseModel.baseUnitId ? await ctx.db.get(baseModel.baseUnitId) : null;
  const ipSeries = baseUnit ? await ctx.db.get(baseUnit.ipSeriesId) : null;
  const shortLabel = formatKitVariantLabel(baseModel, baseUnit?.name);
  const baseUnitName = baseUnit?.name ?? baseModel.name;
  const lines = [
    `Kit Variant: ${shortLabel}.`,
    baseModel.promptAnchor ??
      `Preserve this kit version without simplifying its surface language or mixing with other ${baseUnitName} versions.`,
    baseUnit ? `Base Unit: ${baseUnit.name}.` : undefined,
    baseUnit?.keyShapeAnchors.length
      ? `Key identity anchors: ${baseUnit.keyShapeAnchors.join(", ")}.`
      : undefined,
    baseUnit?.nativeEquipment?.length
      ? `Native equipment: ${baseUnit.nativeEquipment.join(", ")}.`
      : undefined,
    baseUnit?.promptAnchor,
    baseUnit?.forbiddenChanges.length
      ? `Forbidden changes: ${baseUnit.forbiddenChanges.join(", ")}.`
      : undefined,
  ].filter((line): line is string => Boolean(line));

  return {
    promptText: lines.join("\n"),
    shortLabel,
    snapshot: {
      id: baseModel._id,
      name: baseModel.name,
      slug: baseModel.slug,
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
      promptAnchor: baseModel.promptAnchor,
      baseUnit: baseUnit
        ? {
            id: baseUnit._id,
            name: baseUnit.name,
            slug: baseUnit.slug,
            unitCode: baseUnit.unitCode,
            aliases: baseUnit.aliases,
            silhouetteType: baseUnit.silhouetteType,
            keyShapeAnchors: baseUnit.keyShapeAnchors,
            nativeEquipment: baseUnit.nativeEquipment ?? [],
            forbiddenChanges: baseUnit.forbiddenChanges,
            promptAnchor: baseUnit.promptAnchor,
            ipSeries: ipSeries
              ? {
                  id: ipSeries._id,
                  name: ipSeries.name,
                  slug: ipSeries.slug,
                  universe: ipSeries.universe,
                  manufacturer: ipSeries.manufacturer,
                  rightsOwner: ipSeries.rightsOwner ?? ipSeries.manufacturer,
                  visualDNA: ipSeries.visualDNA,
                  promptAnchor: ipSeries.promptAnchor,
                }
              : null,
          }
        : null,
    },
  };
}

function formatKitVariantLabel(baseModel: Doc<"baseModels">, baseUnitName?: string) {
  const name = baseUnitName && baseUnitName.includes(baseModel.name) ? baseUnitName : baseModel.name;
  const parts = [
    baseModel.grade && !name.toLowerCase().includes(baseModel.grade.toLowerCase())
      ? baseModel.grade
      : undefined,
    name,
    baseModel.releaseVersion && !name.toLowerCase().includes(baseModel.releaseVersion.toLowerCase())
      ? baseModel.releaseVersion
      : undefined,
  ].filter(Boolean);

  return baseModel.scale ? `${parts.join(" ")} (${baseModel.scale})` : parts.join(" ");
}
