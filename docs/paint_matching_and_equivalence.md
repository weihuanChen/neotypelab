# Paint Matching and Equivalence

P6 provides computed color similarity. P7 adds cross-brand conversion and
curated equivalence records.

## Computed matching

The matching engine requires a preferred D65/2deg LAB measurement for both
products. It applies classification filters before color distance:

1. Exclude inactive products and the source product.
2. Require the same complete `effects` set. Plain, metallic, pearl,
   fluorescent, and other effects do not cross-match.
3. Transparent paint only matches transparent paint. Unknown opacity may match
   opaque or unknown paint with a confidence penalty.
4. Rank remaining candidates by CIEDE2000, then apply secondary penalties for
   approximate data, missing opacity, different sheen, and different paint
   type.

`deltaE00` is always the unmodified CIEDE2000 value. `adjustedDistance` is used
for ordering when source quality or product metadata differs. `confidence` is
a bounded 0-1 quality signal and must not be presented as a physical color
measurement.

Match bands are:

| Band | Delta E 2000 |
| --- | --- |
| `very_close` | 0 through 2 |
| `close` | greater than 2 through 5 |
| `usable` | greater than 5 through 10 |
| `distant` | greater than 10 |

The default query excludes values above 20. Approximate digital charts receive
an `approximate_color_data` warning. Metallic, pearl, and color-shift matches
also warn that appearance is angle-dependent. Transparent matches warn that
the substrate affects appearance.

## Queries

`paintMatches:findSimilarPaints` returns LAB-ranked matches across the catalog.
It accepts an optional target brand, limit, and maximum Delta E.

`paintMatches:getCrossBrandConversions` excludes the source brand and returns:

- `curated`: active official, manual, or community equivalences.
- `computed`: CIEDE2000 candidates not already represented by a curated result.

Curated relations are bidirectional at read time. Only one relation is stored
for a paint pair and method.

## Curated equivalence

`paintMatches:upsertEquivalence` is restricted to platform administrators. It
supports `official_chart`, `manual_review`, and `community_chart` methods.
Confidence must be from 0 through 1. When both products have preferred
measurements, the mutation records the current Delta E and measurement IDs for
auditability. Current queries recalculate Delta E from the preferred
measurements so stale stored values do not override newer color data.

Curated equivalence means a trusted source or reviewer considers two products
usable alternatives. It does not bypass product classification warnings and
does not claim that metallic, transparent, pearl, or fluorescent paints are
fully described by a single LAB value.
