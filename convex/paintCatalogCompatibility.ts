import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { PaintSheen } from "./paintCatalogDomain";

type PaintCatalogReadContext = {
  db: GenericDatabaseReader<DataModel>;
};

export async function listResolvedPaintMappings(ctx: PaintCatalogReadContext) {
  const [mappings, brands, paintLines, measurements] = await Promise.all([
    ctx.db.query("paintMappings").collect(),
    ctx.db.query("paintBrands").collect(),
    ctx.db.query("paintLines").collect(),
    ctx.db.query("paintColorMeasurements").collect(),
  ]);
  const brandById = new Map(brands.map((brand) => [brand._id, brand]));
  const paintLineById = new Map(
    paintLines.map((paintLine) => [paintLine._id, paintLine])
  );
  const measurementById = new Map(
    measurements.map((measurement) => [measurement._id, measurement])
  );

  return mappings.map((mapping) => {
    const measurement = mapping.preferredMeasurementId
      ? measurementById.get(mapping.preferredMeasurementId)
      : undefined;
    return resolvePaintMapping(mapping, {
      brand: mapping.brandId ? brandById.get(mapping.brandId) : undefined,
      paintLine: mapping.paintLineId
        ? paintLineById.get(mapping.paintLineId)
        : undefined,
      measurement:
        measurement?.paintMappingId === mapping._id ? measurement : undefined,
    });
  });
}

export function resolvePaintMapping(
  mapping: Doc<"paintMappings">,
  related: {
    brand?: Doc<"paintBrands">;
    paintLine?: Doc<"paintLines">;
    measurement?: Doc<"paintColorMeasurements">;
  } = {}
) {
  const name = mapping.name ?? mapping.colorName;
  const sheen = mapping.sheen ?? legacySheen(mapping.finishType);
  const effects =
    mapping.effects ??
    (mapping.finishType?.trim().toLowerCase() === "metallic"
      ? (["metallic"] as const)
      : []);
  const brandName = related.brand?.name ?? mapping.brand;
  const paintLineName = related.paintLine?.name ?? mapping.line;
  const preferredMeasurement = related.measurement ?? null;

  return {
    ...mapping,
    name,
    sheen,
    effects: [...effects],
    brandName,
    paintLineName,
    preferredMeasurement,
    // Legacy aliases remain available until all frontend consumers migrate.
    brand: brandName,
    line: paintLineName,
    colorName: name,
    finishType: sheen ? displaySheen(sheen) : mapping.finishType,
    hexPreview: preferredMeasurement?.hex ?? mapping.hexPreview,
  };
}

export type ResolvedPaintMapping = ReturnType<typeof resolvePaintMapping>;

function legacySheen(value?: string): PaintSheen | undefined {
  const normalized = value?.trim().toLowerCase().replace(/-/g, "_");
  if (
    normalized === "gloss" ||
    normalized === "semi_gloss" ||
    normalized === "satin" ||
    normalized === "matte"
  ) {
    return normalized;
  }
  return undefined;
}

function displaySheen(sheen: PaintSheen) {
  return sheen.replace(/_/g, "-");
}
