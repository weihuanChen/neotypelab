# Visual palette and paint systems

The rendered image and the practical shopping recommendation are separate
artifacts.

## Visual palette

New `concepts.visualPaletteJson` records store `visual-palette.v3`; frozen v2
records continue to work. New entries contain:

- an independent `colorId` and `colorName`;
- a catalog color-role slug and display name as a usage hint, allowing repeat roles;
- `targetHex`, the color the renderer should show;
- `paintEffect` (`solid`, `metallic`, or `transparent`);
- a short rationale and the role's recommended area;
- optional coverage with its scope, percentage and source (`ai-allocation` or
  `resolved-constraint`).

`concepts.resolvedIntentJson` freezes `creative-intent.v1`, including original
Style provenance, effective requirements, decisions and per-property constraints.
Only the effective execution projection enters later model prompts. The original
Style and Notes do not reinstate overridden colors or finishes. Explicit color
families and exact HEX requests are separate, and AI-estimated coverage is soft
guidance. Nonempty refinements use one ordinary normalization request before the
deterministic resolver; legacy saved descriptions are normalized when needed.

`repaint-specification.v3` assigns colors through `assignmentId`, `colorId`, usage
role and existing kit areas. A color can have multiple assignments and span
multiple roles. Color completeness and hard constraints are checked before results
are accepted. Typed material finish and intent preserve resolved surface requests.

The render prompt is built from `visualPaletteForRender`. It deliberately omits
brand, line, series, product code, mapping key and all other product identity.
The prompt and negative prompt also prohibit labels, HEX text, palette legends,
color charts, callouts and specification sheets. This prevents the image model
from treating a paint code as visible artwork.

## Paint recommendation sets

New `concepts.paintRecommendationSetsJson` records store `paint-recommendations.v3`;
earlier versions remain readable. The matcher groups available colors by
`paintLineId`, then chooses the nearest compatible paint for every independent
visual color in each system. Compatibility preserves
solid, metallic and transparent effects. Systems are ranked by:

1. complete color coverage;
2. weighted average CIEDE2000 distance, giving primary and secondary armor more
   weight than markings;
3. the worst color distance;
4. a stable label tie-breaker.

Mr. Color is scoped to series `C`; its label is **Mr. Color C Series**. Tamiya
Color Acrylic is grouped as **Tamiya Acrylic (XF/X)** so XF colors cover opaque
armor and X colors cover transparent optics. Other product lines remain
available when their catalog data can cover the palette. Every match records
the target HEX, matched code, ΔE00, match band and warnings. Approximate digital
color data is called out rather than presented as a physical guarantee.

V3 sets preserve `colorId` and identify unmatched targets with `missingColorIds`.
The matcher runs in O(colors × catalog samples), and the same sufficiently close
SKU may cover multiple targets. Catalog availability never changes visual targets.

The primary set is materialized into the compatibility `palettePlanJson` used by
shopping and spray-plan consumers. The visual palette and recommendation sets
remain the authoritative new fields; `palettePlanJson` is a backwards-compatible
projection for existing consumers and old records. New projections retain every
color and its identity, even when role slugs repeat.

## Legacy records

Older concepts do not need a destructive migration. `visualPaletteFromLegacyPlan`
recovers a target from an existing `targetHex`, the rationale's `Target #RRGGBB`,
or the frozen matched paint HEX. Their historical `palettePlanJson` is not
rewritten. New Library detail reads expose the recovered visual colors and
recompute recommendation sets against the current catalog when a stored set is
not present.

## Configuration

Run the normal creative setup after deploying code so the latest HD Render
template is published as `render.v2` and includes the label suppression rules:

```bash
npx convex run creativeSetup:configure '{"textModelId":"gemini-3.5-flash"}' --push
```

The setup is idempotent. It preserves earlier prompt versions and creates or
updates the single published `render.v2` version for each active HD Render
template.
