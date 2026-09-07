# TanStack Migration Backlog

Last updated: 2026-09-07

This document is the historical record of the completed migration from the Next
App Router into the TanStack Start production path in `src/`.

## How To Update

When a migration item is complete:

1. Change `[ ]` to `[x]`.
2. Fill in `Completed:` with the date.
3. Fill in `Commit:` with the git commit hash.
4. Add a short note if the scope changed during implementation.

Use P0 for broken production behavior or major feature parity gaps, P1 for
user-visible parity gaps, P2 for cleanup and de-risking, and P3 for follow-on
polish that is migration-adjacent but not blocking.

## Recently Completed

- [x] `M-DONE-01` Migrate `/t/feedback` to TanStack.
  - Completed: 2026-06-16
  - Commit: `b48c5db`
  - Notes: Added `src/routes/t_.feedback.tsx` and
    `src/components/feedback/FeedbackWorkbench.tsx`.
- [x] `M-DONE-02` Migrate `/t/admin` to TanStack.
  - Completed: 2026-06-16
  - Commit: `b48c5db`
  - Notes: Added `src/routes/t_.admin.tsx`, moved admin workbench into
    `src/components/admin`, and replaced Clerk Next hooks with TanStack Clerk
    hooks.

## P0

- [x] `M-P0-01` Restore full `/t/library` feature parity.
  - Source fallback: `app/t/library/LibraryWorkbench.tsx`
  - TanStack target: `src/components/library/LibraryWorkbench.tsx`
  - Scope:
    - restore publish review dialog and blocking checks for shareable states
    - block public/unlisted publishing when the concept lacks a public preview URL
    - restore advanced render actions: HD render, multi-angle contact sheet,
      high-fidelity render, build-stage visualization, weathering simulation,
      weathering split preview, and material finish comparison
    - restore paint plan, feasibility, shopping readiness, recommendation bias,
      render history, copy shopping list, and purchase path panels
  - Completed: 2026-06-16
  - Commit: `444ceba`
  - Notes: Restored the authenticated terminal library workbench with publish
    review gates, public preview blocking, advanced render actions, saved public
    builds, paint/feasibility/shopping/recommendation panels, render history,
    shopping copy actions, and queue retry controls.

- [x] `M-P0-02` Resolve the missing `/t/showcase` terminal route.
  - Source fallback: `app/t/showcase/page.tsx`
  - TanStack target: `src/routes/t_.showcase.tsx` or a deliberate redirect/link
    change to `/showcase`
  - Scope:
    - remove the current broken link from TanStack `/showcase`
    - decide whether terminal-mode showcase should stay separate or redirect to
      the public `/showcase`
    - keep terminal navigation consistent after the decision
  - Completed: 2026-06-16
  - Commit: `a229969`
  - Notes: Added `src/routes/t_.showcase.tsx`, shared the showcase SSR
    snapshot/search helpers through `src/lib/showcaseRouteData.ts`, and kept
    terminal showcase filters scoped to `/t/showcase`.

## P1

- [x] `M-P1-01` Restore prototype public page parity.
  - Source fallback: `app/prototype/[conceptId]/PrototypePublicView.tsx`
  - TanStack target: `src/components/prototype/PrototypePublicView.tsx`
  - Scope:
    - restore public feasibility query and Spray Feasibility panel
    - restore public shopping list query, Shopping List panel, copy action, and
      best purchase path link
    - restore public recommendations query, recommendation groups, feedback
      mutation, and recommendation-to-create links
    - preserve current TanStack SSR snapshot and live Convex hydration behavior
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Restored live public feasibility, shopping list, and
    recommendations queries while preserving the existing SSR snapshot fallback.
    Added public copy actions, best purchase links, recommendation feedback, and
    recommendation-to-create links in the TanStack component.

- [x] `M-P1-02` Migrate prototype export image routes.
  - Source fallback:
    - `app/prototype/[conceptId]/watermarked-image.tsx`
    - `app/prototype/[conceptId]/pinterest-image.tsx`
    - `app/prototype/[conceptId]/reddit-image.tsx`
  - TanStack target:
    - `src/routes/prototype_.$conceptId.watermarked-image.ts`
    - `src/routes/prototype_.$conceptId.pinterest-image.ts`
    - `src/routes/prototype_.$conceptId.reddit-image.ts`
  - Scope:
    - verify the image rendering approach works on Cloudflare Workers
    - reconnect export links from the TanStack prototype page
    - keep existing `/prototype/$conceptId/opengraph-image` behavior intact
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Added TanStack route handlers for watermarked, Pinterest, and Reddit
    exports using the existing Cloudflare Workers-safe SVG response approach
    instead of reintroducing Next `ImageResponse`.

- [x] `M-P1-03` Restore public share actions across public routes.
  - Source fallback:
    - `components/public/PublicShareActions.tsx`
    - `app/pilot/[handle]/PilotPublicView.tsx`
    - `app/creator/[handle]/CreatorHubView.tsx`
    - `app/creator-pack/[slug]/CreatorPackPageView.tsx`
    - `app/[baseModelSlug]/[stylePresetSlug]/SeoLandingPageView.tsx`
  - TanStack target:
    - `src/components/pilot/PilotPublicView.tsx`
    - `src/components/public/PublicRouteViews.tsx`
    - shared TanStack-safe public share component
  - Scope:
    - restore copy/share actions consistently
    - avoid importing Next-specific public components into TanStack
    - wire export image links where the target route exists
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Added a shared TanStack-safe public share component and wired it into
    prototype, pilot, creator hub, creator pack, and SEO landing public routes.

- [x] `M-P1-04` Rebuild a unified terminal navigation shell for TanStack.
  - Source fallback: `app/t/TerminalShell.tsx`
  - TanStack target: shared component under `src/components/terminal/`
  - Scope:
    - centralize `/t`, `/t/create`, `/t/library`, `/t/feedback`, `/t/showcase`
      or redirect, and conditional `/t/admin`
    - restore operator readout, credit balance, and auth controls where
      supported by TanStack Clerk
    - remove duplicated per-route topbar drift
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Added `src/components/terminal/TerminalShell.tsx`, centralized
    terminal navigation/readout/auth controls, made `/t/admin` conditional on
    live viewer clearance, removed duplicated route topbars, and kept missing
    provider states render-safe.

## P2

- [x] `M-P2-01` Decide the fate of `app/layouts/*`.
  - Source fallback: `app/layouts/`
  - TanStack target: delete, archive, or migrate intentionally
  - Scope:
    - confirm whether these routes are still useful demos
    - if not production, remove from migration scope and document why
    - if still useful, migrate them into TanStack or docs
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Classified `app/layouts/*` as a retained Next-only scaffold/demo
    area, not product IA and not part of the TanStack route tree. It is now
    documented as out of migration scope; deletion or archival is deferred to
    the fallback-retirement step.

- [x] `M-P2-02` Remove legacy-only drift after parity is restored.
  - Source fallback: `app/`
  - TanStack target: `src/`
  - Scope:
    - audit changes that landed only in `app/t/create` or other Next fallback
      files after the TanStack copy was created
    - port useful changes into `src/`
    - stop treating fallback files as active implementation targets
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Audited `app/t/create`, `app/t/library`, `app/t/feedback`, and
    `app/t/admin` against their TanStack counterparts. Useful create-workbench
    visual drift is already present in `src/components/create`, while remaining
    differences are Next-specific fallback wiring or older imports. Added
    fallback ownership rules so future work ports behavior into `src/` instead
    of treating `app/` as active implementation.

- [x] `M-P2-03` Update migration docs and README after remaining parity work.
  - Source fallback: `README.md`, existing docs under `docs/`
  - TanStack target: current documentation
  - Scope:
    - replace stale Next-first architecture language
    - document which `app/` files are retained only as fallback
    - document Cloudflare/TanStack deployment as the canonical path
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Updated README migration ownership guidance, rewrote
    `docs/neotypelab_technical_architecture.md` as TanStack/Cloudflare-first,
    and added `docs/tanstack_migration_state.md` to document canonical
    ownership, retained Next fallback rules, `app/layouts/*`, and verification
    commands.

## P3

- [x] `M-P3-01` Retire or isolate the Next App Router fallback.
  - Source fallback: `app/`
  - TanStack target: repository cleanup plan
  - Scope:
    - delete stale Next routes, scripts, and dependencies after parity checks
  - Completed: 2026-09-07
  - Commit: pending local changes
  - Notes: Removed the Next App Router tree, Next-only shared components,
    middleware, configuration, scripts, dependencies, and environment fallbacks.

- [x] `M-P3-02` Expand social/export formats beyond the migrated baseline.
  - Source fallback: first-generation prototype export routes
  - TanStack target: future public share/export surfaces
  - Scope:
    - add extra platform-specific layouts only after current exports are stable
    - keep this separate from parity migration unless needed by launch
  - Completed: 2026-06-16
  - Commit: pending local changes
  - Notes: Added a TanStack-only square export route at
    `/prototype/$conceptId/instagram-image`, extended the shared SVG export
    renderer with a square layout, and exposed the new Instagram Card link from
    the public prototype share actions.
