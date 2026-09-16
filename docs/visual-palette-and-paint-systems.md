# Visual palette and paint systems

The rendered image and the practical shopping recommendation are separate
artifacts.

## Visual palette

`concepts.visualPaletteJson` stores `visual-palette.v2`. Its entries contain:

- the catalog color-role slug and display name;
- `targetHex`, the color the renderer should show;
- `paintEffect` (`solid`, `metallic`, or `transparent`);
- a short rationale and the role's recommended area.

The render prompt is built from `visualPaletteForRender`. It deliberately omits
brand, line, series, product code, mapping key and all other product identity.
The prompt and negative prompt also prohibit labels, HEX text, palette legends,
color charts, callouts and specification sheets. This prevents the image model
from treating a paint code as visible artwork.

## Paint recommendation sets

`concepts.paintRecommendationSetsJson` stores `paint-recommendations.v1`. The
matcher groups available colors by `paintLineId`, then chooses the nearest
compatible color for every visual role in each system. Compatibility preserves
solid, metallic and transparent effects. Systems are ranked by:

1. complete role coverage;
2. weighted average CIEDE2000 distance, giving primary and secondary armor more
   weight than markings;
3. the worst role distance;
4. a stable label tie-breaker.

Mr. Color is scoped to series `C`; its label is **Mr. Color C Series**. Tamiya
Color Acrylic is grouped as **Tamiya Acrylic (XF/X)** so XF colors cover opaque
armor and X colors cover transparent optics. Other product lines remain
available when their catalog data can cover the palette. Every match records
the target HEX, matched code, ΔE00, match band and warnings. Approximate digital
color data is called out rather than presented as a physical guarantee.

The primary set is materialized into the compatibility `palettePlanJson` used by
shopping and spray-plan consumers. The visual palette and recommendation sets
remain the authoritative new fields; `palettePlanJson` is a backwards-compatible
projection for existing consumers and old records.

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
