# Community styles and durable interpretation — P5

Availability update: `/community/styles` is temporarily closed (404); its main navigation and official-gallery links are hidden. Reopen only after a product decision once community content exists. Private saving, direct shared-style links, Create reuse and admin tools remain available.

## User workflow

1. In Create, select Custom Style → Describe a style.
2. Interpret the description. The UI shows the current active text-suggestion credit price before inference.
3. Review the structured result and choose **Save privately and use this style**.
4. The immutable snapshot appears in **My Styles** and can be applied to different kits without interpreting it again.
5. Publish the style explicitly from My Styles to appear in **Community**. The original description, prompt and provider metadata remain private.
6. A visitor can open `/c/:styleId`, continue through `/create?communityStyle=:styleId`, save a private copy and apply it to a kit.

`/community/styles` lists published styles, ordered by saves plus twice the number of public prototypes. This is a simple all-time discovery score, not a time-window trend or quality guarantee. Each other user contributes at most one save to a source. Repeated clicks and the author's own use do not increase save counts.

Public prototype counts and cover images require an actual public, generated/archived concept with a complete published image set, matching root style and matching frozen intent. Private/unlisted drafts are excluded. Withdrawing an image removes it from the next computed count/cover.

Styles without a preview show a typographic palette study, not a fabricated image.

## Interpretation lifecycle

The Interpreter now uses persisted `promptCompositions`:

- authenticated, non-suspended users only;
- server-side input limits and the shared two-active-text-job cap;
- credits reserved transactionally before provider execution;
- request-key idempotency and a single execution claim;
- strict private Custom Style Intent v1 output validation;
- one-time failure/expiry refunds via the existing text-failure handler;
- a 15-minute deadline; late results cannot revive failed/refunded work;
- owner-only result/history reads.

Interpreter routing and pricing deliberately reuse the existing `style-suggestion` text provider route and `generate-style-suggestion` price rule. The frozen interpreter prompt version is `style-interpreter.v1`. No image storage is reserved for interpretation.

The browser keeps the current draft/request key in per-user session storage for same-tab reload recovery. It checks recent successful results before enabling a new interpretation. Explicit API calls with a new request key can still request a new paid interpretation. Server recovery searches the latest 50 compositions; saved styles are persistent independently of that history window.

## Saved snapshots and privacy

`userStyles` owns the immutable intent snapshot and publication state. Original records retain their interpretation composition ID privately. Community copies retain source/root lineage but not the original prompt composition.

Visibility changes do not mutate the frozen intent. Community reads project `source: community`; saved copies and generation use the stored private custom snapshot. Making a source private stops new discovery and saves. Existing private copies and generated concepts remain usable. Copies cannot simply be republished as duplicate community entries; authors can describe and interpret a new variation instead.

Generation accepts `userStyleId` only for an active saved style owned by the current user, with an identical normalized intent. Its identity participates in palette input keys. Concepts freeze `userStyleId` and `styleRootId` alongside their existing intent, palette and specification snapshots.

Legacy concepts and raw custom-intent requests remain supported, but old concepts without saved-style lineage are not retroactively counted toward a community style.

## Moderation and promotion

The existing `/admin/style-editorial` now includes Community curation:

- inspect published community candidates and their real save counts;
- hide or restore a style;
- review a visual-language name, slug, description and attribution;
- promote the public direction into an **inactive official preset draft**.

Promotion preserves the original creator and records an audit entry. Repeated promotion returns the same preset. It does not rewrite the community source or old concepts, publish pages, verify paint mapping, or grant official status to a user input.

Enable the draft in the Style library, generate new official-intent concepts, and complete the P4 public preview/paint-mapping review before any official SEO page appears.

## SEO and rollout

Both `/community/styles` and `/c/:styleId` are `noindex, follow` and absent from sitemap. Private, hidden and withdrawn style links resolve as unavailable/not found. Only the P4 editorial path can produce indexed official pages.

The schema changes are additive (`userStyles`, concept lineage fields/index). There are no new secrets or required environment variables. Generate API types with the supported Convex codegen command, then deploy backend/schema before the frontend. No deployment or real publication is performed by this implementation.

Tests exercise actual Convex mutations/actions with mocked text-provider responses, ownership and suspension checks, credits, retries, expiry, immutable copies, counts, publication withdrawal and admin promotion. Public E2E covers share/create links, noindex metadata and mobile overflow. Populated visual QA uses clearly identified test data; authenticated live browser publication and paid inference remain deployment checks.

The original Create two-step layout and Auto refinements are still separate UI work; the current change adds the durable Custom/My Styles/Community flows to the existing workbench.
