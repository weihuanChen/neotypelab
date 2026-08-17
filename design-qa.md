# Explore Landing Design QA

## Scope and evidence

- Source: `/Users/yinglian/.codex/generated_images/01a0085e-9079-7851-8d6a-c0d2be01a9e9/exec-e5fefa67-112d-41f3-953c-af959dbb9404.png`
- Source dimensions: 864 × 1821 px.
- Implementation URL: `http://192.168.10.106:4173/`
- Desktop evidence: `.codex-audit/06-explore-desktop-top.jpg` at 1280 × 720 px.
- Focused interaction evidence: `.codex-audit/04-style-filter-open.jpg` at 1440 × 1024 px.
- Mobile evidence: `.codex-audit/05-explore-mobile.jpg` at 390 × 844 px.
- App-shell evidence: `.codex-audit/09-explore-app-shell.jpg` at 1280 × 720 px.
- Mobile navigation evidence: `.codex-audit/11-explore-mobile-nav-open.jpg` at 390 × 844 px.
- Normalized comparison: `.codex-audit/07-source-vs-implementation.jpg`.
- Browser density: 2 device pixels per CSS pixel.
- State: public, signed-out Explore landing page; fallback editorial catalog visible when Convex has no public concepts.

## Final pass

- Visual hierarchy matches the selected canvas: slim masthead, oversized editorial headline, lead image with right-hand metadata, supporting contact sheet, Trending, compact discovery bar, and Archive.
- Warm paper palette, hairline rules, Fell display typography, orange accent, square image frames, and generous artwork-led whitespace match the reference direction.
- Cards remain intentionally terse: kit, title, Style DNA, surface/condition, creator, and Remix only.
- Kit, Style DNA, and Material are visual filters. Style DNA opens as an image grid; selecting Industrial Hazard updates the URL and reduces the archive from 14 to 6 matching prototypes.
- Remix navigates to `/create`; the primary creation surface reports the expected `Create | NeotypeLab` title.
- Responsive verification passed at 390 × 844 CSS px with a single-column hero, single-column archive, and no horizontal overflow.
- Explore now uses the shared AppShell: its left-side Discover navigation is visible and active on desktop, while the same navigation opens from the compact mobile toolbar. The embedded hero measures 702 × 527 CSS px inside a 1032 px content area at 1280 px viewport width.
- All 36 rendered images loaded successfully; no broken assets were found.
- Console review found the existing TanStack/Clerk development hydration warning at the document root and Clerk development-key warnings. No Explore-specific exception, broken interaction, or missing content was found; production build rendering completes successfully.

## QA history

1. Initial implementation: the visual system matched, but the full-page browser stitching exposed invalid `dt`/`dd` nesting and a CSS-drawn popover arrow.
2. Revision: converted feature metadata to a valid `dl`, made fallback dates deterministic in UTC, removed CSS-drawn artwork, aligned the archive CTA to “Load more,” and removed preview-only result copy.
3. Final verification: desktop, open Style DNA state, filtered archive, Remix route, and mobile breakpoint all passed.

final result: passed

## Showcase exhibition follow-up

- Desktop evidence: `.codex-audit/12-showcase-exhibition.jpg` at 1280 × 720 px.
- Filter Drawer evidence: `.codex-audit/13-showcase-filter-drawer.jpg` at 1280 × 720 px.
- Mobile evidence: `.codex-audit/14-showcase-mobile.jpg` at 390 × 844 px.
- Shared AppShell and active Showcase navigation verified on `/showcase` and `/showcase/archive`.
- Featured image renders at 684 × 513 CSS px on desktop and 358 × 358 CSS px on mobile.
- Six editorial cards, one material collection, and eight recent works render without broken images or horizontal overflow.
- Style DNA filtering reduced the fallback exhibition from 14 to 5 works and retained only matching Command Unit cards.
- Advanced Filter Drawer opens with Kit, Style DNA, Material, Weathering, and Creator controls.
- The original full search experience is preserved at `/showcase/archive`.

final result: passed
