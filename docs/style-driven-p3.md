# Style-driven generation: P3

The palette and repaint stages consume a validated Style Intent when supplied.
Custom requests must omit `stylePresetId`; preset requests resolve the intent
from the selected active preset. Presets without an intent retain their legacy
specification. JSON is schema-validated and normalized for custom input keys.
Changing a confirmed custom intent invalidates palette approval and recovery.

`buildModelPromptContext` supplies kit identity, hierarchy, scale, silhouette,
panel density, complexity, shape anchors and native equipment when available.
The prompt distinguishes model geometry from original model colors. Style palette
relationships should remain consistent across kits; placement and masking adapt
to each kit. Missing model metadata is not invented.

Planning rules are appended to the resolved system prompt, including previously
published templates. No provider credential or template deployment is required
beyond deploying the code/schema. Explicit existing material, mood and weathering
selections remain refinements; the future Auto UI is not introduced here.

The palette composition freezes the interpreted style. Prototype initialization
copies that validated snapshot, rather than trusting a second client payload.
Repaint specifications include it, and HD render prompts consume the concept's
frozen intent together with the approved palette and specification. Old concepts
without intent snapshots retain their existing rendering behavior.

Paint targets still resolve to real active catalog paints using effect-filtered
CIEDE2000 matching. Rationale preserves the target and color distance. Unavailable
effects fail explicitly instead of inventing a product. Catalog changes cannot
replace paints in an already approved concept palette. Paintability is a style
intent estimate, not a verified physical paint-match guarantee.

Verification: lint (zero errors), 120 integration/unit tests, and 6 public E2E
checks passed. Tests include both preset and custom specification/render paths,
cross-model intent preservation, invalid/ambiguous input rejection, unavailable
paint effects and frozen catalog selections. Provider responses are fixtures;
these checks do not establish image likeness or physical paint accuracy.

Live quality evaluation remains a separate deployment check: use the same style
on two kits with different silhouettes and compare palette hierarchy, identity,
panel placement and catalog compromises. Authenticated Create E2E and paid live
image generation were not run. The existing Interpreter still uses the text
suggestion provider route; persistent private-style storage and the Interpreter
credit/composition lifecycle are implemented in [P5](community-styles-p5.md).
