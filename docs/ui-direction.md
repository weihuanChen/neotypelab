# NeotypeLab UI Direction — Cool Almanac (current)

**Status: this is the single authoritative UI direction document.**

It supersedes and replaces all earlier direction docs, which have been
removed from the tree (recoverable from git history):

- `neotypelab_ui_direction_death_stranding_hathaway_hud.md` (V1, dark HUD)
- `neotypelab_ui_direction_bright_retro_futurism_lineart.md` (V2, warm cream + orange/teal)
- `neotypelab_gemini_ui_redesign_constraints.md` (V2 execution constraints)
- `neotypelab_visual_impact_and_emotional_interaction_direction.md` (V2 emotional direction)
- `design-qa.md` (QA record of the V2 warm-paper pass)

Do not reintroduce guidance from those documents: dark cyberpunk, neon
glow, cockpit overload, warm cream/oat paper, and orange or teal accents
are all retired.

---

## Core style

NeotypeLab is set in the **Almanac** direction (reference: the "Almanac"
theme of usehallmark.com): a printed spray-planning almanac.

- Cool slate paper (oklch hue ≈ 245), graphite ink, hairline rules.
- **One navy signal**: a single deep-navy accent, used sparingly —
  ideally one navy element at rest per screen (the primary CTA).
  Everything else is ink, muted ink, or paper.
- Zero-radius, editorial layout: hairline-divided sections, numbered
  plates ("N°.001", "Vol. 02"), archive/catalog framing.
- Kit thumbnails are desaturated (`saturate(.18)`) — color belongs to
  the paint plan, not to the catalog.

### What it must not become

- a generic light SaaS dashboard (identical rounded cards, soft grey
  shadows, Tailwind default status colors)
- a pretty image gallery or anime catalog
- a dark terminal / neon HUD

## Source of truth

| Layer | File | Notes |
| --- | --- | --- |
| Design tokens (oklch) | `src/styles/tokens.css` | Colors, fonts, type scale, spacing, radius. Change colors **here first**. |
| shadcn HSL variables | `src/styles/globals.css` | Keep `--accent`/`--ring` in sync with `--color-accent`/`--color-focus` (comments mark the pairs). |
| Compat layer | end of `src/styles/app.css` | Only `--compat-*` aliases and selector-level overrides. Never redeclare token values here. |

Page styles are split per surface: `home.css` (home page `/` and its
admin curation screen),
`create-workspace.css` (create flow + generation job sheet),
`app.css` (shell + admin), plus the other per-page files imported at the
top of `app.css`.

## Color rules

- **Never hard-code status or accent colors.** Use
  `--color-accent`, `--color-success`, `--color-info`, `--color-danger`
  (tint via `color-mix(in oklch, var(--color-x) N%, transparent)`).
  Raw Tailwind hexes (`#10b981`, `#0284c7`, `#ef4444`, …) are the main
  historical failure mode — they read as a different product.
- Accent is `oklch(40% 0.135 250)` — deep navy, kept close to the
  Almanac reference (38%) with AA contrast headroom. Its foreground is
  `--color-accent-ink`.
- Accent appears at rest on **one** element per screen (e.g. the
  home hero "Plan a paint scheme" button). Secondary actions are ink and may
  turn accent on hover.
- The old warm paper (`rgba(244, 240, 230, …)` / oat cream) must not
  reappear; translucent surfaces use
  `color-mix(in oklch, var(--color-paper) N%, transparent)`.

## Radius rules

- The system is zero-radius **by token**: `--radius-*: 0` in
  `tokens.css`, `borderRadius: 0` map in `tailwind.config.js`,
  `--radius: 0rem` in `globals.css`.
- Do **not** re-add `* { border-radius: 0 !important }` — it squashed
  dots, spinners, and avatars into squares.
- Allowed round exceptions: true circles only (avatars, presence/pulse
  dots, spinners, `border-radius: 50%/999px`). Rectangles (cards,
  pills, badges, chips, inputs) stay square.

## Typography

- `--font-display` / `--font-label`: IM Fell English / IM Fell English SC —
  the almanac voice. Display headlines are weight 400,
  `line-height ≈ 0.97`, **no negative tracking** (the antique face
  clips below ~0.95 and muddies when tracked tight).
- `--font-body`: IBM Plex Sans.
- `--font-mono`: IBM Plex Mono — the **data voice**. Any uppercase
  label below **0.8rem** uses mono, not IM Fell SC (the antique
  strokes are illegible at ~11px). IM Fell SC is reserved for
  section-scale labels (≥ 0.8rem) and plate marks.

## Structure & semantics

- **One `<h1>` per page.** The AppShell topbar title is the page h1 by
  default; pages that render their own h1 (e.g. the home page)
  pass `titleAsHeading={false}` to `AppShell`. In-page section titles
  are `<h2>` and below (the generation job sheet hero is an h2).
- Motion is sparse and purposeful: the generation scanner beam (navy)
  is the one ambient moment; everything else answers user action.
  Always honor `prefers-reduced-motion`.
- Keep `:focus-visible` outlines (`--color-focus`) on all interactive
  elements.

## Change boundary (carried over from the V2 constraints doc)

UI work changes presentation only: layout, hierarchy, spacing, color,
typography, decorative systems, responsive composition. It must not
change product logic, backend behavior, data contracts, route
semantics, permissions, pricing, generation flows, engagement
behavior, SEO data, or Convex API usage. If a business decision seems
necessary, stop and ask.

## Home page (`/`)

Rebuilt 2026-10-12. The home page explains the product; browsing and
filtering belong to `/showcase` (old `/?style=…` links 301 to
`/showcase/archive`). Order: hero (positioning + curated build plate) →
what a plan gives you → three steps → build carousel → FAQ → closing CTA.

- The hero build, its A–H paint markers, the optional kit line-art
  comparison and the carousel order are curated at `/admin/home`
  (`convex/homeFeature.ts`). Without curation the page falls back to the
  newest public builds.
- Navy appears on the hero CTA and the closing CTA only; they are never
  on screen together. No psy green here.
- One motion moment: the build sweeps in over the line art once on load.
  The carousel advances slowly (6.5 s), pauses on hover/focus/off-screen,
  and never auto-plays under `prefers-reduced-motion`.
- FAQ copy lives in `src/components/home/homeContent.ts` and also feeds
  the `FAQPage` JSON-LD; edit it there, never in two places.
- When Custom Kit is enabled, the hero, step two and the kits FAQ lead
  with uploading your own model; catalog kits stay available. The same
  flag drives the visible copy and the JSON-LD. Deployments without the
  flag keep the catalog wording.

## Exception: the Create console (psycho-frame green)

Approved 2026-10-12. The `/create` workspace is the one place where the
user *builds*, so it is deliberately livelier than the rest of the
almanac. This is a scoped exception, not a second brand color: do not
copy it to other surfaces.

**Scope.** Only selectors under `.create-workspace` (style console,
kit step, generate panel, mobile generate bar). Explore, Library,
Showcase, pricing, admin and the shell keep the single navy signal.

**Color.** Reference: the "psycho-frame" green of the PGU RX-93 feature
page (`#00e88e`).

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--color-psy` | `#00e88e` | Action fills, glows, ready lights, progress | 10.9:1 with ink text |
| `--color-psy-deep` | `#00744b` | Text, outlines, ticks and focus on paper | 5.1:1 on paper |
| `--color-psy-wash` | psy 14% | Pressed chips, focus halo | decorative |

- Bright psy is a **light source, never ink**: it has ~1.4:1 on paper,
  so it must not be used for text or hairlines. Text/outline = `psy-deep`.
- Text on a psy fill is always `--color-ink`.
- Paper, headings, cards and rules stay Almanac. Green appears only on:
  primary actions (Form style, Generate), the step sequence bar, the
  selected-kit notch, ready lights, chip pressed state, and the console
  focus scan line. Navy does not appear inside the console.

**Actions are never disabled for missing input.** Form style and
Generate stay clickable; on click they check what is missing and
nudge: a small shake of the button and the missing area (amplitude
≤ 3px, ≤ 2 swings, ~600 ms, decaying), a short-lived soft danger
outline, focus/scroll to the area, and one plain sentence in a
`role="status"` hint. Problems a shake cannot solve (insufficient
credits, locked creator pack, pricing unavailable) show a message and
a way forward instead of shaking. The only blocked state is an
in-flight request (`aria-busy`, no duplicate submit / charge).

**Motion.** One signature moment: when the build becomes ready, the
Generate fill "ignites" once (extends from the left edge with a short
brightness flicker, after the PGU page's `flicker` keyframe), then
holds a soft glow. The console scan line runs only while the textarea
is focused. All of it is disabled under `prefers-reduced-motion`
(nudges fall back to a static outline + text).

**Custom Kit upload (decal magenta).** Approved 2026-10-12, alongside the
custom-first direction: Custom Kit is the first and default Kit source
(Remix links, recommended official kits and deployments without Custom
Kit fall back to the catalog). The upload zone carries a second scoped
signal so "bring your own" stands apart from the green "go" signal.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--color-decal` | `#ff3d9a` | Drop-zone offset shadow, tag, `+` glyph, Custom tab dot, done ticks | 5.6:1 with ink text |
| `--color-decal-deep` | `#b0005c` | Crop marks, pressed Custom tab text/underline, focus on the drop zone | 6.2:1 on paper |
| `--color-decal-wash` | decal 12% | Drag-over fill, pressed Custom tab | decorative |

- Same rule as psy: bright decal is a fill, never text or hairlines on
  paper; text on a decal fill is ink.
- Decal means "your reference" and appears only on the Custom Kit source
  tab, its Upload → Scan → Confirm track, and the drop zone. Actions
  (Scan reference and Confirm structure use `.psy-btn`, like Generate)
  and readiness stay psy green. Once a reference exists, the drop zone
  shrinks to a quiet dashed "Replace" row below the scan results. The two never
  glow together: Generate cannot be ready while the drop zone is empty.
- Playfulness is in shape, not motion: a hard offset "sticker" shadow,
  print crop marks, a tilted "Your kit" tag. Hover lifts the sheet and
  turns the `+`; drag-over dashes the border and wiggles the tag. All
  motion is disabled under `prefers-reduced-motion`.
- Do not use decal outside `.create-workspace`.

**Presets.** Custom description is the primary path. Official,
community and saved styles appear as an inspiration strip below the
console; "Use as is" stays free, "Load into console" copies the
direction into the textarea for rewriting.
