# NeotypeLab UI Direction Document

# V2 Adaptation Notice

This file keeps its historical filename for continuity, but the visual direction has changed.

The old dark Death Stranding industrial terminal and Hathaway cockpit HUD direction is no longer the primary visual system.

The current main visual system is:

> Bright retro-futurism + technical line-art + mecha blueprint sketch + spray-planning workstation.

For the full V2 source of truth, use:

```text
docs/neotypelab_ui_direction_bright_retro_futurism_lineart.md
```

This document is now adapted to the V2 direction and should not be used to reintroduce dark cyberpunk, neon glow, cockpit overload, or reactor-style generation language.

---

# Core Style

NeotypeLab should feel like:

> A bright future mecha repaint planning manual combined with an interactive retro-futurist prototype console.

The interface should combine:

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

It should NOT feel like:

- a dark cyberpunk terminal
- a neon cockpit simulator
- a generic SaaS white dashboard
- an anime portal
- a toy catalog
- a generic AI image generator

---

# Design Principle

## Color Scheme Is the Main Visual

The previous direction treated generated images as the dominant visual asset.

V2 changes the hierarchy:

> The color scheme, swatch logic, color-role mapping, material finish, and spray feasibility are now the primary visual story.

Generated images remain important as simulation evidence, but the UI should make the repaint plan itself feel visually valuable.

Prioritize:

- palette blocks
- color swatches
- color role assignments
- paint finish mapping
- spray feasibility cues
- technical line-art previews
- practical repaint annotations

Do not reduce a concept page to only a generated image and title.

---

# Color System

Use warm engineering-paper surfaces, graphite text, thin technical strokes, and muted technical accents.

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

Recommended usage:

- `bgMain`: app background, broad page canvas
- `bgSurface`: main content sheets and large surfaces
- `bgPanel`: recessed panels, controls, table headers, annotation blocks
- `bgElevated`: active sheets, overlays, dialogs, important summaries
- `lineSubtle`: grid lines, ruled marks, low-emphasis dividers
- `lineMuted`: default panel borders
- `lineActive`: selected outlines and high-emphasis engineering strokes
- `textPrimary`: main text and headings
- `textSecondary`: body copy and metadata
- `textMuted`: helper text and low-emphasis labels
- `accentOrange`: primary action, cost, confirmation, warning
- `accentTeal`: selected state, success, Style DNA, active technical sync
- `accentBlue`: navigation, public discovery, neutral status
- `accentRed`: destructive, failed, blocked, or irreversible states

Avoid:

- dark surfaces as the default
- neon cyan or green glow
- cyberpunk purple
- large SaaS gradients
- rainbow accent systems
- low-contrast cream-on-cream text

---

# Typography

Use a technical manual hierarchy.

Recommended:

- clean sans for primary UI
- mono font for IDs, counts, cost, timestamps, status, and technical labels
- optional restrained serif only for manual-style display moments

Typography should feel:

- precise
- readable
- documented
- diagrammatic
- practical

Avoid:

- giant startup hero typography
- sci-fi display fonts everywhere
- anime fonts
- tiny low-contrast annotation text
- all-caps overload

---

# Layout System

The V2 layout should feel like a technical workstation or printed manual spread.

Recommended desktop structures:

```text
Top Command Strip
Primary Workspace Sheet
Side Annotation Rail
Prototype / Scheme Record
Bottom Action Deck
```

or:

```text
Manual Header
Step Index
Large Color Scheme / Prototype Sheet
Technical Notes Panel
Sticky Cost / Action Bar
```

Allowed:

- top navigation
- compact command strip
- side annotation rail
- drafting-board grids
- technical tabs
- responsive bottom action controls

Do not preserve the old left rail if it makes the bright system feel like a reskinned dark terminal.

---

# Component Design

## Panels

Panels should feel like technical sheets or control plates:

- warm paper surface
- thin black/gray engineering strokes
- subtle ruled/grid details
- square or lightly rounded corners
- small labels and registration marks

Avoid:

- dark cards
- glow effects
- glassmorphism
- generic SaaS cards
- decorative frames that reduce readability

## Cards

Cards should feel like catalog records or specimen sheets.

Use cards for:

- base models
- Style DNA
- material profiles
- public concepts
- library concepts
- creator packs

Each card should preserve:

- preview or scheme area
- technical label
- title
- metadata
- status / visibility
- action controls

Active state:

- strong line outline
- muted teal or orange accent
- selected stamp or corner mark

## Buttons

Buttons should feel like analog controls or manual command tabs.

Primary actions:

- ink or orange border
- warm fill
- clear label
- visible focus state
- slight press response

Recommended labels remain:

- Initialize Prototype
- Build Concept
- Generate Palette Plan
- Save to Hangar
- Remix Scheme
- Open Share Surface

Avoid:

- Generate AI Art
- Create Image
- Magic AI wording

## Inputs

Inputs should feel like worksheet fields:

- ruled-line treatment
- precise borders
- clear labels
- helper copy
- visible counters
- strong focus state

Do not turn controlled notes into a freeform prompt system.

---

# Loading / Generation State

Do not use reactor startup language.

The generation sequence should feel like a technical drawing and spray plan being assembled.

Use:

```text
LOADING BASE SILHOUETTE
DRAWING PANEL LINES
ASSIGNING COLOR BLOCKS
CHECKING SPRAY FEASIBILITY
MAPPING PAINT FINISH
PROTOTYPE READY
```

Visual effects:

- line drawing
- panel outline sweep
- swatch assignment
- color block fill
- feasibility check mark
- manual stamp transition

Avoid:

- reactor pulse
- cockpit HUD activation
- neon scanlines
- long cinematic loading theater
- flashing effects

---

# Page-Level Direction

## Landing / Home

Goal:

- communicate NeotypeLab as a spray-ready mecha repaint planning platform
- show a bright technical manual / prototype console feel
- expose public inspiration and prototype entry quickly

Hero should use:

- cream surfaces
- mecha blueprint sketch
- color swatch callouts
- spray-planning annotations
- action controls

Suggested headline can remain:

```text
Prototype your next repaint before you spray.
```

## Create Page

Goal:

- fast structured concept creation
- visual emphasis on color scheme and spray plan
- preserve all current creation steps

Desktop:

- large color scheme / prototype sheet
- compact step controls
- right or side annotation rail for credit, selected configuration, remix source, and warnings

Mobile:

- step wizard
- sticky primary CTA
- quick preview access
- minimal typing

## Result / Public Prototype Page

Goal:

- turn output into a useful repaint decision asset

Must include:

- generated preview
- dominant palette
- color role breakdown
- material / paint finish
- weathering
- paint mapping
- feasibility
- shopping / procurement support where available
- save
- remix
- share
- feedback
- lineage

## Library

Goal:

- store, revisit, publish, repair, render, and branch concepts

V2 feel:

- archive binder
- technical logbook
- prototype registry

Do not remove:

- saved public concepts
- visibility controls
- publish review
- preview stabilization
- advanced render actions
- lineage
- render history

## Showcase

Goal:

- community inspiration and SEO discovery

V2 feel:

- public concept archive
- technical gallery board
- repaint reference catalog

Cards should remain image/scheme-first and preserve filters, sort modes, engagement, and remix actions.

## Admin

Goal:

- operational clarity

V2 feel:

- technical operations ledger
- maintenance binder
- clear data control surface

Reduce decoration.

Do not remove dense controls, diagnostics, validation, permissions, or editing workflows.

---

# Motion Design

Recommended:

- line draw-on
- paper sheet reveal
- tab slide
- control press
- underline sweep
- swatch recalibration
- technical stamp transition

Avoid:

- neon glow
- cockpit overlays
- chaotic particles
- heavy 3D animation
- motion that blocks workflow

---

# Imagery Direction

Generated preview images are no longer the only hero.

V2 hero hierarchy:

1. Color scheme and swatch logic
2. Color role mapping and spray feasibility
3. Material finish and weathering plan
4. Generated preview as simulation evidence

Use generated images inside technical reference sheets with annotations, not as isolated poster art.

Avoid:

- covering images with heavy overlays
- shrinking all practical paint data below the image
- anime poster composition
- generic stock visuals

---

# Accessibility

The bright redesign must support:

- strong contrast
- readable text on warm light surfaces
- clear active states
- visible focus rings
- keyboard navigation
- mobile-friendly touch targets
- reduced motion support
- non-color-only status communication

Line-art, grid, texture, and manual marks must never reduce readability.

---

# Do / Don't Summary

## Do

- use bright retro-futurism
- use technical line-art
- use mecha blueprint sketch language
- use cream / warm white surfaces
- use muted orange / teal / blue accents
- use thin technical strokes
- make color schemes the main visual
- preserve all structured product flows
- show costs clearly before paid actions
- keep mobile fast and usable

## Don't

- use dark cyberpunk UI
- use neon glow
- use cockpit overload
- use generic SaaS gradients
- use anime portal styling
- make the product feel like a toy catalog
- reduce NeotypeLab to generic image generation
- remove business controls for visual simplicity
- hide statuses, costs, visibility, or lineage

---

# Final Design Target

When users open NeotypeLab, they should feel:

> I am reading and operating a bright future mecha repaint planning manual that lets me prototype, compare, document, save, remix, and share spray-ready color schemes.
