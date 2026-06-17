import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  baseModelVariantSeeds,
  baseUnitSeeds,
  buildBaseModelVariantSearchText,
  buildBaseUnitSearchText,
  ipSeriesSeeds,
} from "./catalogHierarchy";
import { internalMutation, internalQuery } from "./functions";

export const verifyBaseModelHierarchy = internalQuery({
  args: {},
  async handler(ctx) {
    const baseModels = await ctx.db.query("baseModels").collect();

    return await Promise.all(
      baseModels
        .sort((left, right) => left.slug.localeCompare(right.slug))
        .map(async (baseModel) => {
          const baseUnit = baseModel.baseUnitId
            ? await ctx.db.get(baseModel.baseUnitId)
            : null;
          const ipSeries = baseUnit ? await ctx.db.get(baseUnit.ipSeriesId) : null;

          return {
            baseModel: {
              name: baseModel.name,
              slug: baseModel.slug,
              grade: baseModel.grade,
              scale: baseModel.scale,
              panelDensity: baseModel.panelDensity,
              hasPromptAnchor: Boolean(baseModel.promptAnchor),
            },
            baseUnit:
              baseUnit === null
                ? null
                : {
                    name: baseUnit.name,
                    slug: baseUnit.slug,
                    unitCode: baseUnit.unitCode,
                  },
            ipSeries:
              ipSeries === null
                ? null
                : {
                    name: ipSeries.name,
                    slug: ipSeries.slug,
                    universe: ipSeries.universe,
                  },
          };
        })
    );
  },
});

export const splitBaseModelHierarchy = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  async handler(ctx, { dryRun }) {
    const shouldWrite = dryRun !== true;
    const ipSeriesIdsBySlug = new Map<string, Id<"ipSeries">>();
    const baseUnitIdsBySlug = new Map<string, Id<"baseUnits">>();
    const baseModels = await ctx.db.query("baseModels").collect();
    const baseModelsBySlug = new Map(baseModels.map((model) => [model.slug, model]));

    let ipSeriesCreated = 0;
    let ipSeriesUpdated = 0;
    let baseUnitsCreated = 0;
    let baseUnitsUpdated = 0;
    let baseModelsUpdated = 0;
    const missingBaseModels: string[] = [];

    for (const seed of ipSeriesSeeds) {
      const existing = await ctx.db
        .query("ipSeries")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();

      if (existing === null) {
        if (shouldWrite) {
          const id = await ctx.db.insert("ipSeries", seed);
          ipSeriesIdsBySlug.set(seed.slug, id);
        }
        ipSeriesCreated += 1;
      } else {
        ipSeriesIdsBySlug.set(seed.slug, existing._id);
        const patch = {
          name: seed.name,
          universe: seed.universe,
          manufacturer: seed.manufacturer,
          visualDNA: seed.visualDNA,
          promptAnchor: seed.promptAnchor,
          isActive: seed.isActive,
        };
        if (shouldWrite) {
          await ctx.db.patch(existing._id, patch);
        }
        ipSeriesUpdated += 1;
      }
    }

    for (const seed of baseUnitSeeds) {
      let ipSeriesId = ipSeriesIdsBySlug.get(seed.ipSeriesSlug);
      if (ipSeriesId === undefined && shouldWrite) {
        const ipSeries = await ctx.db
          .query("ipSeries")
          .withIndex("by_slug", (q) => q.eq("slug", seed.ipSeriesSlug))
          .unique();
        ipSeriesId = ipSeries?._id;
      }
      if (ipSeriesId === undefined) {
        if (shouldWrite) {
          throw new Error(`IP series seed not found for base unit ${seed.slug}`);
        }
        baseUnitsCreated += 1;
        continue;
      }

      const fields = {
        ipSeriesId,
        name: seed.name,
        unitCode: seed.unitCode,
        aliases: seed.aliases,
        silhouetteType: seed.silhouetteType,
        proportionDNA: seed.proportionDNA,
        armorDNA: seed.armorDNA,
        keyShapeAnchors: seed.keyShapeAnchors,
        forbiddenChanges: seed.forbiddenChanges,
        searchText: buildBaseUnitSearchText(seed),
        isActive: seed.isActive,
      };
      const existing = await ctx.db
        .query("baseUnits")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();

      if (existing === null) {
        if (shouldWrite) {
          const id = await ctx.db.insert("baseUnits", {
            slug: seed.slug,
            ...fields,
          });
          baseUnitIdsBySlug.set(seed.slug, id);
        }
        baseUnitsCreated += 1;
      } else {
        baseUnitIdsBySlug.set(seed.slug, existing._id);
        if (shouldWrite) {
          await ctx.db.patch(existing._id, fields);
        }
        baseUnitsUpdated += 1;
      }
    }

    for (const seed of baseModelVariantSeeds) {
      const baseModel = baseModelsBySlug.get(seed.baseModelSlug);
      const baseUnitId = baseUnitIdsBySlug.get(seed.baseUnitSlug);
      const baseUnit = baseUnitSeeds.find((unit) => unit.slug === seed.baseUnitSlug);
      const ipSeries = baseUnit
        ? ipSeriesSeeds.find((series) => series.slug === baseUnit.ipSeriesSlug)
        : undefined;

      if (baseModel === undefined) {
        missingBaseModels.push(seed.baseModelSlug);
        continue;
      }
      if (baseUnitId === undefined || baseUnit === undefined) {
        if (shouldWrite) {
          throw new Error(`Base unit seed not found for base model ${seed.baseModelSlug}`);
        }
        baseModelsUpdated += 1;
        continue;
      }

      const patch = {
        baseUnitId,
        scale: seed.scale,
        releaseVersion: seed.releaseVersion,
        panelDensity: seed.panelDensity,
        promptAnchor: seed.promptAnchor,
        searchText: buildBaseModelVariantSearchText({
          name: baseModel.name,
          series: baseModel.series,
          manufacturer: baseModel.manufacturer,
          grade: baseModel.grade,
          scale: seed.scale ?? baseModel.scale,
          releaseVersion: seed.releaseVersion ?? baseModel.releaseVersion,
          silhouetteType: baseModel.silhouetteType,
          complexityLevel: baseModel.complexityLevel,
          panelDensity: seed.panelDensity ?? baseModel.panelDensity,
          aliases: baseModel.aliases,
          tags: baseModel.tags,
          promptAnchor: seed.promptAnchor ?? baseModel.promptAnchor,
          unitName: baseUnit.name,
          unitCode: baseUnit.unitCode,
          ipSeriesName: ipSeries?.name,
          universe: ipSeries?.universe,
        }),
      };

      if (shouldWrite) {
        await ctx.db.patch(baseModel._id, patch);
      }
      baseModelsUpdated += 1;
    }

    return {
      dryRun: !shouldWrite,
      ipSeriesCreated,
      ipSeriesUpdated,
      baseUnitsCreated,
      baseUnitsUpdated,
      baseModelsUpdated,
      missingBaseModels,
    };
  },
});
