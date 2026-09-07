# Paint Catalog Import

The P3 importer validates and normalizes `paint-catalog.v1` CSV files before
they reach Convex. The default command is a local dry-run and makes no database
calls.

## Commands

Local validation and normalization preview:

```bash
npm run import:paint-catalog -- /absolute/path/catalog.csv
```

Compare valid records with the development deployment without writing:

```bash
npm run import:paint-catalog -- /absolute/path/catalog.csv --preview-db
```

Push the local Convex functions before a development preview when needed:

```bash
npm run import:paint-catalog -- /absolute/path/catalog.csv --preview-db --push
```

Write only after a clean local dry-run and database preview:

```bash
npm run import:paint-catalog -- /absolute/path/catalog.csv --write --yes
```

Production writes require both the write confirmation and production flag:

```bash
npm run import:paint-catalog -- /absolute/path/catalog.csv --write --yes --prod
```

Any validation error blocks the entire file before a database call. Warnings
describe deterministic normalization and do not block an import.

## Validation rules

- UTF-8 BOM is accepted and removed.
- The 34 columns in `paint-catalog.v1` are required.
- `externalKey`, HEX/RGB agreement, enums, URLs, and explicit booleans are
  validated.
- `isPreferred` and `isActive` must be exactly `true` or `false`. Blank values
  are never guessed.
- `semi-gloss` is accepted as an import alias and stored as `semi_gloss`.
- Supplied padded codes such as `C001` are reported and replaced with the P0
  canonical search code `C1`. The official display code remains `C1`.
- LAB input is recalculated through `srgb-d65-cielab-v1`; supplied LAB values
  do not override the canonical algorithm.
- Empty optional classifications remain absent. Effects are pipe- or
  semicolon-separated and deduplicated.

## Database behavior

The importer writes batches of at most 50 records through the internal Convex
mutation `paintCatalogImport:importBatch`. Product and measurement upserts use
stable `externalKey` and `measurementKey` values.

During the compatibility period, a new product may claim a legacy
`paintMappings` record when its code matches and the old brand value matches
the new paint-line name. The mutation preserves that record's `mappingKey`, so
existing spray-plan recommendation rules continue to work. New records also
dual-write the current display fields until the P5 read migration is complete.

The CSV `isPreferred` flag is resolved into
`paintMappings.preferredMeasurementId`; measurement records do not store a
second preference flag.
