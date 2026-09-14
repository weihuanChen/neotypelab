# Two-step Create and Auto refinements

Create opens at **01 Style**. Preset cards use reviewed editorial previews when available; other presets show a labeled direction instead of a fabricated preview. Custom includes the existing Interpreter, My Styles and Community picker. A selected preset or confirmed saved custom intent enables **Apply to a model**.

**02 Model** retains a style snapshot and a Change style control, adds kit text search alongside existing filters, and keeps planning, approval and render controls within the same step. There is no third navigation step.

Finish, Weathering, Mood, notes and visibility are grouped under collapsed **Refine · Optional**. Finish and Weathering default to Auto; an empty mood selection means use the intent's mood.

The pure shared resolver chooses a real material catalog entry using the intent finish (matte/flat, satin/semi-gloss, gloss), then a curated recommended material, then the first available material. Legacy styles prioritize their curated recommendation. The actual resolved material is shown, so a fallback is not mislabeled as an exact finish match. Empty material catalogs disable generation.

Auto resolves in the frontend to explicit material ID and weathering values before the existing backend request. These actual values enter the input key, palette approval and frozen concept snapshots. Empty mood selections resolve to the style mood in server-side palette and repaint prompts. Changing styles re-evaluates Auto values; explicit overrides and inherited remix refinements remain selected until reset to Auto.

This implementation intentionally preserves the existing palette approval and separate text/image billing stages. The second step displays the summed palette/specification/render cost and its breakdown. It does not offer a single-click orchestration endpoint or charge for all stages at once. Interpreter cost is displayed separately in the Custom picker.

Validation: Auto resolver cases, empty catalogs and initial style-step gating are covered by automated tests. Populated first-step layout was inspected using a clearly synthetic preset fixture at desktop and mobile widths. Public E2E remains a signed-out route check; authenticated interaction and paid live generation have not been exercised.

No schema migration, new environment variables or deployment is required for code review. Deploy frontend and backend together to pick up server-side Auto mood resolution.
