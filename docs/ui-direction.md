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

Page styles are split per surface: `explore.css` (landing),
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
  landing hero "View plan" button). Secondary actions are ink and may
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
  default; pages that render their own h1 (e.g. the Explore landing)
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

**Presets.** Custom description is the primary path. Official,
community and saved styles appear as an inspiration strip below the
console; "Use as is" stays free, "Load into console" copies the
direction into the textarea for rewriting.
