# NeotypeLab Rendering Pipeline V2

## Product Positioning

NeotypeLab is not a concept art generator.

NeotypeLab is a mecha model repaint planning system.

The objective is:

* preserve model identity
* generate realistic repaint plans
* provide physically paintable color layouts
* visualize finished model outcomes

The system must prioritize planning accuracy over artistic freedom.

---

# Pipeline Overview

User Input

↓

Palette Plan

↓

Repaint Specification

↓

HD Render

↓

Final Preview

---

# Stage 1 — Palette Plan

## Purpose

Generate a color strategy.

This stage determines:

* Primary Color
* Secondary Color
* Inner Frame Color
* Accent Color
* Marking Color
* Sensor Color

## Inputs

* Base Model
* Style DNA
* Material Profile
* Weathering Level
* User Notes

## Outputs

Color Plan JSON

Example:

{
"primary": "Mr. Color C39 Dark Yellow",
"secondary": "Tamiya X-10 Gun Metal",
"frame": "Mr. Color SM201 Super Iron",
"accent": "Gaia Warning Orange",
"marking": "Gaia Warning Orange",
"sensor": "Clear Green"
}

## Responsibilities

Palette Plan decides:

* what colors are used

Palette Plan does NOT decide:

* exact panel placement
* material rendering
* image composition

---

# Stage 2 — Repaint Specification

## Purpose

Translate user selections into rendering instructions.

This stage does not generate images.

This stage creates a structured specification.

## Inputs

* Base Model
* Style DNA
* Material Profile
* Weathering Level
* Color Plan
* User Notes

## Outputs

Render Specification JSON

Example:

{
"style": {
"militaryInfluence": true,
"commandPresence": true,
"warningMarkings": true,
"camouflage": false
},

"material": {
"reflectivity": "low",
"surfaceTexture": "smooth",
"metallicResponse": "none",
"coatingBehavior": "ceramic"
},

"weathering": {
"edgeWear": "light",
"dustAccumulation": "moderate",
"paintChipping": "minimal"
}
}

## Responsibilities

Repaint Specification decides:

* how style should be interpreted
* how materials should behave
* how weathering should behave
* decal density
* warning marking density
* surface treatment

Repaint Specification does NOT decide:

* image quality
* image composition
* rendering style

---

# Stage 3 — HD Render

## Purpose

Generate the final preview image.

HD Render visualizes the approved plan.

HD Render should not invent new design decisions.

HD Render executes the specification.

---

## Inputs

* Base Model
* Color Plan
* Render Specification

Only approved structured outputs may be used.

Free interpretation is minimized.

---

## Responsibilities

HD Render decides:

* lighting
* material realism
* surface rendering
* photographic quality

HD Render must not change:

* color hierarchy
* style interpretation
* weathering intensity
* model identity

---

# Identity Priority System

All image generation follows:

1. Base Model Identity
2. Color Role Assignment
3. Style Specification
4. Material Specification
5. Weathering Specification
6. User Notes

Higher layers override lower layers.

Notes never override structured selections.

---

# Material Rules

Material controls:

* reflectivity
* roughness
* coating behavior
* metallic response
* surface texture

Material does not control:

* armor color
* silhouette
* armor segmentation

Color decisions belong to Palette Plan.

---

# Weathering Rules

Clean

Factory fresh appearance.

No visible damage.

Minimal panel enhancement.

---

Display

Subtle scale-model weathering.

Suitable for display pieces.

Minor edge wear.

Minor operational marks.

Primary colors remain dominant.

---

Heavy

Advanced scale-model weathering.

Visible paint wear.

Dust accumulation.

Operational staining.

Weathering remains secondary to color layout.

Primary color placement must remain readable.

---

# Style DNA Rules

Style DNA influences:

* color relationships
* decal style
* warning markings
* military vs industrial tone
* visual personality

Style DNA does not alter:

* silhouette
* armor structure
* proportions
* native equipment

Style DNA may inspire appearance.

Style DNA may never redesign the machine.

---

# Future Expansion

Future systems can be added without modifying HD Render:

* Camouflage Module
* Decal Module
* Military Marking Module
* Faction Module
* Finish Library
* Paint Manufacturer Library

All future modules should generate specification data rather than directly influencing image prompts.

This keeps rendering stable and predictable.
