# Official style studies — P4

P4 introduces an editorial boundary between creation and indexed content:

- `/styles`: official collection, Featured and category filters.
- `/styles/:styleSlug`: style intent, palette language and reviewed kit studies.
- `/styles/:styleSlug/:modelSlug`: one reviewed public preview and its frozen catalog paint mapping.
- `/admin/style-editorial`: official intent authoring, review and withdrawal; linked from the style library.

## First content publication

1. Open the admin Style library and follow **Curate official style studies**.
2. Select an existing preset. Supply a complete Style Intent v1 with `source: official` and `styleType: preset`.
3. Save the intent. This also updates the preset's display name, while preserving its existing slug. It does not publish a page.
4. In Create, select that preset and a kit. Generate a palette, approve it, create the specification and render the preview using the normal credit flow.
5. Publish that concept using the existing owner publication workflow.
6. Return to the editorial workspace. Open the concept's preview and paint mapping, review them, confirm the checklist and publish the reviewed pairing.

This is explicit human review; neither popularity nor a successful generation marks paint mapping as reviewed. No sample content is inserted automatically, and custom concepts cannot be promoted through this P4 workflow.

Example intent for an existing preset (edit and review before saving):

```json
{
  "version": "style-intent.v1",
  "source": "official",
  "styleType": "preset",
  "name": "Crimson Command",
  "palette": {
    "primary": "deep crimson",
    "secondary": "charcoal",
    "accent": "muted gold"
  },
  "surfaceLogic": "Smooth painted armor over a dark mechanical frame",
  "graphicLanguage": "Restrained technical markings",
  "contrast": "high",
  "markingDensity": "low",
  "materialIntent": ["painted armor", "dark mechanical frame"],
  "mood": "commanding",
  "weathering": "clean",
  "finish": "satin",
  "paintability": "high"
}
```

## Publication contract

`styleEditorialReviews` stores one selected concept per preset/model pair, its exact public publication ID, frozen intent, palette and specification, reviewer and review time.

Public queries require an active official preset, a public model, a public generated/archived concept, a complete published rendition set, and unchanged snapshots. Private/unlisted sources, withdrawn/replaced publications, changed intent and edited palette/specification disappear from query results and the next recomputed sitemap. Existing sitemap HTTP caching still applies.

Reviewing requires a valid public paint projection and a real active catalog paint for each mapped entry. The page presents reviewed approximate catalog matches, not a physical swatch accuracy guarantee. Public payloads contain explicit fields only; no private storage keys, source prompts or raw snapshot metadata.

## SEO and compatibility

- Sitemap contains reviewed style and pairing URLs only; it does not enumerate the model/style cross product.
- Legacy `/:model/:style` URLs redirect with 301 when the corresponding reviewed pairing exists. Otherwise the existing view remains accessible with `noindex, follow`.
- Public Custom prototypes remain shareable but are excluded from the prototype sitemap and receive `noindex`, including older mixed records that still carry a preset ID.
- Missing/unavailable new pages are not indexed. Empty galleries do not claim published studies.
- JSON-LD escapes embedded HTML, and canonical/OG URLs are absolute.

## Generation compatibility

The current preset intent is included as `styleRevision` in Create's input key. A changed official intent invalidates recovered palettes and new generation requests with a stale revision fail before charging. Concepts continue to copy the approved palette composition's frozen intent rather than mutable live preset content. Legacy presets with no intent retain the previous input contract.

## Validation and rollout

The schema addition is additive. No new environment variables are required. Deploy backend/schema and frontend together; the frontend shows an unavailable state if the editorial API has not been deployed. Code generation updates generated API and route files through the supported tools.

Automated checks cover admin-only access, explicit review, no automatic indexing, private/custom exclusions, preview withdrawal, intent/palette drift, safe public projections, stale generation revisions, SSR links/JSON-LD and public route/auth gates.

Desktop (1280px) and mobile (390px) populated layouts were inspected with clearly marked test fixtures; those images are not generated model previews or production content. Authenticated live editorial publication and physical paint/image quality assessment have not been performed. The repository changes do not publish official content.

P5 adds community publication, save/use ranking and promotion into official preset drafts, together with private-style persistence and the Interpreter credit lifecycle. See [the P5 guide](community-styles-p5.md).
