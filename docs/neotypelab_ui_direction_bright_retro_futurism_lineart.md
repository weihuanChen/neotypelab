# NeotypeLab UI Direction V2

# Bright Retro-Futurism Line-Art Mecha Lab

## Status

This is a new V2 visual direction document.

It does not delete, overwrite, or invalidate the older dark Death Stranding / Hathaway HUD direction document.

Use this document when the product is being redesigned toward:

> A bright future mecha repaint planning manual combined with an interactive retro-futurist prototype console.

---

# Purpose

Refactor NeotypeLab visual direction from:

```text
Dark Death Stranding industrial terminal UI
```

to:

```text
Bright retro-futurist technical line-art mecha lab UI
```

This document controls visual design only.

The following systems must remain intact:

- product interaction system
- NeotypeLab terminology
- creation flow
- guest mode
- mobile-first workflow
- structured prototype behavior
- credit and cost transparency
- public showcase / remix / share loops
- admin, feedback, library, creator, profile, and SEO surfaces

Do not use this redesign as a reason to simplify business behavior.

---

# Core Style

NeotypeLab V2 should feel like:

> A precision mecha repaint planning manual that has become interactive.

The interface should combine:

- bright retro-futurist control surfaces
- technical drafting sheets
- line-art panels
- mecha sketch annotations
- spray-planning workstation atmosphere
- analog manual texture
- structured digital product behavior

It should NOT feel like:

- a generic white SaaS dashboard
- a toy catalog
- an anime portal
- a dark cyberpunk terminal
- a neon cockpit simulator
- a generic AI image generator
- a lifestyle landing page

---

# Product Continuity

Only the visual language changes.

The product remains:

> A mecha paint planning and visual prototyping platform for hobby builders.

The core loop remains:

```text
Inspiration -> Prototype -> Save -> Remix -> Share
```

The creation model remains structured:

```text
Base Model
Style DNA
Material Profile / Paint Finish
Weathering
Mood Vector
Controlled Note
Credit Confirmation
Prototype Result
```

Users should still feel that they are testing repaint concepts before committing paint to plastic.

The difference is mood:

- less cold terminal
- less industrial darkness
- more bright technical manual
- more drafting desk
- more retro-futurist lab instrument

---

# Brand Atmosphere

## Core Keywords

- Bright retro-futurism
- Technical line-art
- Mecha blueprint sketch
- Clean hobby lab
- Analog control panels
- Cream / warm white surfaces
- Muted orange / teal accents
- Thin technical strokes
- Printed manual aesthetic
- Spray-planning workstation

## Emotional Target

Users should feel:

> I am working inside a future mecha repaint lab where every prototype is documented like a technical field manual.

The feeling should be:

- clear
- tactile
- precise
- experimental
- collectible
- practical
- visually memorable

---

# Design Ratio

## 45% Technical Manual

Used for:

- page structure
- panel framing
- labels
- metadata
- concept documentation
- paint mapping
- feasibility
- shopping lists
- admin clarity
- SEO landing pages

Visual references:

- mechanical service manuals
- model kit instruction sheets
- industrial product catalogs
- aircraft maintenance diagrams
- drafting documents

## 35% Retro-Futurist Console

Used for:

- primary actions
- prototype controls
- create flow
- active selections
- cost confirmation
- generation states
- interaction feedback

Visual references:

- late 1970s to 1990s future consoles
- tactile instrument panels
- modular control decks
- analog display labels
- technical switches and segmented controls

## 20% Mecha Line-Art Lab

Used for:

- hero atmosphere
- preview framing
- decorative overlays
- public prototype surfaces
- creator and showcase identity
- spray-planning diagrams

Visual references:

- mecha production sketches
- orthographic model sheets
- blueprint annotations
- color separation maps
- assembly instruction callouts

---

# Color System

The UI should shift to warm, light surfaces with technical ink and muted accents.

Do not use pure white as the main background.

Do not use dark cyberpunk surfaces as the default.

## Background Colors

Canonical V2 palette:

```css
--bg-main: #F4F0E6;
--bg-surface: #FBF7ED;
--bg-panel: #E8E0D0;
--bg-elevated: #FFFDF6;
```

Use these for:

- page backgrounds
- panels
- technical sheets
- control decks
- empty states
- public archive surfaces

## Ink And Text Colors

```css
--text-primary: #202426;
--text-secondary: #5E625F;
--text-muted: #8A8377;
```

Use strong contrast.

Do not let the bright redesign become low-contrast beige text on beige backgrounds.

## Engineering Stroke Colors

```css
--line-subtle: rgba(35, 40, 45, 0.10);
--line-muted: #C9BFAE;
--line-active: #2F3A3D;
```

Use strokes for:

- panel borders
- diagram frames
- callout lines
- section dividers
- measurement marks
- active card outlines
- form boundaries

## Accent Colors

Accents should be muted and technical.

```css
--accent-orange: #E46F2D;
--accent-orange-soft: rgba(228,111,45,0.14);

--accent-teal: #2A8C8C;
--accent-teal-soft: rgba(42,140,140,0.14);

--accent-blue: #3B6D8C;
--accent-blue-soft: rgba(59,109,140,0.16);

--accent-red: #B84A3A;
--accent-red-soft: rgba(184,74,58,0.14);
```

Recommended usage:

- Orange: primary actions, cost, confirmation, important warnings
- Teal: active system states, successful sync, selected Style DNA
- Blue: navigation, metadata, neutral technical status, public discovery
- Red: destructive, failed, blocked, or irreversible states

Recommended TypeScript token shape:

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

## Avoid

- neon cyan glow
- saturated cyberpunk purple
- black background as the default surface
- large blue-purple SaaS gradients
- rainbow status systems
- classic toy-like red/blue/yellow as the main UI palette
- low-contrast cream-on-cream text

---

# Typography

## Recommended Fonts

Primary UI:

- Space Grotesk
- Sora
- Geist
- Inter if already present and tuned carefully

Technical labels:

- IBM Plex Mono
- JetBrains Mono
- Space Mono

Optional editorial / manual accent:

- a restrained serif for large manual-style headings only
- use sparingly and keep readability high

## Typography Rules

Use typography like a technical manual, not a marketing landing page.

Prefer:

- compact section labels
- tabular numbers for counts and credits
- clear body text
- strong but not oversized headings
- annotation-style captions
- technical metadata rows

Avoid:

- giant SaaS hero headlines
- overly futuristic display fonts everywhere
- anime title fonts
- tiny pale technical text
- all-caps overload on every label

## Label Style

Labels can shift from old terminal text to drafting/manual labels.

Examples:

```text
STYLE DNA
MATERIAL PROFILE
PAINT MAPPING
WEATHERING PASS
SPRAY PLAN
PROTOTYPE RECORD
VARIANT FORK
CREATOR DOSSIER
```

Use uppercase labels selectively.

Mix with sentence-case headings to avoid visual fatigue.

---

# Line-Art System

Line-art is the signature visual layer of V2.

Use line-art to create structure and atmosphere, not clutter.

## Allowed Line-Art Elements

- panel outlines
- measured margins
- registration marks
- small crosshair ticks
- blueprint grids
- orthographic frames
- callout leaders
- part-number labels
- swatch connectors
- dotted cut lines
- spray-zone diagrams
- subtle mecha silhouettes
- technical stamp blocks

## Rules

Line-art should be:

- thin
- precise
- low contrast enough to support content
- aligned to layout
- meaningful when possible

Avoid:

- random decorative scribbles
- thick comic-book outlines
- busy blueprint overlays behind dense text
- permanent overlays on top of generated preview images
- line systems that make buttons hard to identify

---

# Layout System

## Desktop Layout

The V2 layout should feel like a technical workstation or manual spread.

Recommended structures:

```text
Top Navigation / Command Strip
Primary Workspace
Side Annotation Rail
Preview / Prototype Sheet
Control Deck
```

or:

```text
Manual Header
Left Index / Step Rail
Large Prototype Sheet
Right Technical Notes
Bottom Action Deck
```

Do not keep the old left rail solely because the old dark terminal used it.

A left rail is allowed if it becomes:

- a technical index
- a route map
- a lab binder tab system
- a compact tool navigation

## Main Workspace

The main workspace should prioritize:

- prototype preview
- selected configuration
- color and material logic
- practical repaint planning output
- community concept imagery

The UI should frame the work like documentation.

It should not turn every section into a same-looking card grid.

## Side Panels

Side panels should feel like annotations.

Use them for:

- current credits
- selected Style DNA
- current material profile
- weathering level
- visibility state
- source concept lineage
- warnings
- recommendations

Avoid making side panels feel like generic dashboard widgets.

---

# Mobile Layout

Mobile remains a primary platform.

V2 mobile should feel like:

> A pocket technical field manual for quick prototype decisions.

Must support:

- one-thumb operation
- fast prototype creation
- sticky primary actions
- horizontal preset browsing
- large touch targets
- readable controls on bright backgrounds
- quick access to preview/result
- minimal typing

Do not:

- compress desktop tables into mobile
- hide essential actions behind hover states
- make technical labels too tiny
- overdecorate small screens with grid overlays
- require long scrolling before users can act

Recommended mobile patterns:

- bottom action bar
- step index chips
- collapsible annotation panels
- swipeable Style DNA and material cards
- sticky cost confirmation
- preview-first result pages

---

# Component Design

# 1. Panels

Panels should feel like technical sheets or control plates.

Style:

- warm paper surface
- thin ink or gray stroke
- square or lightly rounded corners
- small registration marks
- subtle inner grid or ruled line only when helpful
- clear heading and metadata area

Avoid:

- dark glowing cards
- heavy shadows
- generic white cards with gray border
- glass panels
- overly rounded toy-like modules

# 2. Cards

Cards should feel like catalog records or specimen sheets.

Use for:

- base models
- Style DNA
- material profiles
- public prototypes
- creator packs
- saved library items

Card structure:

- preview or icon area
- technical label
- title
- compact metadata
- action zone
- status / visibility mark

Active card treatment:

- stronger ink outline
- muted accent edge
- small selected stamp
- light technical hatch or corner mark

Avoid:

- large colorful shadows
- neon active rings
- hiding metadata to make cards pretty

# 3. Buttons

Buttons should feel like physical controls or manual command tabs.

Primary actions:

- strong ink or muted orange outline
- warm fill or subtle accent fill
- clear label
- visible focus state
- slight press response

Recommended labels remain:

- Initialize Prototype
- Run Simulation
- Build Concept
- Save to Hangar
- Remix Scheme
- Open Share Surface
- Generate Palette Plan

Secondary actions:

- line-button treatment
- low emphasis
- clear hover/active state

Danger / cost / irreversible actions:

- muted orange or safety vermilion
- clear cost or consequence
- no hidden payment language

# 4. Inputs

Inputs should feel like form fields on a technical worksheet.

Use:

- ruled-line treatments
- precise borders
- visible labels
- helper text
- character counters
- strong focus states

Do not:

- turn controlled notes into prompt engineering
- remove the note limit
- hide validation or error messages

# 5. Status Indicators

Status indicators should become technical stamps or inspection marks.

Examples:

```text
STYLE DNA LOADED
MATERIAL PROFILE SET
WEATHERING PASS READY
PAINT MAPPING VERIFIED
PUBLIC PREVIEW READY
VARIANT FORK RECORDED
```

Use sparingly.

Do not overfill the page with fake stamps.

# 6. Credit Display

Credits should remain understandable.

Recommended treatment:

```text
Credit Capacity
Available Credits
Prototype Preview Cost
HD Render Cost
```

V2 visual metaphor:

- resource meter
- print-run capacity
- lab allocation
- prototype budget line

Do not obscure cost with overly thematic naming.

# 7. Feedback UI

Feedback should feel like a lab report or field correction sheet.

Categories must remain clear:

- Request New Model
- Request New Style
- Report Bad Output
- Paint Mapping Issue
- Other

Suggested presentation:

- report sheet layout
- category tabs
- related concept annotation
- status stamp
- submission history as report log

Do not turn feedback into a generic contact form.

---

# Page-Level Direction

# 1. Home Page

## Goal

Introduce NeotypeLab as a bright future mecha repaint planning system.

The first screen should communicate:

- repaint prototyping
- technical manual atmosphere
- structured inputs
- public inspiration
- immediate prototype entry

## Hero Feel

Bright technical manual plus interactive prototype console.

Possible composition:

- large mecha line-art sketch
- color swatch callouts
- spray plan annotations
- compact prototype action panel
- public concept previews as reference sheets

Primary copy can remain close to:

```text
Prototype your next repaint before you spray.
```

Avoid:

- generic marketing hero
- abstract gradient blob background
- dark cyberpunk splash
- feature-card-only layout

# 2. Create Page

## Goal

Fast structured concept creation.

Desktop:

- large prototype sheet or preview stage
- step-based control deck
- side annotation rail for credits, selection summary, source lineage, and warnings

Mobile:

- step wizard
- sticky primary CTA
- quick preview/result access
- minimal typing

Must preserve:

- base model
- Style DNA
- material profile
- mood vector
- visibility
- weathering
- controlled notes
- credit confirmation
- remix source
- creator pack bridge
- generated outputs and recommendations

# 3. Result / Prototype Page

## Goal

Turn output into a useful repaint decision asset.

Important V2 shift:

> The color scheme is the primary visual object.

Generated images are still valuable, but they should support the scheme, material decisions, color-role logic, and spray plan rather than becoming the only hero.

V2 direction:

- specimen sheet
- technical dossier
- color separation record
- spray plan manual page

Must include:

- preview image
- dominant palette / color scheme
- swatches
- color roles
- color role breakdown
- paint finish / material
- weathering tips
- paint mapping
- feasibility
- shopping/procurement support where available
- save
- remix
- share
- feedback
- source/remix lineage

Do not reduce the result to a pretty image page.

# 4. Library Page

## Goal

Help users store, revisit, publish, repair, and branch concepts.

V2 direction:

- archive binder
- hangar logbook
- prototype registry
- technical card catalog

Must preserve:

- owned concepts
- saved public concepts
- jobs
- visibility controls
- publish review gate
- preview stabilization
- advanced render requests
- lineage
- render history
- practical planning data

# 5. Showcase Page

## Goal

Community inspiration and SEO discovery.

V2 direction:

- public concept archive
- technical gallery board
- mecha repaint reference catalog

Each showcase card should still include:

- preview image
- base model
- Style DNA
- material profile / paint finish
- weathering level
- pilot/creator metadata
- like/save/remix/share affordances where present

Grid should be image-first and readable.

The UI should not overpower the concepts.

# 6. Feedback Page

## Goal

Make feedback feel like product data expansion.

V2 direction:

- lab report sheet
- correction request form
- field report ledger

Must preserve:

- categories
- selected concept relationship
- style inheritance
- report status
- user's report history

# 7. Admin Panel

## Goal

Operational clarity.

V2 direction:

- technical operations ledger
- control-room paperwork
- data maintenance binder

Admin should be functional first.

It may use the same bright line-art system, but with reduced decorative overlays.

Admin priorities:

- speed
- clarity
- filtering
- batch editing
- feedback triage
- cost monitoring
- diagnostics

Do not remove dense controls because they are visually inconvenient.

# 8. Creator, Pilot, Pack, And SEO Pages

## Goal

Make public surfaces feel like shareable reference dossiers.

V2 direction:

- creator dossier
- pilot field file
- creator pack catalog insert
- base-model/style technical reference page

Must preserve:

- public identity signals
- published concepts
- saved/liked/remix activity where present
- creator packs
- pack access and premium lock behavior
- SEO content, internal links, and concept references

---

# Motion Design

Motion should be restrained and tactile.

Recommended motion:

- line draw-on
- subtle paper sheet reveal
- tab slide
- soft control press
- panel unfold
- hover underline sweep
- small status stamp transition
- preview annotation fade-in

During generation or important transitions:

- loading base silhouette
- drawing panel lines
- assigning color blocks
- checking spray feasibility
- mapping paint finish
- prototype ready

Generation-state copy should use this sequence:

```text
LOADING BASE SILHOUETTE
DRAWING PANEL LINES
ASSIGNING COLOR BLOCKS
CHECKING SPRAY FEASIBILITY
MAPPING PAINT FINISH
PROTOTYPE READY
```

Avoid:

- neon glow pulses
- chaotic particles
- cockpit HUD overload
- long cinematic intros
- heavy 3D animation
- reactor startup language
- motion that blocks workflow

Motion should make the interface feel interactive, not theatrical.

---

# Iconography

Use clean technical icons and line-art symbols.

Recommended:

- thin stroke icons
- drafting symbols
- stencil-like action marks
- spray / brush / swatch symbols
- document / archive / fork symbols
- status stamps
- simple mecha part icons when useful

Avoid:

- cute icons
- toy-like icon sets
- rocket / magic wand AI cliches
- inconsistent stroke widths
- decorative icons replacing readable labels

---

# Imagery Direction

Color schemes are the V2 hero assets.

Generated previews remain important, but they are no longer the only main visual.

The page should prioritize:

- palette blocks
- color separation
- swatch logic
- spray feasibility
- material finish mapping
- role-based paint planning
- the generated preview as evidence or simulation of the scheme

V2 should frame them like:

- specimen plates
- repaint studies
- technical reference sheets
- color-planning documents

Use:

- large preview areas
- annotation margins
- color callouts
- swatch strips
- material labels
- optional blueprint/manual overlays outside the main image

Avoid:

- covering generated images with heavy line-art
- turning previews into tiny thumbnails
- generic stock imagery
- anime poster layouts
- colorful SaaS illustration scenes

---

# Accessibility

Must support:

- strong contrast on light backgrounds
- readable text
- clear focus states
- visible active states
- keyboard navigation
- mobile-friendly touch targets
- reduced motion support
- non-color-only status communication

Bright UI must not sacrifice legibility.

Line-art and background texture must never reduce content readability.

---

# Engineering Notes

Preferred implementation:

- centralize V2 colors as CSS variables or Tailwind theme tokens
- reduce repeated arbitrary hex values over time
- preserve shadcn/Radix primitives where they already support behavior
- customize primitives visually without changing their semantics
- keep server/client component boundaries intact unless a UI split requires a safe change
- preserve all existing data hooks and event handlers

Do not:

- introduce new business logic into style tokens
- rewrite backend contracts
- replace live data with mock data
- remove loading, empty, disabled, or error states
- install new dependencies without approval

---

# Do / Don't Summary

## Do

- make NeotypeLab bright, precise, and technical
- use warm off-white / cream backgrounds
- use line-art panels and engineering strokes
- use muted orange, teal, and blue-gray accents
- make generated prototypes and practical paint data the hero
- preserve all product terminology and workflows
- keep mobile fast and thumb-friendly
- show credit costs before paid actions
- keep public showcase, remix, sharing, and profile loops intact

## Don't

- keep dark cyberpunk UI as the dominant system
- use neon glow
- overload the UI with cockpit HUD effects
- use generic SaaS gradients
- use anime portal styling
- make it feel like a toy catalog
- reduce the product to a generic image generator
- remove business controls for visual simplicity
- hide costs, statuses, visibility, or lineage
- make the interface low contrast

---

# Final Design Target

When users open NeotypeLab V2, they should feel:

> I am using a bright future mecha repaint planning manual that lets me prototype, document, compare, save, remix, and share experimental machine color concepts.

The experience should be:

- bright but not sterile
- technical but not cold
- nostalgic but not toy-like
- structured but not rigid
- visual but not image-only
- practical enough for hobby builders
- distinctive enough for public sharing
- clear enough for mobile creation
