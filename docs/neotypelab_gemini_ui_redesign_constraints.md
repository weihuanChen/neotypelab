# NeotypeLab Gemini UI Redesign Constraints

## Purpose

This document is the hard execution boundary for a Gemini-led NeotypeLab UI redesign.

The planned visual shift is:

> From dark industrial terminal UI to light retro-futurism with technical line-art.

Gemini may redesign presentation, layout, visual hierarchy, spacing, color, typography, decorative line systems, and responsive composition.

Gemini must not downgrade, remove, rewrite, invent, or simplify NeotypeLab business behavior.

The redesign is a frontend-only visual/layout upgrade.

---

## Absolute Rule

Only change UI and layout.

Do not change product logic, backend behavior, data contracts, route semantics, permissions, pricing, generation flows, engagement behavior, SEO data behavior, or Convex API usage.

If a business decision seems necessary, stop and ask instead of inventing one.

---

## Target Visual Direction

The new UI should feel like:

- bright retro-futurism
- technical line-art
- mecha blueprint sketch
- clean hobby lab
- analog control panels
- cream / warm white surfaces
- muted orange / teal accents
- thin technical strokes
- printed manual aesthetic
- spray-planning workstation

Suggested visual ingredients:

- warm off-white or paper-like base surfaces
- graphite text and blueprint-style annotation lines
- muted orange, teal, and blue-gray accents
- thin strokes, hairline dividers, diagram frames, measurement ticks, small labels
- line-art mecha silhouettes or abstract drafting marks where useful
- subtle paper grain, plotted grid, ruled margins, registration marks, blueprint callouts
- more daylight, space, and readable contrast

Avoid:

- keeping the old dark/cold terminal as the dominant mood
- generic SaaS white dashboard
- playful toy catalog styling
- anime fan-site styling
- Web3 glow
- cyberpunk neon
- heavy gradients
- glassmorphism overload
- random decorative blobs
- replacing business UI with marketing sections

Generated concepts, preview images, paint plans, public prototypes, and community content must remain the product focus.

Important V2 hierarchy:

> The color scheme is the main visual.

Generated images should support the palette, color-role mapping, material finish, and spray feasibility rather than becoming the only hero.

Canonical V2 color tokens:

```ts
export const colors = {
  bgMain: "#F4F0E6",
  bgSurface: "#FBF7ED",
  bgPanel: "#E8E0D0",
  bgElevated: "#FFFDF6",

  lineSubtle: "rgba(35, 40, 45, 0.10)",
  lineMuted: "#C9BFAE",
  lineActive: "#2F3A3D",

  textPrimary: "#202426",
  textSecondary: "#5E625F",
  textMuted: "#8A8377",

  accentOrange: "#E46F2D",
  accentTeal: "#2A8C8C",
  accentBlue: "#3B6D8C",
  accentRed: "#B84A3A",
};
```

---

## Allowed File Scope

Gemini may edit frontend presentation files only:

- `src/**/*.tsx` for routes, layouts, public surfaces, OG/export components, and client presentation
- `components/**/*.tsx` for presentational React components
- `components/ui/**/*.tsx` for visual primitive styling only
- `src/styles/globals.css`
- `tailwind.config.js`
- `components.json` only if strictly needed for shadcn visual configuration
- new frontend-only presentational components under `components/`
- new frontend-only style/token files under `lib/` only if they contain no business logic
- new static visual assets under `public/` only if they are decorative or UI-related

Any new file must be frontend-only and must not introduce business rules.

---

## Forbidden File Scope

Gemini must not edit:

- `convex/**`
- `convex/_generated/**`
- database schema files
- backend mutations, queries, actions, auth, generation, billing, engagement, recommendation, shopping, feasibility, paint mapping, or admin logic
- `middleware.ts`
- environment files such as `.env`, `.env.local`, or deployment config
- `package.json` or lockfiles unless explicitly approved
- data migration scripts
- seed/init business data unless explicitly approved
- `lib/structuredData.ts`
- business helper files such as `lib/creatorPackAccess.ts`
- sitemap, robots, canonical, metadata, or JSON-LD logic unless the change is purely visual text-free layout inside rendered image components

Do not edit generated code manually.

---

## Business Integrity Rules

Gemini must preserve all existing data flows.

Do not remove, rename, replace, or mock any existing:

- `useQuery(...)`
- `useMutation(...)`
- `useAction(...)`
- `fetchQuery(...)`
- `api.*` references
- route params
- search params
- form submission handlers
- click handlers
- permission checks
- loading states
- empty states
- error states
- disabled states
- cost displays
- confirmation gates
- public/private/unlisted visibility behavior
- publish readiness checks
- remix lineage behavior
- like/save/share behavior
- structured data injection
- metadata generation

Do not convert live Convex-backed data into static mock data.

Do not replace real user, concept, catalog, credit, or engagement values with placeholders.

Do not remove defensive fallback UI.

Do not silently hide unavailable data states.

---

## Business Language Preservation

Keep NeotypeLab product language intact unless only minor visual microcopy polishing is needed.

Must preserve concepts such as:

- Prototype
- Style DNA
- Material Profile
- Paint Finish
- Weathering
- Mood Vector
- Credit Capacity
- Paint Mapping
- Palette Plan
- Spray Feasibility
- Feasibility
- Shopping List
- Saved Hangar / Library
- Remix
- Pilot
- Creator Pack
- Public Showcase
- Share Surface
- Lab Report / Feedback

Do not replace the product with generic phrases such as:

- AI image generator
- prompt engineering tool
- create image
- magic generation
- design generator
- art maker
- campaign dashboard

If labels are visually restyled, the underlying meaning must stay identical.

---

## Route And Feature Preservation Checklist

The redesign must keep every current route operational.

### Public / Guest Surfaces

Preserve:

- `/`
- `/showcase`
- `/prototype/[conceptId]`
- `/pilot/[handle]`
- `/creator/[handle]`
- `/creator-pack/[slug]`
- `/[baseModelSlug]/[stylePresetSlug]`
- dynamic Open Graph image routes
- watermarked prototype export route
- Pinterest export route
- Reddit export route

These pages must still render live Convex data, direct share actions, remix CTAs, engagement state where present, metadata, and structured data.

### Terminal / Authenticated Surfaces

Preserve:

- `/t`
- `/t/create`
- `/t/library`
- `/t/showcase`
- `/t/feedback`
- `/t/admin`

The terminal can be visually reinterpreted into a light retro-futurist workspace, but the authenticated flow and access rules must remain intact.

---

## Page-Level Non-Negotiables

### Home Page

Allowed:

- replace dark hero with bright retro-futurist line-art composition
- restructure top-level layout into a more exploratory first screen
- improve visual connection to showcase and prototype entry

Forbidden:

- turning it into a generic marketing landing page
- removing the NeotypeLab positioning
- removing or weakening entry points to authenticated terminal and public discovery

### Create Workbench

Must preserve:

- base model selection
- Style DNA selection
- material profile selection
- mood vector selection
- visibility selection
- weathering selection
- controlled note field and 100-character limit
- remix source intake and lineage preservation
- creator pack bridge and locked premium-pack behavior
- credit summary and all visible costs
- Initialize Prototype action
- Generate Style Suggestion action
- Generate Palette Plan action
- HD render request behavior
- live job snapshot, paint plan, feasibility, shopping list, and recommendation outputs

Allowed:

- reorganize the flow into a brighter drafting-board workspace
- make preview/results more visually prominent
- improve responsive step structure
- extract presentational subcomponents

Forbidden:

- collapsing steps into a freeform prompt
- deleting any selection category
- hiding costs
- changing credit consumption behavior
- changing mutation payloads
- removing result panels because they are visually complex

### Library Workbench

Must preserve:

- owned concept list
- saved public concepts
- generation jobs and retry behavior
- visibility changes
- publish review / confirmation gate
- preview asset stabilization action
- render requests including HD, multi-angle, high-fidelity, build-stage visualization, weathering simulation, split preview, and material finish comparison
- paint plan, feasibility, shopping, recommendation, render history, lineage, share and remix affordances

Allowed:

- redesign as a light archive, hangar, or technical binder
- improve card density and grouping

Forbidden:

- removing advanced render actions
- removing public publishing safety checks
- removing saved public concepts
- merging concept states in a way that hides visibility/status

### Feedback Workbench

Must preserve:

- feedback category selection
- concept/style inheritance behavior
- title and message fields
- selected concept context
- create feedback mutation
- user's own report list and status display

Allowed:

- restyle as lab report / field report in line-art form

Forbidden:

- turning feedback into a generic contact form
- removing category semantics
- removing report status

### Admin Workbench

Must preserve all admin functionality.

This includes:

- access status and super-admin gate
- platform overview
- audit log
- feedback pipeline review
- catalog editing
- user and access management
- prompt template editing
- price rule editing
- credit campaign creation/update/code generation
- creator pack management
- all current validation and error handling

Allowed:

- improve visual hierarchy, spacing, tables, panels, and responsive layout

Forbidden:

- simplifying admin into read-only views
- deleting dense controls because they are visually heavy
- removing batch/edit forms
- hiding operational diagnostics

### Showcase Feed

Must preserve:

- live public concepts query
- creator packs query
- ranked creators query
- sort modes: Trending, Recent, Most Remixed, Most Saved
- filters: base model, Style DNA, category, creator
- engagement bar
- Open Share Surface CTA
- Remix in Terminal CTA
- empty and loading states

Allowed:

- redesign as a light concept archive, catalog sheet, or gallery board
- make preview images larger and line-art metadata quieter

Forbidden:

- removing filters or sort modes
- changing query param behavior
- replacing feed with static examples

### Prototype Public View

Must preserve:

- public/unlisted concept rendering
- preview image and unavailable fallback
- share actions
- remix action
- engagement state
- base model, Style DNA, material, weathering, mood, visibility/status metadata
- paint plan
- feasibility
- shopping list and copy/export actions
- recommendations and recommendation feedback
- remix/source lineage
- creator/pilot links

Allowed:

- redesign as a bright technical specimen sheet or prototype dossier

Forbidden:

- reducing it to only an image and title
- removing practical repaint planning data
- removing shopping/procurement/recommendation sections

The prototype view must make palette, swatches, color-role mapping, material finish, and spray feasibility prominent.

### Pilot / Creator / Creator Pack / SEO Landing Pages

Must preserve:

- live public profile and creator hub data
- published concepts
- saved/liked/remix activity where present
- creator packs
- creator style collection
- pack access / premium lock behavior
- pack launch/remix links
- SEO landing page concept references, metrics, Style DNA overview, keywords, and internal links

Allowed:

- restyle as bright creator dossier, archive spread, or technical catalog pages

Forbidden:

- removing public identity signals
- removing pack access checks
- removing SEO-oriented content sections

---

## Layout Rules For Redesign

Gemini may change layout structure, but must preserve information architecture.

Allowed:

- move from dark terminal panels to bright technical sheets
- use top navigation, split workbench, command rail, side notes, floating index, or responsive bottom navigation
- rearrange panels for better hierarchy
- extract repeated visual modules
- introduce design tokens
- simplify visual clutter without removing data or controls

Forbidden:

- deleting existing controls
- deleting existing data sections
- hiding controls behind unexplained affordances
- replacing accessible buttons/links with decorative-only elements
- making mobile a compressed desktop table
- using hover-only controls for essential actions
- making current actions harder to find

---

## Frontend Technical Rules

Use the existing stack:

- Next.js App Router
- TypeScript
- React function components
- Tailwind CSS
- shadcn/ui / Radix primitives where already used
- Convex React hooks already in place

Do not:

- migrate frameworks
- introduce a new state manager
- introduce a new design system library
- install packages without explicit approval
- change API function names
- change Convex schema expectations
- change auth provider behavior
- change server/client component boundaries unless necessary for UI and verified
- remove `"use client"` from components that need hooks
- add `"use client"` broadly to server pages that currently rely on server metadata/fetch behavior

If components are split:

- keep prop names and types explicit
- pass data through without altering semantics
- preserve event handlers and disabled conditions
- preserve accessibility labels and keyboard behavior

---

## Styling Rules

Recommended:

- define reusable visual tokens instead of repeating many arbitrary hex values
- use CSS variables or Tailwind theme extensions for the new light palette
- keep focus states visible
- keep touch targets usable on mobile
- keep text contrast strong on light backgrounds
- preserve reduced-motion friendliness
- use line-art and drafting details as decoration, not as blockers over content

Avoid:

- overusing low-contrast pale gray text
- making dense admin and library views decorative but unreadable
- using background grids that compete with content
- putting thin-line decorative frames around every single element
- making buttons look like labels
- using pure white everywhere with no surface hierarchy

Generation/loading states must not use reactor startup language.

Use this sequence instead:

```text
LOADING BASE SILHOUETTE
DRAWING PANEL LINES
ASSIGNING COLOR BLOCKS
CHECKING SPRAY FEASIBILITY
MAPPING PAINT FINISH
PROTOTYPE READY
```

---

## Content Rules

Gemini may adjust visible copy only when:

- it improves clarity
- it preserves the exact product meaning
- it does not remove business information
- it does not add unsupported promises

Gemini must not:

- invent new features
- invent unsupported pricing
- invent new generation modes
- invent new social mechanics
- invent new paint brands or product data
- add mock community examples if live data exists
- delete technical labels that explain product state

---

## Required Verification Before Completion

Gemini must run and pass at minimum:

```bash
npm run lint
```

If practical, also run:

```bash
npm run build
```

Manual verification must include:

- desktop and mobile view of `/`
- desktop and mobile view of `/showcase`
- desktop and mobile view of `/t/create`
- desktop and mobile view of `/t/library`
- one public prototype page if data is available
- one admin page if admin access is available

Verify that:

- no business action disappeared
- no query/mutation/action was removed
- costs are still visible before paid actions
- remix links still preserve source intent
- engagement controls still work
- public share/export links still render
- loading, empty, and error states still exist
- mobile screens remain usable

---

## Diff Review Checklist

Before handing off, Gemini must inspect the diff and confirm:

- no `convex/**` files changed
- no backend business helpers changed
- no generated files changed
- no `package.json` or lockfile changed unless explicitly approved
- no Convex API calls were removed or renamed
- no route params or search params were changed
- no action handlers were dropped
- no costs, statuses, visibility labels, or permission gates were removed
- no live data was replaced by static mock content
- all changed files are frontend UI/layout/style files

---

## Stop Conditions

Gemini must stop and ask for human approval if the redesign seems to require:

- backend schema changes
- new Convex queries, mutations, or actions
- new dependencies
- package upgrades
- auth behavior changes
- pricing or credit behavior changes
- new generation modes
- deletion of an existing feature because it is visually inconvenient
- replacing live data with mock data
- changing route structure
- changing public URL semantics

---

## One-Sentence Execution Contract

Redesign NeotypeLab into a light retro-futurist line-art interface while preserving every existing route, live data dependency, business workflow, action, cost display, permission gate, public surface, and frontend behavior.
