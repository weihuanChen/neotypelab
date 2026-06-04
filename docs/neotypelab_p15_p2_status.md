# NeotypeLab P1.5 / P2 Status

Last updated: 2026-05-19

## Scope Note

The PRD defines `P1`, `P2`, and `P3`, but does not define a formal `P1.5`.
In this document, `P1.5` is an inferred bridge stage: the work needed to turn the completed P1 operator system into a shareable, discoverable product surface that can support full P2 community expansion.

## Current Baseline

P1 is largely in place:

- authenticated create flow, library, feedback, and admin
- Convex schema for concepts, generation jobs, credits, assets, prompt templates, feedback, and catalog data
- R2-backed asset metadata and generation pipeline
- public `showcase` feed and `prototype/[conceptId]` share surface
- public remix entry points, lineage display, and remix counts
- route-level metadata, canonical tags, Open Graph/Twitter metadata, plus `robots` and `sitemap` foundations
- advanced render actions: `HD Render`, `Multi-angle Preview`, and `High-fidelity Render`

Relevant implementation already exists in:

- `app/t/create`, `app/t/library`, `app/t/feedback`, `app/t/admin`
- `app/showcase`, `app/prototype/[conceptId]`
- `convex/showcase.ts`, `convex/prototypeTools.ts`, `convex/generation.ts`

## P1.5 Bridge Stage

### Goal

Stabilize publishing, sharing, and discovery primitives so P2 can build on product-grade public surfaces instead of internal-only operator flows.

### Target Tasks

1. Harden publish/share workflow
   - clear publish state transitions
   - reliable public preview delivery
   - richer concept detail for share surfaces
2. Add engagement primitives
   - likes, saves, remix intent, lightweight counters
3. Prepare remix lineage
   - branch from an existing public concept
   - preserve `sourceConceptId` lineage in UI and queries
4. Add SEO foundations
   - route metadata
   - canonical structure
   - sitemap / crawl surface
5. Add discovery signals
   - trending / recent / most saved / most remixed sort modes

### Current Status

`Done`

- visibility states already exist: `private`, `unlisted`, `public`
- public showcase feed already exists
- unlisted direct-share detail page already exists
- public remix CTA, remix creation flow, lineage display, and remix counts already exist
- route-level metadata, canonical tags, Open Graph/Twitter metadata, `robots`, and `sitemap` already exist
- `sourceConceptId` already exists in schema and is wired through UI and queries
- style presets already carry `seoKeywords`
- baseline public engagement primitives now exist: likes, saves, counters, and viewer state on share surfaces
- structured data now exists on prototype, pilot profile, and base-model/style landing pages
- saved public builds now flow back into the authenticated terminal library
- library publish actions now run through a dedicated review / confirmation gate
- preview assets now auto-resolve public URLs when `R2_PUBLIC_BASE_URL` or a managed Cloudflare R2 domain is available
- older preview assets can now be repaired from the library through a `Stabilize Public Preview` action

`Partial`

- publish flow is now review-gated in the library and enforces public preview URL readiness, but it still lives inside the library rather than a fuller publishing center
- preview assets now auto-resolve public URLs when delivery is configured, but pages can still fall back if the environment has no public bucket/domain configuration at all
- public crawl/share foundations now include prototype detail sitemap coverage, landing pages, and first structured data layers
- discovery now has baseline public sort modes, including save-aware sorting, but it still lacks deeper filters and more mature engagement-driven ranking
- public profile surfaces now exist in first form, but they still need broader history, follower/social layers, and tighter integration with internal library surfaces
- saved concepts now appear in the terminal library, but the saved collection model is still separate from deeper personal curation or folders

`Missing`

- richer public profile depth beyond the first route
- broader structured data coverage on showcase and future social/export surfaces
- deeper saved-collection management such as folders, notes, or curation states

### Exit Criteria

P1.5 is complete when a generated concept can be published, shared, discovered, and forked with stable public URLs and basic SEO/social metadata.

## P2 From PRD

### PRD Objectives

P2 in the PRD is:

1. Community Showcase
2. Remix System
3. Public SEO Pages
4. Style Discovery
5. User Profiles
6. Social Sharing

### Module Status

#### 1. Community Showcase

`Partial`

- `/showcase` is live
- `/prototype/[conceptId]` is live
- showcase now supports `Trending`, `Recent`, `Most Remixed`, and `Most Saved` public sort modes
- cards already show preview, base model, Style DNA, material profile, weathering, and pilot metadata
- public cards and detail pages now expose likes, saves, and viewer-specific interaction state

Still missing:

- community presets section
- deeper filtering and engagement-led ranking

#### 2. Remix System

`Partial`

- schema includes `sourceConceptId`
- public and terminal remix actions exist
- remix creation writes `sourceConceptId`
- lineage is displayed on library and public detail pages
- remix counts and branch previews are exposed on public surfaces

Still missing:

- deeper remix history / graph views
- profile-level remix history
- social remix loops beyond terminal branching

#### 3. Public SEO Pages

`Partial`

- public routes exist
- metadata generation exists for showcase and prototype detail pages
- canonical tags, Open Graph, Twitter metadata, `robots`, and `sitemap` exist
- generated landing pages now exist for public base-model/style combinations
- structured data now exists on prototype, pilot profile, and landing pages
- style presets contain SEO keyword hints

Still missing:

- structured data for broader showcase and future export surfaces

#### 4. Style Discovery

`Early public support`

- create flow already has `Generate Style Suggestion`
- style presets are modeled and admin-editable
- showcase now exposes baseline public discovery sorting with remix and save signals

Still missing:

- public discovery pages
- trending styles
- beginner-friendly curated paths

#### 5. User Profiles

`Early public support`

- `/pilot/[handle]` now exists as a public profile route
- profile surfaces expose published concepts, saved public builds, liked concepts, recent activity, and basic remix history
- public showcase and prototype surfaces now link pilot identities into profile routes
- saved public concepts are mirrored back into the authenticated library surface

Still missing:

- broader remix history and graph views
- deeper activity semantics and stronger identity signaling
- likes and optional follower model

#### 6. Social Sharing

`Early public support`

- dynamic OG image routes now exist for showcase, prototype, pilot profile, and landing pages
- public prototype, pilot, and landing surfaces now expose direct share actions
- Open Graph/Twitter metadata now points at generated large-image share cards instead of raw preview assets
- prototype pages now expose a first watermarked export image route for share-ready preview downloads
- prototype pages now expose first platform-specific export layouts for Pinterest and Reddit

Still missing:

- more platform-specific share layouts and export formats

## Recommended Execution Order

1. Harden the publish workflow and public asset delivery path.
2. Add likes / saves so discovery can move from structural to engagement-driven.
3. Expand crawl surfaces with generated landing pages and richer structured data.
4. Add profile surfaces.
5. Add social distribution assets and export formats.

## Practical Next Step

The highest-leverage next milestone is:

`Public asset delivery configuration`

That means:

- ensure every environment has either `R2_PUBLIC_BASE_URL` or a managed bucket domain enabled
- remove the last asset-key-only fallback cases from public surfaces
- tighten diagnostics around missing delivery configuration
- deepen publish QA and public asset delivery guarantees

That milestone closes the remaining core of P1.5 and gives P2 a more durable public growth surface.
