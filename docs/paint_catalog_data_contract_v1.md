# Paint Catalog Data Contract V1

Status: frozen for P0

Contract version: `paint-catalog.v1`

This contract defines the canonical vocabulary and identity rules for paint
catalog imports. It does not change the current Convex schema. P1 implements
the color conversion named here, and P2 adds the new fields and measurement
table.

P1 color implementation: `convex/paintColor.ts`

P2 schema implementation: `convex/schema.ts`

P3 import implementation: `lib/paintCatalogImport.ts`,
`scripts/importPaintCatalog.ts`, and `convex/paintCatalogImport.ts`

P4 compatibility backfill: `paintCatalogImport:backfillLegacySeedPaints`

P5 compatibility reads: `convex/paintCatalogCompatibility.ts`

P6-P7 matching and equivalence: `convex/paintMatchingEngine.ts` and
`convex/paintMatches.ts`

The P2 relationship is:

```text
paintBrands -> paintLines -> paintMappings -> paintColorMeasurements
                                  |
                                  +-> preferredMeasurementId
```

`paintMappings` retains its current required legacy fields during migration.
The normalized identity and classification fields are optional until P4
backfill is complete. A measurement does not store `isPreferred`; the import
flag is resolved into the single `paintMappings.preferredMeasurementId`
pointer so preference cannot have two conflicting sources of truth.

## Product identity

A paint product is identified by its manufacturer, product line, and official
catalog code.

| Field | Meaning | Example |
| --- | --- | --- |
| `brand` | Manufacturer or corporate brand | `GSI Creos` |
| `brandSlug` | Stable lowercase brand key | `gsi-creos` |
| `paintLine` | Commercial paint line | `Mr. Color` |
| `paintLineSlug` | Stable lowercase line key | `mr-color` |
| `series` | Catalog family within the line | `C` |
| `code` | Official display code, preserved verbatim | `C5` |
| `normalizedCode` | Uppercase ASCII code with punctuation removed | `C5` |
| `name` | Manufacturer-facing color name | `Blue` |
| `externalKey` | Import identity | `gsi-creos:mr-color:c5` |

`externalKey` is unique. Names and display formatting may change without
changing identity. Normalization never adds zero padding: `C1` and `C01`
remain distinct catalog codes.

## Product classification

Missing information is omitted. Importers must not guess a classification and
must not store sentinel strings such as `unknown`, `n/a`, or `none`.

### Paint type

`lacquer`, `acrylic`, `enamel`, `water_based`, `urethane`, `oil`, `other`

Paint type describes the paint chemistry or working system. It does not
describe sheen or visual effect.

### Sheen

`gloss`, `semi_gloss`, `satin`, `matte`

Sheen describes surface gloss only. `metallic`, `pearl`, and `clear` are not
sheen values.

### Opacity

`opaque`, `translucent`, `transparent`

### Effects

`metallic`, `pearl`, `fluorescent`, `candy`, `clear`, `color_shift`, `texture`,
`prism`, `matting_agent`

Effects are stored as an array because a product can have more than one. A
normal solid color uses an empty array.

## Color measurement provenance

Color data belongs to a measurement record rather than directly to product
identity. One product may have multiple measurements from different sources,
substrates, or methods.

| Field | Allowed values or format |
| --- | --- |
| `hex` | Uppercase `#RRGGBB` sRGB |
| `rgb` | Integer channels from 0 through 255 |
| `rgbColorSpace` | `srgb` |
| `lab` | Full-precision finite `L*`, `a*`, and `b*` values |
| `labIlluminant` | `D65` |
| `labObserver` | `2deg` |
| `labMethod` | `derived_from_srgb`, `instrument_measured` |
| `conversionVersion` | `srgb-d65-cielab-v1` when LAB is derived |
| `accuracy` | `approximate`, `manufacturer_reported`, `measured` |
| `sourceAuthority` | `official`, `third_party`, `community`, `internal` |
| `sourceType` | See canonical values below |
| `substrate` | See canonical values below |

Canonical source types are `digital_color_chart`, `physical_measurement`,
`scanned_color_chart`, `product_page`, `conversion_chart`, `manual_estimate`,
`painted_sample_image`, and `other`.

Canonical substrates are `digital`, `white_primer`, `gray_primer`,
`black_primer`, `bare_material`, and `other`.

For `srgb-d65-cielab-v1`, LAB is derived through this fixed chain:

```text
HEX/sRGB -> linear RGB -> XYZ D65 -> CIELAB D65/2deg
```

Derived LAB inherits the accuracy of its source RGB value. Conversion does not
turn an approximate digital chart into a physical measurement.
Instrument measurements must use `instrument_measured` and be configured or
exported as D65/2deg before entering the canonical `lab` field. Measurements in
another illuminant or observer space must not be relabeled as D65/2deg; a later
schema version must preserve their raw conditions and define any chromatic
adaptation explicitly. Instrument measurements do not use the sRGB conversion
version.

Every measurement has a stable, globally unique `measurementKey`. The
`paintMappings.preferredMeasurementId` pointer selects the measurement used for
display and matching. Measurement records themselves do not duplicate that
preference state.

## Legacy field mapping

P2 and later migrations use these compatibility rules:

| Current field | Canonical destination | Rule |
| --- | --- | --- |
| `brand` | `brand` or `paintLine` | Review existing values; `Mr. Color` is a line, not the manufacturer |
| `line` | `paintLine` or `series` | Review existing values because current semantics are mixed |
| `colorName` | `name` | Direct rename after compatibility period |
| `paintType` | `paintType` | Normalize only when source meaning is known |
| `finishType` | `sheen` or `effects[]` | Map gloss terms to sheen and `metallic` to effects |
| `hexPreview` | Preferred measurement `hex` | Mark existing seed values as approximate |
| `mappingKey` | Legacy recommendation key | Do not use as future catalog identity |

Existing spray-plan JSON snapshots remain immutable historical records. New
catalog fields are used only when a plan version is regenerated.

## Import example

```text
brand: GSI Creos
brandSlug: gsi-creos
paintLine: Mr. Color
paintLineSlug: mr-color
series: C
code: C5
normalizedCode: C5
externalKey: gsi-creos:mr-color:c5
name: Blue
paintType: lacquer
sheen: gloss
hex: #0054A7
accuracy: approximate
sourceAuthority: third_party
sourceType: digital_color_chart
```
