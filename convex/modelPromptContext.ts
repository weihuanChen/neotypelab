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
      proportionDNA?: string;
      armorDNA?: string;
      keyShapeAnchors: string[];
      forbiddenChanges: string[];
      promptAnchor?: string;
      ipSeries: null | {
        id: Doc<"ipSeries">["_id"];
        name: string;
        slug: string;
        universe?: string;
        manufacturer?: string;
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
  const shortLabel = formatKitVariantLabel(baseModel);
  const lines = [
    shortLabel,
    ipSeries
      ? [
          `IP / Series DNA: ${ipSeries.name}`,
          ipSeries.universe ? `Universe: ${ipSeries.universe}` : undefined,
          ipSeries.visualDNA ? `Visual DNA: ${ipSeries.visualDNA}` : undefined,
          ipSeries.promptAnchor ? `World anchor: ${ipSeries.promptAnchor}` : undefined,
        ]
          .filter(Boolean)
          .join(". ")
      : baseModel.series
        ? `IP / Series DNA: ${baseModel.series}`
        : undefined,
    baseUnit
      ? [
          `Base Unit DNA: ${baseUnit.name}${baseUnit.unitCode ? ` (${baseUnit.unitCode})` : ""}`,
          baseUnit.proportionDNA ? `Proportions: ${baseUnit.proportionDNA}` : undefined,
          baseUnit.armorDNA ? `Armor: ${baseUnit.armorDNA}` : undefined,
        ]
          .filter(Boolean)
          .join(". ")
      : undefined,
    baseUnit?.keyShapeAnchors.length
      ? `Key shape anchors: ${baseUnit.keyShapeAnchors.join(", ")}.`
      : undefined,
    baseModel.promptAnchor ? `Kit variant anchor: ${baseModel.promptAnchor}` : undefined,
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
            proportionDNA: baseUnit.proportionDNA,
            armorDNA: baseUnit.armorDNA,
            keyShapeAnchors: baseUnit.keyShapeAnchors,
            forbiddenChanges: baseUnit.forbiddenChanges,
            ipSeries: ipSeries
              ? {
                  id: ipSeries._id,
                  name: ipSeries.name,
                  slug: ipSeries.slug,
                  universe: ipSeries.universe,
                  manufacturer: ipSeries.manufacturer,
                  visualDNA: ipSeries.visualDNA,
                  promptAnchor: ipSeries.promptAnchor,
                }
              : null,
          }
        : null,
    },
  };
}

function formatKitVariantLabel(baseModel: Doc<"baseModels">) {
  const meta = [
    baseModel.grade,
    baseModel.scale,
    baseModel.releaseVersion,
    baseModel.panelDensity ? `${baseModel.panelDensity} panel density` : undefined,
    baseModel.complexityLevel ? `${baseModel.complexityLevel} complexity` : undefined,
  ].filter(Boolean);

  return meta.length > 0 ? `${baseModel.name} (${meta.join(", ")})` : baseModel.name;
}
