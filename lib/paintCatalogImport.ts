import { parse } from "csv-parse/sync";
import {
  buildPaintExternalKey,
  buildPaintMeasurementKey,
  canonicalizePaintBrandSlug,
  canonicalizePaintLineSlug,
  PAINT_CATALOG_CONTRACT_VERSION,
  PAINT_COLOR_ACCURACIES,
  PAINT_COLOR_SOURCE_AUTHORITIES,
  PAINT_COLOR_SOURCE_TYPES,
  PAINT_COLOR_SUBSTRATES,
  PAINT_EFFECTS,
  PAINT_OPACITIES,
  PAINT_SHEENS,
  PAINT_TYPES,
  normalizePaintCodeForSearch,
  type PaintColorAccuracy,
  type PaintColorSourceAuthority,
  type PaintColorSourceType,
  type PaintColorSubstrate,
  type PaintEffect,
  type PaintOpacity,
  type PaintSheen,
  type PaintType,
} from "@/convex/paintCatalogDomain";
import {
  derivePaintColorFromHex,
  rgbToHex,
  type LabColor,
  type RgbColor,
} from "@/convex/paintColor";

export const PAINT_CATALOG_IMPORT_COLUMNS = [
  "schemaVersion",
  "externalKey",
  "brandName",
  "brandSlug",
  "paintLineName",
  "paintLineSlug",
  "series",
  "code",
  "normalizedCode",
  "name",
  "paintType",
  "sheen",
  "opacity",
  "effects",
  "hex",
  "rgbR",
  "rgbG",
  "rgbB",
  "rgbColorSpace",
  "labL",
  "labA",
  "labB",
  "illuminant",
  "observer",
  "measurementMethod",
  "accuracy",
  "sourceAuthority",
  "sourceType",
  "sourceName",
  "sourceUrl",
  "substrate",
  "isPreferred",
  "isActive",
  "notes",
] as const;

export type PaintCatalogImportRecord = {
  externalKey: string;
  measurementKey?: string;
  brandName: string;
  brandSlug: string;
  paintLineName: string;
  paintLineSlug: string;
  series?: string;
  code: string;
  normalizedCode: string;
  name: string;
  paintType?: PaintType;
  sheen?: PaintSheen;
  opacity?: PaintOpacity;
  effects: PaintEffect[];
  hex?: string;
  rgb?: RgbColor;
  lab?: LabColor;
  measurementMethod?: string;
  accuracy?: PaintColorAccuracy;
  sourceAuthority?: PaintColorSourceAuthority;
  sourceType?: PaintColorSourceType;
  sourceName?: string;
  sourceUrl?: string;
  substrate?: PaintColorSubstrate;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
};

export type PaintCatalogImportIssue = {
  severity: "error" | "warning";
  row: number;
  field?: string;
  code: string;
  message: string;
};

export type PaintCatalogImportResult = {
  records: PaintCatalogImportRecord[];
  rowCount: number;
  errors: PaintCatalogImportIssue[];
  warnings: PaintCatalogImportIssue[];
};

type CsvRow = Record<string, string>;

export function parsePaintCatalogCsv(csvText: string): PaintCatalogImportResult {
  const issues: PaintCatalogImportIssue[] = [];
  let headers: string[] = [];
  let rows: CsvRow[];

  try {
    rows = parse(csvText, {
      bom: true,
      columns: (rawHeaders: string[]) => {
        headers = rawHeaders.map((header) => header.trim());
        return headers;
      },
      skip_empty_lines: true,
      trim: false,
    });
  } catch (error) {
    return {
      records: [],
      rowCount: 0,
      errors: [
        {
          severity: "error",
          row: 1,
          code: "invalid_csv",
          message: error instanceof Error ? error.message : "CSV parsing failed",
        },
      ],
      warnings: [],
    };
  }

  validateHeaders(headers, issues);
  const records = rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const rowIssuesBefore = issues.length;
    const record = parseRow(row, rowNumber, issues);
    const hasNewError = issues
      .slice(rowIssuesBefore)
      .some((issue) => issue.severity === "error");
    return record && !hasNewError ? [record] : [];
  });

  reportDuplicateValues(records, "externalKey", issues);
  reportDuplicateValues(
    records.filter((record) => record.measurementKey),
    "measurementKey",
    issues
  );

  return {
    records,
    rowCount: rows.length,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

function parseRow(
  row: CsvRow,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
): PaintCatalogImportRecord | null {
  const schemaVersion = required(row, "schemaVersion", rowNumber, issues);
  const suppliedExternalKey = required(row, "externalKey", rowNumber, issues);
  const brandName = required(row, "brandName", rowNumber, issues);
  const suppliedBrandSlug = required(row, "brandSlug", rowNumber, issues);
  const brandSlug = suppliedBrandSlug
    ? canonicalizePaintBrandSlug(suppliedBrandSlug)
    : "";
  const paintLineName = required(row, "paintLineName", rowNumber, issues);
  const suppliedPaintLineSlug = required(row, "paintLineSlug", rowNumber, issues);
  const paintLineSlug = suppliedPaintLineSlug
    ? canonicalizePaintLineSlug({ brandSlug, paintLineSlug: suppliedPaintLineSlug })
    : "";
  const code = required(row, "code", rowNumber, issues);
  const name = required(row, "name", rowNumber, issues);
  const hex = optional(row, "hex");

  if (schemaVersion && schemaVersion !== PAINT_CATALOG_CONTRACT_VERSION) {
    error(issues, rowNumber, "schemaVersion", "unsupported_schema_version", `Expected ${PAINT_CATALOG_CONTRACT_VERSION}`);
  }

  const normalizedCode = code ? normalizePaintCodeForSearch(code) : "";
  const suppliedNormalizedCode = optional(row, "normalizedCode");
  if (suppliedNormalizedCode && suppliedNormalizedCode !== normalizedCode) {
    warning(
      issues,
      rowNumber,
      "normalizedCode",
      "normalized_code_replaced",
      `Replaced ${suppliedNormalizedCode} with canonical value ${normalizedCode}`
    );
  }

  let externalKey = suppliedExternalKey;
  if (suppliedExternalKey && suppliedBrandSlug && brandSlug && paintLineSlug && code) {
    try {
      const expectedExternalKey = buildPaintExternalKey({
        brandSlug,
        paintLineSlug,
        code,
      });
      if (
        suppliedExternalKey !== expectedExternalKey &&
        isEquivalentSuppliedExternalKey(suppliedExternalKey, {
          brandSlug,
          paintLineSlug,
          normalizedCode,
        })
      ) {
        warning(
          issues,
          rowNumber,
          "externalKey",
          "external_key_replaced",
          `Replaced ${suppliedExternalKey} with canonical value ${expectedExternalKey}`
        );
        externalKey = expectedExternalKey;
      } else if (suppliedExternalKey !== expectedExternalKey) {
        error(issues, rowNumber, "externalKey", "external_key_mismatch", `Expected ${expectedExternalKey}`);
      }
    } catch (caught) {
      error(
        issues,
        rowNumber,
        "externalKey",
        "invalid_external_key_parts",
        caught instanceof Error ? caught.message : "Invalid external key fields"
      );
    }
  }

  const paintType = enumValue(row, "paintType", PAINT_TYPES, rowNumber, issues);
  const sheen = parseSheen(row, rowNumber, issues);
  const opacity = enumValue(row, "opacity", PAINT_OPACITIES, rowNumber, issues);
  const effects = parseEffects(row, rowNumber, issues);
  let isPreferred = booleanValue(row, "isPreferred", rowNumber, issues);
  const isActive = booleanValue(row, "isActive", rowNumber, issues);
  let rgb: RgbColor | undefined;
  let derivedColor: ReturnType<typeof derivePaintColorFromHex> | null = null;
  if (hex) {
    expectValue(row, "rgbColorSpace", "srgb", rowNumber, issues);
    expectOptionalValue(row, "illuminant", "D65", rowNumber, issues);
    expectOptionalValue(row, "observer", "2deg", rowNumber, issues);
    required(row, "measurementMethod", rowNumber, issues);
    rgb = {
      r: integerValue(row, "rgbR", rowNumber, issues, 0, 255),
      g: integerValue(row, "rgbG", rowNumber, issues, 0, 255),
      b: integerValue(row, "rgbB", rowNumber, issues, 0, 255),
    };
    try {
      derivedColor = derivePaintColorFromHex(hex);
      if (
        rgb && Number.isInteger(rgb.r) &&
        Number.isInteger(rgb.g) &&
        Number.isInteger(rgb.b) &&
        rgbToHex(rgb) !== derivedColor.hex
      ) {
        error(
          issues,
          rowNumber,
          "rgbR",
          "hex_rgb_mismatch",
          `HEX ${derivedColor.hex} does not match RGB ${rgb.r},${rgb.g},${rgb.b}`
        );
      }
    } catch (caught) {
      error(
        issues,
        rowNumber,
        "hex",
        "invalid_hex",
        caught instanceof Error ? caught.message : "Invalid HEX color"
      );
    }
  } else {
    const unexpectedMeasurementFields = [
      "rgbR",
      "rgbG",
      "rgbB",
      "rgbColorSpace",
      "labL",
      "labA",
      "labB",
      "illuminant",
      "observer",
      "measurementMethod",
      "accuracy",
      "sourceAuthority",
      "sourceType",
      "sourceName",
      "sourceUrl",
      "substrate",
    ].filter((field) => optional(row, field));
    if (unexpectedMeasurementFields.length > 0) {
      error(
        issues,
        rowNumber,
        "hex",
        "incomplete_measurement",
        `HEX is required when measurement fields are populated: ${unexpectedMeasurementFields.join(", ")}`
      );
    }
    if (isPreferred === true) {
      warning(
        issues,
        rowNumber,
        "isPreferred",
        "preferred_disabled_without_measurement",
        "Changed isPreferred to false because the product has no color measurement"
      );
      isPreferred = false;
    }
  }

  const accuracy = enumValue(
    row,
    "accuracy",
    PAINT_COLOR_ACCURACIES,
    rowNumber,
    issues,
    Boolean(hex)
  );
  const sourceAuthority = enumValue(
    row,
    "sourceAuthority",
    PAINT_COLOR_SOURCE_AUTHORITIES,
    rowNumber,
    issues,
    Boolean(hex)
  );
  const sourceType = enumValue(
    row,
    "sourceType",
    PAINT_COLOR_SOURCE_TYPES,
    rowNumber,
    issues,
    Boolean(hex)
  );
  const substrate = enumValue(
    row,
    "substrate",
    PAINT_COLOR_SUBSTRATES,
    rowNumber,
    issues,
    Boolean(hex)
  );
  const sourceName = hex
    ? required(row, "sourceName", rowNumber, issues)
    : optional(row, "sourceName");

  const suppliedLab = ["labL", "labA", "labB"].map((field) => optional(row, field));
  const populatedLabCount = suppliedLab.filter(Boolean).length;
  if (populatedLabCount > 0 && populatedLabCount < 3) {
    error(
      issues,
      rowNumber,
      "labL",
      "partial_lab",
      "LAB must provide all three channels or leave all three blank"
    );
  } else if (populatedLabCount === 3) {
    warning(
      issues,
      rowNumber,
      "labL",
      "lab_recalculated",
      "Supplied LAB was ignored and recalculated with srgb-d65-cielab-v1"
    );
  }

  const sourceUrl = optional(row, "sourceUrl");
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
    } catch {
      error(issues, rowNumber, "sourceUrl", "invalid_source_url", "Source URL must be an HTTP or HTTPS URL");
    }
  }

  if (
    !externalKey ||
    !brandName ||
    !brandSlug ||
    !paintLineName ||
    !paintLineSlug ||
    !code ||
    !normalizedCode ||
    !name ||
    isPreferred === null ||
    isActive === null
  ) {
    return null;
  }

  let measurementKey: string | undefined;
  if (derivedColor && accuracy && sourceAuthority && sourceType && sourceName && substrate) {
    try {
      measurementKey = buildPaintMeasurementKey({
        paintExternalKey: externalKey,
        sourceAuthority,
        sourceType,
        substrate,
        sourceName,
      });
    } catch (caught) {
      error(
        issues,
        rowNumber,
        "sourceName",
        "invalid_measurement_key",
        caught instanceof Error ? caught.message : "Could not build measurement key"
      );
      return null;
    }
  } else if (hex) {
    return null;
  }

  return {
    externalKey,
    measurementKey,
    brandName,
    brandSlug,
    paintLineName,
    paintLineSlug,
    series: optional(row, "series"),
    code,
    normalizedCode,
    name,
    paintType,
    sheen,
    opacity,
    effects,
    hex: derivedColor?.hex,
    rgb: derivedColor?.rgb,
    lab: derivedColor?.lab,
    measurementMethod: optional(row, "measurementMethod"),
    accuracy,
    sourceAuthority,
    sourceType,
    sourceName,
    sourceUrl,
    substrate,
    isPreferred,
    isActive,
    notes: optional(row, "notes"),
  };
}

function validateHeaders(headers: string[], issues: PaintCatalogImportIssue[]) {
  const expected = new Set<string>(PAINT_CATALOG_IMPORT_COLUMNS);
  const actual = new Set(headers);
  for (const column of PAINT_CATALOG_IMPORT_COLUMNS) {
    if (!actual.has(column)) {
      error(issues, 1, column, "missing_column", `Missing required column ${column}`);
    }
  }
  for (const column of headers) {
    if (!expected.has(column)) {
      error(issues, 1, column, "unexpected_column", `Unexpected column ${column}`);
    }
  }
  if (actual.size !== headers.length) {
    error(issues, 1, undefined, "duplicate_column", "CSV contains duplicate column names");
  }
}

function isEquivalentSuppliedExternalKey(
  value: string,
  expected: {
    brandSlug: string;
    paintLineSlug: string;
    normalizedCode: string;
  }
) {
  const parts = value.split(":");
  return (
    parts.length === 3 &&
    canonicalizePaintBrandSlug(parts[0]) === expected.brandSlug &&
    parts[1] === expected.paintLineSlug &&
    normalizePaintCodeForSearch(parts[2]) === expected.normalizedCode
  );
}

function parseSheen(
  row: CsvRow,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const value = optional(row, "sheen");
  if (!value) return undefined;
  if (value === "semi-gloss") {
    warning(
      issues,
      rowNumber,
      "sheen",
      "sheen_alias_normalized",
      "Normalized semi-gloss to semi_gloss"
    );
    return "semi_gloss" as const;
  }
  return enumValue(row, "sheen", PAINT_SHEENS, rowNumber, issues);
}

function parseEffects(
  row: CsvRow,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const raw = optional(row, "effects");
  if (!raw) return [];
  const values = Array.from(
    new Set(raw.split(/[|;]/).map((value) => value.trim()).filter(Boolean))
  );
  const valid = values.filter((value): value is PaintEffect =>
    (PAINT_EFFECTS as readonly string[]).includes(value)
  );
  for (const value of values) {
    if (!valid.includes(value as PaintEffect)) {
      error(
        issues,
        rowNumber,
        "effects",
        "invalid_enum",
        `Unsupported effects value ${value}`
      );
    }
  }
  return valid;
}

function required(
  row: CsvRow,
  field: string,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const value = optional(row, field);
  if (!value) {
    error(issues, rowNumber, field, "required_value", `${field} is required`);
    return "";
  }
  return value;
}

function optional(row: CsvRow, field: string) {
  const value = row[field]?.trim();
  return value ? value : undefined;
}

function enumValue<const T extends readonly string[]>(
  row: CsvRow,
  field: string,
  allowed: T,
  rowNumber: number,
  issues: PaintCatalogImportIssue[],
  requiredValue = false
): T[number] | undefined {
  const value = optional(row, field);
  if (!value) {
    if (requiredValue) {
      error(issues, rowNumber, field, "required_value", `${field} is required`);
    }
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(value)) {
    error(
      issues,
      rowNumber,
      field,
      "invalid_enum",
      `${field} must be one of ${allowed.join(", ")}`
    );
    return undefined;
  }
  return value;
}

function booleanValue(
  row: CsvRow,
  field: string,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const value = optional(row, field)?.toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  error(
    issues,
    rowNumber,
    field,
    "invalid_boolean",
    `${field} must be explicitly true or false`
  );
  return null;
}

function integerValue(
  row: CsvRow,
  field: string,
  rowNumber: number,
  issues: PaintCatalogImportIssue[],
  minimum: number,
  maximum: number
) {
  const raw = required(row, field, rowNumber, issues);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    error(
      issues,
      rowNumber,
      field,
      "invalid_integer",
      `${field} must be an integer from ${minimum} through ${maximum}`
    );
  }
  return value;
}

function expectValue(
  row: CsvRow,
  field: string,
  expected: string,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const value = required(row, field, rowNumber, issues);
  if (value && value !== expected) {
    error(issues, rowNumber, field, "unsupported_value", `${field} must be ${expected}`);
  }
}

function expectOptionalValue(
  row: CsvRow,
  field: string,
  expected: string,
  rowNumber: number,
  issues: PaintCatalogImportIssue[]
) {
  const value = optional(row, field);
  if (value && value !== expected) {
    error(issues, rowNumber, field, "unsupported_value", `${field} must be ${expected} when provided`);
  }
}

function reportDuplicateValues(
  records: PaintCatalogImportRecord[],
  field: "externalKey" | "measurementKey",
  issues: PaintCatalogImportIssue[]
) {
  const rowsByValue = new Map<string, number[]>();
  records.forEach((record, index) => {
    const value = record[field];
    if (!value) return;
    const rows = rowsByValue.get(value) ?? [];
    rows.push(index + 2);
    rowsByValue.set(value, rows);
  });
  for (const [value, rows] of Array.from(rowsByValue.entries())) {
    if (rows.length > 1) {
      for (const row of rows) {
        error(
          issues,
          row,
          field,
          "duplicate_value",
          `${field} ${value} is duplicated on rows ${rows.join(", ")}`
        );
      }
    }
  }
}

function error(
  issues: PaintCatalogImportIssue[],
  row: number,
  field: string | undefined,
  code: string,
  message: string
) {
  issues.push({ severity: "error", row, field, code, message });
}

function warning(
  issues: PaintCatalogImportIssue[],
  row: number,
  field: string | undefined,
  code: string,
  message: string
) {
  issues.push({ severity: "warning", row, field, code, message });
}
