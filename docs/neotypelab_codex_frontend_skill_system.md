# NeotypeLab Frontend Skill System

# V2 Bright Retro-Futurism Line-Art Constitution

## Purpose

This document defines the mandatory frontend development constitution for NeotypeLab after the V2 visual direction change.

The previous dark industrial terminal / cockpit HUD direction is no longer the active frontend target.

Current primary visual direction:

> Bright retro-futurism + technical line-art + mecha blueprint sketch + clean hobby lab + analog control panels + cream / warm white surfaces + muted orange / teal accents + thin technical strokes + printed manual aesthetic + spray-planning workstation.

This document is for frontend/UI execution only.

Do not use visual redesign work as a reason to change backend, Convex contracts, product behavior, permissions, pricing, public URL semantics, or creation flow.

---

# Core Product Identity

NeotypeLab is NOT:

- a generic AI image generator
- an anime portal
- a toy catalog
- a generic SaaS dashboard
- a dark cyberpunk terminal
- a neon cockpit simulator

NeotypeLab IS:

> A mecha paint planning and visual prototyping platform for hobby builders.

V2 experience should feel like:

> A bright future mecha repaint planning manual combined with an interactive retro-futurist prototype console.

---

# Mandatory Frontend Philosophy

## 1. Product Behavior Is Preserved

Frontend redesign may change:

- layout
- colors
- spacing
- typography
- visual hierarchy
- component presentation
- responsive composition
- decorative line-art systems

Frontend redesign must not change:

- Convex data flow
- route semantics
- search params
- form payloads
- mutation/action behavior
- credit costs
- visibility states
- publish gates
- remix lineage
- engagement behavior
- metadata and structured data behavior

## 2. Color Scheme Is the Main Visual

V1 treated generated images as the primary visual anchor.

V2 shifts the anchor:

> Color scheme, swatches, color-role mapping, material finish, and spray feasibility are the main visual story.

Generated previews still matter, but they should support the repaint plan instead of replacing it.

## 3. Structured Creativity

Users should not write large prompts.

The UI must continue to guide creation through:

- base model
- Style DNA
- material profile / paint finish
- weathering
- mood vector
- visibility
- controlled notes
- credit confirmation
- result outputs and practical planning data

## 4. Mobile-First Hobby Workflow

Mobile must remain a primary workflow.

The V2 mobile experience should feel like:

> A pocket technical field manual for fast repaint planning.

Users should be able to discover, prototype, save, remix, and share from mobile.

---

# Global Design Direction

## Required Visual Traits

Always prioritize:

- bright retro-futurism
- technical line-art
- mecha blueprint sketch
- cream / warm white surfaces
- printed manual aesthetic
- clean hobby lab atmosphere
- analog control panels
- thin technical strokes
- muted orange / teal / blue accents
- strong readability
- practical spray-planning hierarchy

## Forbidden Styles

Do not use:

- dark cyberpunk UI
- neon glow
- cockpit overload
- generic SaaS gradients
- anime portal styling
- toy catalog feeling
- rainbow accent systems
- glassmorphism overload
- decorative blobs
- default shadcn appearance
- image-only gallery layouts
- low-contrast beige text

---

# Color System

Use these canonical V2 colors.

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

## Usage Rules

- `bgMain`: app canvas
- `bgSurface`: main sheets and page regions
- `bgPanel`: control panels, side annotations, grouped modules
- `bgElevated`: active surfaces, dialogs, important summaries
- `lineSubtle`: background grid, ruled lines, minor dividers
- `lineMuted`: regular borders
- `lineActive`: selected state, strong outlines, technical strokes
- `textPrimary`: titles and critical values
- `textSecondary`: body and metadata
- `textMuted`: helper text and low-emphasis labels
- `accentOrange`: primary CTA, cost, warning, confirmation
- `accentTeal`: selected states, success, Style DNA, active planning
- `accentBlue`: navigation, public discovery, neutral status
- `accentRed`: destructive, failed, blocked, irreversible

Do not reintroduce the old dark palette as the dominant system.

---

# Typography Rules

## Primary Fonts

Allowed:

- Space Grotesk
- Sora
- Geist
- Inter if tuned carefully

## Technical Fonts

Allowed:

- IBM Plex Mono
- JetBrains Mono
- Space Mono

## Optional Manual Accent

Allowed sparingly:

- restrained serif for large manual-like headings

## Hierarchy Rules

Prefer:

- technical manual labels
- compact but readable metadata
- tabular numbers
- sentence-case section headings
- uppercase labels only where useful
- strong contrast on warm light backgrounds

Avoid:

- giant generic SaaS headlines
- sci-fi display fonts everywhere
- tiny low-contrast annotations
- all-caps overload

---

# Layout Rules

## Desktop Layout

Preferred V2 structures:

```text
Top Command Strip
Primary Planning Sheet
Side Annotation Rail
Control Deck
```

or:

```text
Manual Header
Step Index
Color Scheme / Prototype Sheet
Technical Notes
Sticky Action Bar
```

Do not keep the old left navigation rail solely because it existed in V1.

If a rail is used, it should feel like:

- manual index
- binder tab system
- route map
- compact workstation navigation

## Main Workspace

The main workspace should prioritize:

- color scheme
- swatches
- color role assignments
- material finish
- spray feasibility
- generated preview as applied reference
- practical repaint output

## Right / Side Panel

Side context should feel like annotation, not generic dashboard widgets.

Use for:

- credit capacity
- current cost
- selected Style DNA
- selected material
- weathering
- visibility
- remix source
- warnings
- recommendations

---

# Mobile Layout Rules

Mobile is mandatory.

Required:

- one-thumb operation
- sticky CTA
- large touch targets
- horizontal preset browsing
- quick preview/scheme access
- minimal typing
- readable technical labels
- mobile-safe filters and sorting

Avoid:

- compressed desktop tables
- hover-only controls
- excessive grid texture behind text
- hidden essential actions
- tiny line-art controls

Recommended:

- bottom action bar
- step chips
- collapsible annotation panels
- swipeable Style DNA and material cards
- sticky cost confirmation

---

# Component Constitution

## Panels

All panels should:

- use warm paper-like surfaces
- use thin technical strokes
- avoid heavy shadow
- avoid glow
- preserve strong hierarchy
- support readable dense content

Standard V2 feel:

```css
border: 1px solid #C9BFAE;
background: #FBF7ED;
color: #202426;
```

## Buttons

Primary CTA:

- warm/elevated fill
- orange or active ink stroke
- clear label
- visible focus state
- tactile hover/press state

Allowed labels:

- Initialize Prototype
- Build Concept
- Generate Palette Plan
- Save to Hangar
- Remix Scheme
- Open Share Surface

Avoid:

- Generate AI Art
- Create Image
- Magic generation wording

## Cards

Cards should feel like:

> Technical catalog records or specimen sheets.

Card structure:

- scheme/preview area
- technical label
- title
- compact metadata
- status / visibility
- action zone

Avoid:

- generic white cards
- large colorful shadows
- neon active rings
- hiding practical metadata

## Inputs

Inputs should feel like:

> Worksheet fields on a technical planning sheet.

Inputs must preserve:

- labels
- helper copy
- validation
- character counters
- disabled states
- focus states

Avoid:

- giant prompt textareas
- long freeform prompt systems
- removing the controlled note limit

## Status Indicators

Use technical stamps or inspection marks.

Examples:

```text
STYLE DNA LOADED
MATERIAL PROFILE SET
WEATHERING PASS READY
SPRAY FEASIBILITY CHECKED
PAINT MAPPING VERIFIED
PROTOTYPE READY
```

Do not overuse fake stamps.

---

# Loading State Rules

Loading and generation should feel like a technical drawing and spray plan being assembled.

Canonical generation sequence:

```text
LOADING BASE SILHOUETTE
DRAWING PANEL LINES
ASSIGNING COLOR BLOCKS
CHECKING SPRAY FEASIBILITY
MAPPING PAINT FINISH
PROTOTYPE READY
```

Allowed motion:

- line draw-on
- swatch fill
- panel-line sweep
- feasibility check mark
- manual stamp
- sheet reveal

Forbidden:

- reactor startup language
- cockpit activation
- neon scanlines
- chaotic particles
- long cinematic loading theater

---

# Motion Constitution

Allowed:

- line draw-on
- paper sheet reveal
- tab slide
- control press
- underline sweep
- swatch recalibration
- technical stamp transition
- small hover lift only when useful

Forbidden:

- excessive particles
- floating animations everywhere
- neon glow pulses
- cockpit overlays
- large cinematic transitions
- long intro animations
- motion that blocks interaction

Motion must support usability.

---

# Content Philosophy

User work is the content.

In V2, "user work" means:

- color scheme
- swatches
- paint role logic
- material finish
- spray feasibility
- generated preview
- practical repaint plan
- remix lineage
- public share surface

Do not make decorative line-art more important than the user's repaint plan.

---

# Community Experience Rules

Showcase, prototype, pilot, creator, and creator-pack surfaces should feel like:

- public reference dossiers
- concept catalog sheets
- technical archive pages
- shareable repaint records

Must preserve:

- public concept metadata
- filters and sort modes
- likes and saves
- remix CTAs
- share/export actions
- creator/pilot identity
- pack access behavior
- SEO sections and internal links

---

# Design Tokens Requirement

All repeated V2 styling should move toward centralized tokens.

Recommended files or layers:

```text
colors
spacing
typography
motion
radius
strokes
surfaces
```

Never repeatedly hardcode unrelated one-off values when a token would keep the V2 system consistent.

Do not put business logic in style tokens.

---

# Engineering Requirements

Preferred stack remains:

- Next.js
- TypeScript
- React function components
- Tailwind
- shadcn/ui and Radix as behavior primitives
- Convex hooks already in place

Rules:

- preserve all `useQuery`, `useMutation`, `useAction`, and `fetchQuery` behavior
- preserve server/client component boundaries unless a safe UI split requires a change
- do not install new dependencies without approval
- do not change backend contracts
- do not remove loading, empty, error, disabled, or permission states
- do not replace live data with static mock data

---

# Accessibility Rules

Required:

- strong contrast on cream / warm white backgrounds
- readable text
- clear active states
- visible focus states
- keyboard navigation support
- mobile-friendly touch targets
- reduced motion support
- status not communicated by color alone

Line-art, grid, paper grain, and background texture must never reduce readability.

---

# Page-Level Direction

## Landing / Home Page

Feel:

- bright mecha repaint manual
- immediate prototype entry
- color scheme and swatch logic visible
- public inspiration visible

Avoid:

- generic SaaS hero
- dark cyberpunk splash
- abstract gradients

## Create Page

Feel:

- structured spray-planning workstation
- color scheme and preview sheet
- analog control deck
- annotation rail for cost/selection/lineage

Must preserve every creation step and all costs.

## Showcase Page

Feel:

- public technical concept archive
- repaint reference catalog

Must preserve filters, sort modes, engagement, and remix actions.

## Prototype / Result Page

Feel:

- technical specimen sheet
- palette and spray-plan dossier

Must preserve preview, palette/paint planning data, feasibility, shopping, recommendations, share, remix, engagement, and lineage.

## Library

Feel:

- archive binder
- prototype registry

Must preserve publishing, render actions, saved concepts, visibility, lineage, repair, and planning data.

## Feedback

Feel:

- lab report sheet

Must preserve categories, related concept/style behavior, submission, status, and report history.

## Admin

Feel:

- operations ledger
- maintenance binder

Keep decoration minimal.

Must preserve all admin controls and diagnostics.

---

# Language Rules

Preferred wording:

- Prototype
- Style DNA
- Material Profile
- Paint Finish
- Weathering
- Mood Vector
- Paint Mapping
- Palette Plan
- Spray Feasibility
- Credit Capacity
- Saved Hangar
- Variant Fork
- Build Concept
- Share Surface

Avoid:

- AI image generator
- prompt engineering
- AI art creation
- magic generation wording
- reactor startup language

---

# Final UX Target

Users should feel:

> I am using a bright future mecha repaint planning manual and retro-futurist console to build, document, compare, save, remix, and share spray-ready color schemes.

The experience must be:

- bright but not sterile
- technical but readable
- nostalgic but not toy-like
- structured but not rigid
- visual but not image-only
- mobile-friendly
- practical for hobby builders
