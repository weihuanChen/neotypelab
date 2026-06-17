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
          rightsOwner: seed.rightsOwner ?? seed.manufacturer,
          visualDNA: seed.visualDNA,
          promptAnchor: seed.promptAnchor,
          status: seed.status ?? (seed.isActive ? "active" : "archived"),
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
        keyShapeAnchors: seed.keyShapeAnchors,
        nativeEquipment: seed.nativeEquipment,
        forbiddenChanges: seed.forbiddenChanges,
        promptAnchor: seed.promptAnchor,
        searchText: buildBaseUnitSearchText(seed),
        status: seed.status ?? (seed.isActive ? "active" : "archived"),
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
        primaryModelBrand: seed.primaryModelBrand ?? baseModel.primaryModelBrand ?? baseModel.manufacturer,
        panelDensity: seed.panelDensity,
        promptAnchor: seed.promptAnchor,
        status: seed.status ?? (baseModel.isActive ? "active" : "archived"),
        searchText: buildBaseModelVariantSearchText({
          name: baseModel.name,
          primaryModelBrand: seed.primaryModelBrand ?? baseModel.primaryModelBrand ?? baseModel.manufacturer,
          grade: baseModel.grade,
          scale: seed.scale ?? baseModel.scale,
          releaseVersion: seed.releaseVersion ?? baseModel.releaseVersion,
          complexityLevel: baseModel.complexityLevel,
          panelDensity: seed.panelDensity ?? baseModel.panelDensity,
          aliases: baseModel.aliases,
          tags: baseModel.tags,
          promptAnchor: seed.promptAnchor ?? baseModel.promptAnchor,
          unitName: baseUnit.name,
          unitCode: baseUnit.unitCode,
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

export const backfillModelCatalogStatus = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  async handler(ctx, { dryRun }) {
    const shouldWrite = dryRun !== true;
    const [ipSeries, baseUnits, baseModels] = await Promise.all([
      ctx.db.query("ipSeries").collect(),
      ctx.db.query("baseUnits").collect(),
      ctx.db.query("baseModels").collect(),
    ]);

    let ipSeriesUpdated = 0;
    let baseUnitsUpdated = 0;
    let baseModelsUpdated = 0;

    for (const series of ipSeries) {
      if (series.status !== undefined) {
        continue;
      }
      if (shouldWrite) {
        await ctx.db.patch(series._id, {
          status: series.isActive ? "active" : "archived",
        });
      }
      ipSeriesUpdated += 1;
    }

    for (const unit of baseUnits) {
      if (unit.status !== undefined) {
        continue;
      }
      if (shouldWrite) {
        await ctx.db.patch(unit._id, {
          status: unit.isActive ? "active" : "archived",
        });
      }
      baseUnitsUpdated += 1;
    }

    for (const model of baseModels) {
      if (model.status !== undefined) {
        continue;
      }
      if (shouldWrite) {
        await ctx.db.patch(model._id, {
          status: model.isActive ? "active" : "archived",
        });
      }
      baseModelsUpdated += 1;
    }

    return {
      dryRun: !shouldWrite,
      ipSeriesUpdated,
      baseUnitsUpdated,
      baseModelsUpdated,
    };
  },
});
