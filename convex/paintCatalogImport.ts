import { Infer, v } from "convex/values";
import { internalMutation } from "./functions";
import {
  buildPaintExternalKey,
  buildPaintMeasurementKey,
  normalizePaintCodeForSearch,
  vPaintColorAccuracy,
  vPaintColorSourceAuthority,
  vPaintColorSourceType,
  vPaintColorSubstrate,
  vPaintEffect,
  vPaintOpacity,
  vPaintSheen,
  vPaintType,
} from "./paintCatalogDomain";
import { derivePaintColorFromHex, rgbToHex } from "./paintColor";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./types";

export const vPaintCatalogImportRecord = v.object({
  externalKey: v.string(),
  measurementKey: v.optional(v.string()),
  brandName: v.string(),
  brandSlug: v.string(),
  paintLineName: v.string(),
  paintLineSlug: v.string(),
  series: v.optional(v.string()),
  code: v.string(),
  normalizedCode: v.string(),
  name: v.string(),
  paintType: v.optional(vPaintType),
  sheen: v.optional(vPaintSheen),
  opacity: v.optional(vPaintOpacity),
  effects: v.array(vPaintEffect),
  hex: v.optional(v.string()),
  rgb: v.optional(v.object({ r: v.number(), g: v.number(), b: v.number() })),
  lab: v.optional(v.object({ l: v.number(), a: v.number(), b: v.number() })),
  measurementMethod: v.optional(v.string()),
  accuracy: v.optional(vPaintColorAccuracy),
  sourceAuthority: v.optional(vPaintColorSourceAuthority),
  sourceType: v.optional(vPaintColorSourceType),
  sourceName: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  substrate: v.optional(vPaintColorSubstrate),
  isPreferred: v.boolean(),
  isActive: v.boolean(),
  notes: v.optional(v.string()),
});
export type PaintCatalogImportRecord = Infer<typeof vPaintCatalogImportRecord>;

type ImportCounts = {
  brandsCreated: number;
  brandsUpdated: number;
  paintLinesCreated: number;
  paintLinesUpdated: number;
  paintMappingsCreated: number;
  paintMappingsUpdated: number;
  legacyMappingsClaimed: number;
  measurementsCreated: number;
  measurementsUpdated: number;
};

export const importBatch = internalMutation({
  args: {
    records: v.array(vPaintCatalogImportRecord),
    dryRun: v.boolean(),
  },
  handler: importPaintCatalogBatch,
});

export const backfillLegacySeedPaints = internalMutation({
  args: { dryRun: v.boolean() },
  async handler(ctx, { dryRun }) {
    return await importPaintCatalogBatch(ctx, {
      records: legacySeedPaintRecords(),
      dryRun,
    });
  },
});

export async function importPaintCatalogBatch(
  ctx: MutationCtx,
  { records, dryRun }: { records: PaintCatalogImportRecord[]; dryRun: boolean }
) {
  if (records.length === 0) {
    return { dryRun, processed: 0, ...emptyCounts() };
  }
  if (records.length > 50) {
    throw new Error("Paint catalog import batches are limited to 50 records");
  }

  validateBatch(records);
  const counts = emptyCounts();
  const now = Date.now();
  const existingMappings = await ctx.db.query("paintMappings").collect();
  const mappingsByExternalKey = new Map(
    existingMappings.flatMap((mapping) =>
      mapping.externalKey ? [[mapping.externalKey, mapping] as const] : []
    )
  );
  const legacyMappings = existingMappings.filter(
    (mapping) => mapping.externalKey === undefined
  );

  if (dryRun) {
    await previewBatch(ctx, records, mappingsByExternalKey, legacyMappings, counts);
    return { dryRun: true, processed: records.length, ...counts };
  }

  const brandIds = new Map<string, Id<"paintBrands">>();
  const paintLineIds = new Map<string, Id<"paintLines">>();
  for (const record of records) {
    const brandId = await upsertBrand(ctx, record, now, counts, brandIds);
    const paintLineId = await upsertPaintLine(
      ctx,
      record,
      brandId,
      now,
      counts,
      paintLineIds
    );
    let mapping = mappingsByExternalKey.get(record.externalKey) ?? null;
    if (mapping === null) {
      mapping = findLegacyMapping(record, legacyMappings);
      if (mapping) counts.legacyMappingsClaimed += 1;
    }

    const mappingFields = buildMappingFields(record, brandId, paintLineId);
    let paintMappingId: Id<"paintMappings">;
    if (mapping) {
      await ctx.db.patch(mapping._id, mappingFields);
      paintMappingId = mapping._id;
      counts.paintMappingsUpdated += 1;
    } else {
      paintMappingId = await ctx.db.insert("paintMappings", {
        ...mappingFields,
        mappingKey: record.externalKey.replace(/:/g, "-"),
      });
      counts.paintMappingsCreated += 1;
    }

    if (hasMeasurement(record)) {
      const existingMeasurement = await ctx.db
        .query("paintColorMeasurements")
        .withIndex("by_measurementKey", (q) =>
          q.eq("measurementKey", record.measurementKey)
        )
        .unique();
      const measurementFields = buildMeasurementFields(
        record,
        paintMappingId,
        now
      );
      let measurementId: Id<"paintColorMeasurements">;
      if (existingMeasurement) {
        await ctx.db.patch(existingMeasurement._id, measurementFields);
        measurementId = existingMeasurement._id;
        counts.measurementsUpdated += 1;
      } else {
        measurementId = await ctx.db.insert("paintColorMeasurements", {
          ...measurementFields,
          measurementKey: record.measurementKey,
          createdAt: now,
        });
        counts.measurementsCreated += 1;
      }
      if (record.isPreferred) {
        await ctx.db.patch(paintMappingId, {
          preferredMeasurementId: measurementId,
        });
      }
    }

    const updatedMapping = await ctx.db.get(paintMappingId);
    if (updatedMapping) {
      mappingsByExternalKey.set(record.externalKey, updatedMapping);
    }
  }

  return { dryRun: false, processed: records.length, ...counts };
}

async function previewBatch(
  ctx: MutationCtx,
  records: PaintCatalogImportRecord[],
  mappingsByExternalKey: Map<string, Doc<"paintMappings">>,
  legacyMappings: Doc<"paintMappings">[],
  counts: ImportCounts
) {
  const uniqueBrands = new Map(
    records.map((record) => [record.brandSlug, record] as const)
  );
  for (const record of Array.from(uniqueBrands.values())) {
    const brand = await ctx.db
      .query("paintBrands")
      .withIndex("by_slug", (q) => q.eq("slug", record.brandSlug))
      .unique();
    if (brand) counts.brandsUpdated += 1;
    else counts.brandsCreated += 1;
  }

  const uniqueLines = new Map(
    records.map((record) => [
      `${record.brandSlug}:${record.paintLineSlug}`,
      record,
    ] as const)
  );
  for (const record of Array.from(uniqueLines.values())) {
    const lines = await ctx.db
      .query("paintLines")
      .withIndex("by_slug", (q) => q.eq("slug", record.paintLineSlug))
      .collect();
    const matchingLine = await findLineForBrandSlug(ctx, lines, record.brandSlug);
    if (matchingLine) counts.paintLinesUpdated += 1;
    else counts.paintLinesCreated += 1;
  }

  for (const record of records) {
    const mapping =
      mappingsByExternalKey.get(record.externalKey) ??
      findLegacyMapping(record, legacyMappings);
    if (mapping) {
      counts.paintMappingsUpdated += 1;
      if (!mapping.externalKey) counts.legacyMappingsClaimed += 1;
    } else {
      counts.paintMappingsCreated += 1;
    }
    if (hasMeasurement(record)) {
      const measurement = await ctx.db
        .query("paintColorMeasurements")
        .withIndex("by_measurementKey", (q) =>
          q.eq("measurementKey", record.measurementKey)
        )
        .unique();
      if (measurement) counts.measurementsUpdated += 1;
      else counts.measurementsCreated += 1;
    }
  }
}

async function upsertBrand(
  ctx: MutationCtx,
  record: PaintCatalogImportRecord,
  now: number,
  counts: ImportCounts,
  cache: Map<string, Id<"paintBrands">>
) {
  const cached = cache.get(record.brandSlug);
  if (cached) return cached;
  const existing = await ctx.db
    .query("paintBrands")
    .withIndex("by_slug", (q) => q.eq("slug", record.brandSlug))
    .unique();
  const fields = {
    name: record.brandName,
    aliases: existing?.aliases ?? [],
    isActive: true,
    searchText: [record.brandName, ...(existing?.aliases ?? [])].join(" "),
    updatedAt: now,
  };
  const id = existing
    ? (await ctx.db.patch(existing._id, fields), existing._id)
    : await ctx.db.insert("paintBrands", {
        slug: record.brandSlug,
        createdAt: now,
        ...fields,
      });
  if (existing) counts.brandsUpdated += 1;
  else counts.brandsCreated += 1;
  cache.set(record.brandSlug, id);
  return id;
}

async function upsertPaintLine(
  ctx: MutationCtx,
  record: PaintCatalogImportRecord,
  brandId: Id<"paintBrands">,
  now: number,
  counts: ImportCounts,
  cache: Map<string, Id<"paintLines">>
) {
  const cacheKey = `${record.brandSlug}:${record.paintLineSlug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const existing = await ctx.db
    .query("paintLines")
    .withIndex("by_brand_slug", (q) =>
      q.eq("brandId", brandId).eq("slug", record.paintLineSlug)
    )
    .unique();
  const fields = {
    brandId,
    name: record.paintLineName,
    aliases: existing?.aliases ?? [],
    defaultPaintType: record.paintType,
    isActive: true,
    searchText: [record.brandName, record.paintLineName, record.paintType]
      .filter(Boolean)
      .join(" "),
    updatedAt: now,
  };
  const id = existing
    ? (await ctx.db.patch(existing._id, fields), existing._id)
    : await ctx.db.insert("paintLines", {
        slug: record.paintLineSlug,
        createdAt: now,
        ...fields,
      });
  if (existing) counts.paintLinesUpdated += 1;
  else counts.paintLinesCreated += 1;
  cache.set(cacheKey, id);
  return id;
}

function findLegacyMapping(
  record: PaintCatalogImportRecord,
  legacyMappings: Doc<"paintMappings">[]
) {
  const candidates = legacyMappings.filter((mapping) => {
    if (
      normalizePaintCodeForSearch(mapping.code) !== record.normalizedCode
    ) {
      return false;
    }
    return (
      equalCatalogName(mapping.brand, record.paintLineName) ||
      (equalCatalogName(mapping.brand, record.brandName) &&
        equalCatalogName(mapping.line, record.paintLineName))
    );
  });
  if (candidates.length > 1) {
    throw new Error(`Multiple legacy paint mappings match ${record.externalKey}`);
  }
  return candidates[0] ?? null;
}

function buildMappingFields(
  record: PaintCatalogImportRecord,
  brandId: Id<"paintBrands">,
  paintLineId: Id<"paintLines">
) {
  return {
    externalKey: record.externalKey,
    brandId,
    paintLineId,
    series: record.series,
    normalizedCode: record.normalizedCode,
    name: record.name,
    sheen: record.sheen,
    opacity: record.opacity,
    effects: record.effects,
    dataVersion: 1,
    brand: record.brandName,
    line: record.paintLineName,
    code: record.code,
    colorName: record.name,
    finishType: record.sheen?.replace("_", "-"),
    paintType: record.paintType,
    ...(record.hex ? { hexPreview: record.hex } : {}),
    isActive: record.isActive,
    searchText: [
      record.brandName,
      record.paintLineName,
      record.series,
      record.code,
      record.normalizedCode,
      record.name,
      record.paintType,
      record.sheen,
      record.opacity,
      ...record.effects,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildMeasurementFields(
  record: PaintCatalogImportRecord & Required<Pick<
    PaintCatalogImportRecord,
    | "measurementKey"
    | "hex"
    | "rgb"
    | "lab"
    | "accuracy"
    | "sourceAuthority"
    | "sourceType"
    | "sourceName"
    | "substrate"
  >>,
  paintMappingId: Id<"paintMappings">,
  now: number
) {
  const derived = derivePaintColorFromHex(record.hex);
  return {
    paintMappingId,
    hex: derived.hex,
    rgb: derived.rgb,
    rgbColorSpace: derived.rgbColorSpace,
    lab: derived.lab,
    labIlluminant: derived.labIlluminant,
    labObserver: derived.labObserver,
    labMethod: derived.labMethod,
    measurementMethod: record.measurementMethod,
    conversionVersion: derived.conversionVersion,
    accuracy: record.accuracy,
    sourceAuthority: record.sourceAuthority,
    sourceType: record.sourceType,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    substrate: record.substrate,
    notes: record.notes,
    updatedAt: now,
  };
}

function validateBatch(records: PaintCatalogImportRecord[]) {
  const externalKeys = new Set<string>();
  const measurementKeys = new Set<string>();
  for (const record of records) {
    const expectedExternalKey = buildPaintExternalKey(record);
    if (record.externalKey !== expectedExternalKey) {
      throw new Error(`Invalid external key ${record.externalKey}`);
    }
    if (record.normalizedCode !== normalizePaintCodeForSearch(record.code)) {
      throw new Error(`Invalid normalized code for ${record.externalKey}`);
    }
    const hasAnyMeasurementField = Boolean(
      record.measurementKey ||
        record.hex ||
        record.rgb ||
        record.lab ||
        record.measurementMethod ||
        record.accuracy ||
        record.sourceAuthority ||
        record.sourceType ||
        record.sourceName ||
        record.sourceUrl ||
        record.substrate
    );
    if (hasAnyMeasurementField && !hasMeasurement(record)) {
      throw new Error(`Incomplete measurement for ${record.externalKey}`);
    }
    if (hasMeasurement(record)) {
      const expectedMeasurementKey = buildPaintMeasurementKey({
        paintExternalKey: record.externalKey,
        sourceAuthority: record.sourceAuthority,
        sourceType: record.sourceType,
        substrate: record.substrate,
        sourceName: record.sourceName,
      });
      if (record.measurementKey !== expectedMeasurementKey) {
        throw new Error(`Invalid measurement key for ${record.externalKey}`);
      }
      if (rgbToHex(record.rgb) !== record.hex) {
        throw new Error(`HEX and RGB do not match for ${record.externalKey}`);
      }
      const derived = derivePaintColorFromHex(record.hex);
      if (
        !closeEnough(record.lab.l, derived.lab.l) ||
        !closeEnough(record.lab.a, derived.lab.a) ||
        !closeEnough(record.lab.b, derived.lab.b)
      ) {
        throw new Error(`LAB was not derived with the canonical algorithm for ${record.externalKey}`);
      }
      if (measurementKeys.has(record.measurementKey)) {
        throw new Error(`Duplicate measurement key ${record.measurementKey} in batch`);
      }
      measurementKeys.add(record.measurementKey);
    } else if (record.isPreferred) {
      throw new Error(`Missing preferred measurement for ${record.externalKey}`);
    }
    if (externalKeys.has(record.externalKey)) {
      throw new Error(`Duplicate external key ${record.externalKey} in batch`);
    }
    externalKeys.add(record.externalKey);
  }
}

function hasMeasurement(
  record: PaintCatalogImportRecord
): record is PaintCatalogImportRecord & Required<Pick<
  PaintCatalogImportRecord,
  | "measurementKey"
  | "hex"
  | "rgb"
  | "lab"
  | "accuracy"
  | "sourceAuthority"
  | "sourceType"
  | "sourceName"
  | "substrate"
>> {
  return Boolean(
    record.measurementKey &&
      record.hex &&
      record.rgb &&
      record.lab &&
      record.accuracy &&
      record.sourceAuthority &&
      record.sourceType &&
      record.sourceName &&
      record.substrate
  );
}

async function findLineForBrandSlug(
  ctx: MutationCtx,
  lines: Doc<"paintLines">[],
  brandSlug: string
) {
  for (const line of lines) {
    const brand = await ctx.db.get(line.brandId);
    if (brand?.slug === brandSlug) return line;
  }
  return null;
}

function equalCatalogName(left: string | undefined, right: string) {
  return left?.trim().toLowerCase() === right.trim().toLowerCase();
}

function closeEnough(left: number, right: number) {
  return Number.isFinite(left) && Math.abs(left - right) <= 1e-10;
}

function emptyCounts(): ImportCounts {
  return {
    brandsCreated: 0,
    brandsUpdated: 0,
    paintLinesCreated: 0,
    paintLinesUpdated: 0,
    paintMappingsCreated: 0,
    paintMappingsUpdated: 0,
    legacyMappingsClaimed: 0,
    measurementsCreated: 0,
    measurementsUpdated: 0,
  };
}

function legacySeedPaintRecords(): PaintCatalogImportRecord[] {
  return [
    legacySeedPaint({
      brandName: "Gaia Notes",
      brandSlug: "gaia-notes",
      paintLineName: "Nazca",
      paintLineSlug: "nazca",
      series: "N",
      code: "N-001",
      name: "Frost Matte White",
      paintType: "lacquer",
      sheen: "matte",
      effects: [],
      hex: "#D9DDE0",
    }),
    legacySeedPaint({
      brandName: "Gaia Notes",
      brandSlug: "gaia-notes",
      paintLineName: "Nazca",
      paintLineSlug: "nazca",
      series: "N",
      code: "N-014",
      name: "Warning Orange",
      paintType: "lacquer",
      sheen: "semi_gloss",
      effects: [],
      hex: "#D97523",
    }),
    legacySeedPaint({
      brandName: "GSI Creos",
      brandSlug: "gsi-creos",
      paintLineName: "Mr. Color",
      paintLineSlug: "mr-color",
      series: "SM",
      code: "SM201",
      name: "Super Iron",
      paintType: "lacquer",
      effects: ["metallic"],
      hex: "#646B73",
    }),
    legacySeedPaint({
      brandName: "Tamiya",
      brandSlug: "tamiya",
      paintLineName: "Acrylic",
      paintLineSlug: "acrylic",
      series: "X",
      code: "X-10",
      name: "Gun Metal",
      paintType: "acrylic",
      sheen: "semi_gloss",
      effects: ["metallic"],
      hex: "#5A6068",
    }),
  ];
}

function legacySeedPaint(input: {
  brandName: string;
  brandSlug: string;
  paintLineName: string;
  paintLineSlug: string;
  series: string;
  code: string;
  name: string;
  paintType: PaintCatalogImportRecord["paintType"];
  sheen?: PaintCatalogImportRecord["sheen"];
  effects: PaintCatalogImportRecord["effects"];
  hex: string;
}): PaintCatalogImportRecord {
  const externalKey = buildPaintExternalKey(input);
  const sourceAuthority = "internal" as const;
  const sourceType = "manual_estimate" as const;
  const substrate = "digital" as const;
  const sourceName = "NeotypeLab legacy seed";
  const color = derivePaintColorFromHex(input.hex);
  return {
    externalKey,
    measurementKey: buildPaintMeasurementKey({
      paintExternalKey: externalKey,
      sourceAuthority,
      sourceType,
      substrate,
      sourceName,
    }),
    brandName: input.brandName,
    brandSlug: input.brandSlug,
    paintLineName: input.paintLineName,
    paintLineSlug: input.paintLineSlug,
    series: input.series,
    code: input.code,
    normalizedCode: normalizePaintCodeForSearch(input.code),
    name: input.name,
    paintType: input.paintType,
    sheen: input.sheen,
    effects: input.effects,
    hex: color.hex,
    rgb: color.rgb,
    lab: color.lab,
    accuracy: "approximate",
    sourceAuthority,
    sourceType,
    sourceName,
    substrate,
    isPreferred: true,
    isActive: true,
    notes: "Migrated from NeotypeLab legacy seed data.",
  };
}
