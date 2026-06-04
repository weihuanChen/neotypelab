# NeotypeLab Product Requirements Document (PRD)

# Vision

NeotypeLab is a mecha paint planning and visual prototyping platform for hobby builders.

The platform helps users:

- Explore repaint inspiration
- Prototype spray-ready color schemes
- Visualize repaint concepts before spraying
- Discover realistic paint mappings
- Share and remix community designs

NeotypeLab is NOT positioned as a generic AI image generator.

Core positioning:

> A creative operating system for mecha and hobby repaint planning.

---

# Product Philosophy

## Core Principles

### 1. Controlled Creativity

Users should feel creative freedom while the platform maintains:

- Stable output quality
- Realistic spray logic
- Strong visual consistency
- Controlled generation cost

The system should avoid becoming:

- A generic AI art platform
- A prompt engineering playground
- A low-quality image farm

---

### 2. Spray-Ready Design

The platform focuses on realistic repaint planning.

Generated schemes should feel:

- Physically paintable
- Paint-finish-aware
- Masking-aware
- Hobby-oriented

---

### 3. Community-Driven Expansion

Users are part of the data expansion loop.

The platform should continuously evolve through:

- Feedback
- Remix culture
- Style submissions
- Model requests
- Community voting

---

# PHASE 1 — Foundation Infrastructure

# Goal

Build the foundational operating system for:

- Data modeling
- Prompt composition
- Credits system
- User management
- Feedback collection
- Admin operations

P1 does NOT focus on advanced public generation features.

P1 focus:

> Build the internal architecture that powers stable and scalable future generation.

---

# P1 Core Objectives

## Main Deliverables

### 1. Structured Data Modeling System

### 2. Admin Management Panel

### 3. Credits & Billing Logic

### 4. User Account System

### 5. Internal Prompt Composition Engine

### 6. Feedback & Expansion Pipeline

### 7. Basic Generation Pipeline

---

# P1 Architecture

# Module 1 — Base Model Database

## Purpose

Store supported mecha/model kit structures.

---

## Example Entities

- RX-78-2
- Sazabi
- Barbatos
- Zaku II
- Nu Gundam
- EVA Unit 01

---

## Suggested Schema

```sql
base_models

id
name
slug
series
manufacturer
grade
silhouette_type
complexity_level
default_paint_finish_id
thumbnail_image
is_active
created_at
updated_at
```

---

# Module 2 — Style DNA System

## Purpose

Create reusable style logic.

This becomes the core creative engine.

---

## Example Styles

- EVA-inspired
- Cyberpunk
- Military Prototype
- Desert Ops
- Stealth Black
- Zeon Ace
- Industrial Mecha
- Titanfall Inspired

---

## Suggested Schema

```sql
style_presets

id
name
slug
category
short_description
prompt_keywords
negative_keywords
contrast_level
default_weathering_suggestion
recommended_paint_finishes
seo_keywords
is_active
created_at
updated_at
```

---

# Module 3 — Paint Finish System

## Purpose

Expose the correct user-facing spray decision.

Users select a `Paint Finish`, not a raw rendering surface setting. The selected finish affects:

- Surface material state in the preview
- Real-world paint library matching
- Finish feasibility and difficulty
- Clear coat or topcoat requirements

Internal systems may still resolve material and rendering details, but those details should not be exposed as primary user choices.

---

## Example Paint Finishes

- Matte Finish
- Semi-gloss Finish
- Gloss Finish
- Metallic Finish
- Pearl Finish
- Candy Coat
- Satin Finish

---

## Suggested Schema

```sql
paint_finishes

id
name
slug
display_label
finish_type
surface_reflection
material_prompt
spray_technique
compatible_paint_types
clear_coat_requirement
difficulty_level
prompt_keywords
is_active
created_at
updated_at
```

---

## Internal Field Boundary

The user-facing label is `Paint Finish`.

Backend fields may include:

- `material_prompt`
- `surface_reflection`
- `finish_type`
- `spray_technique`

These are internal resolution fields used to produce a `Material Visual Prompt` for image generation and a `Spray Plan` for real-world execution.

---

## Weathering Boundary

Weathering is a separate finishing effect layer.

It represents time, use, damage, and aging marks, not the core paint finish. Weathering should not change paint product matching or base paint selection.

Examples:

- Dry Brushing
- Chipping
- Wash
- Rust Effects
- Dust Effects
- Burn Marks

Weathering affects:

- Preview render appearance
- Estimated effort and skill level
- Optional real-world tips

Weathering does not affect:

- Paint finish compatibility
- Paint library matching
- Required base paint products

Some weathering effects may be visually useful in generated previews but impractical or difficult to reproduce in the real world. In those cases, show them as small tips, warnings, or skill notes instead of treating them as hard spray requirements.

---

## Suggested Weathering Schema

```sql
weathering_effects

id
name
slug
category
visual_prompt
technique_tip
skill_level
estimated_time_impact
real_world_feasibility
is_active
created_at
updated_at
```

Weathering records should be joined into preview and guidance generation, but they should not be used by paint matching logic.

---

# Module 4 — Color Role System

## Purpose

Assign color meaning instead of only storing hex values.

This is critical for realistic spray logic.

---

## Example Roles

- Primary Armor
- Secondary Armor
- Inner Frame
- Accent Color
- Sensor Color
- Weapon Color
- Optional Effect Overlay

---

## Suggested Schema

```sql
color_roles

id
name
description
visual_weight
recommended_area
created_at
updated_at
```

---

# Module 5 — Paint Mapping Database

## Purpose

Map generated colors to real-world paint products.

This becomes a future monetization and differentiation layer.

---

## Supported Brands (P1)

- Tamiya
- Mr Color
- Gaia Notes
- Vallejo
- AK Interactive

---

## Suggested Schema

```sql
paint_mappings

id
brand
paint_code
paint_name
hex_estimate
paint_finish_id
finish_type
paint_type
availability_region
amazon_affiliate_url
is_active
created_at
updated_at
```

---

# Module 6 — Prompt Composition Engine

# Purpose

Prevent uncontrolled prompting.

All generation should pass through:

```text
Database Rules
+ Style DNA
+ Paint Finish
+ Weathering Effects
+ User Selections
+ Controlled Notes
→ Final Prompt
```

---

# Generation Resolution Flow

```text
User selects:
Base Model + Style DNA + Paint Finish + Weathering

Backend resolves:
Canonical model color roles
Style color logic
Paint finish feasibility
Paint library mapping
Weathering preview effects and skill tips

LLM generates:
1. Spray-ready plan
2. Image preview prompt

Image model receives:
Material Visual Prompt
```

`Paint Finish` affects paint mapping. `Weathering` affects preview appearance, effort estimate, and tips only.

---

# User Inputs

Allowed:

- Base Model
- Style
- Paint Finish
- Mood
- Weathering
- Additional Notes (limited length)

Not Allowed:

- Raw prompt engineering
- Advanced image syntax
- Infinite prompt injection

---

# Additional Notes Rules

Character limit:

- 50–100 chars

Purpose:

- Add ownership feeling
- Maintain output stability

Example:

```text
More aggressive visor
Additional warning decals
Heavier shoulder armor feel
```

---

# Module 7 — Credits System

# Purpose

Control image generation cost.

---

## Suggested Credit Actions

### Low Cost Actions

| Action | Cost |
|---|---|
| Generate palette | 1 |
| Generate style suggestion | 1 |
| Generate repaint concept | 2 |

---

### High Cost Actions

| Action | Cost |
|---|---|
| HD render | 5 |
| Multi-angle preview | 10 |
| High fidelity render | 15 |

---

## Suggested Schema

```sql
credit_transactions

id
user_id
action_type
credit_amount
reference_id
created_at
```

---

# Module 8 — User System

## P1 Scope

- Registration
- Login
- Saved generations
- Credit balance
- Public/private visibility

---

## Suggested Schema

```sql
users

id
username
email
avatar
credit_balance
plan_type
is_admin
created_at
updated_at
```

---

# Module 9 — Feedback System

# Purpose

Turn users into data contributors.

This is a critical long-term system.

---

## Feedback Categories

### A. Missing Base Model

Example:

```text
Please add HG Aerial Rebuild
```

---

### B. Style Request

Example:

```text
Need Armored Core inspired style
```

---

### C. Generation Quality

Example:

```text
Mask separation looks unrealistic
```

---

### D. Paint Mapping Problems

Example:

```text
Recommended paint is unavailable in EU
```

---

## Suggested Schema

```sql
feedback_entries

id
user_id
feedback_type
related_generation_id
content
status
admin_notes
created_at
updated_at
```

---

# Module 10 — Admin Panel

# Purpose

Provide operational control.

---

# Admin Features

## User Management

- Credit adjustment
- Ban/unban
- View generation history

---

## Style Preset Management

- Create/edit styles
- Toggle visibility
- Adjust prompt weighting

---

## Paint Finish & Weathering Management

- Add paint finishes
- Edit finish logic
- Configure material visual prompts
- Configure weathering preview effects
- Configure weathering tips and skill notes

---

## Feedback Review Queue

- Prioritize requests
- Approve future additions
- Review quality issues

---

## Generation Monitoring

Track:

- Most used styles
- Failed generations
- Excessive regenerations
- Credit consumption

---

## Cost Monitoring

Critical for image API sustainability.

Track:

- Cost per user
- Cost per render
- Average regenerate count

---

# P1 Frontend Scope

P1 frontend should remain minimal.

---

## Required Pages

### Landing Page

### Login/Register

### Basic Dashboard

### Generate Page

### Saved Concepts

### Feedback Submission

---

# P1 Success Metrics

## Technical Success

- Stable generation pipeline
- Reliable prompt composition
- Controlled image costs
- Stable admin operations

---

## Product Success

- Users can generate usable repaint concepts
- Users save concepts
- Users submit style requests
- Users request new models

---

# PHASE 2 — Community & SEO Expansion

# Goal

Transform NeotypeLab from a generation tool into:

> A searchable mecha repaint ecosystem.

---

# P2 Core Objectives

## 1. Community Showcase

## 2. Remix System

## 3. Public SEO Pages

## 4. Style Discovery

## 5. User Profiles

## 6. Social Sharing

---

# P2 Features

# Module 1 — Public Showcase

Users can publish:

- Repaint concepts
- Style variations
- Community presets

---

# Module 2 — Remix System

## Purpose

Enable creative branching.

Example:

```text
RX78 EVA Remix
→ Desert Ops Remix
→ Battle-Damaged Remix
```

---

# Module 3 — SEO Landing Pages

Automatically generated pages:

```text
/rx78/eva-style
/barbatos/cyberpunk
/sazabi/desert-ops
```

---

# Module 4 — Style Discovery

Users browse:

- Trending styles
- Most saved concepts
- Most remixed builds
- Beginner-friendly schemes

---

# Module 5 — User Profiles

Profiles include:

- Saved builds
- Published concepts
- Remix history
- Likes
- Followers (optional future)

---

# Module 6 — Social Distribution

Support:

- Pinterest sharing
- Reddit-friendly export
- Social image previews
- Watermarked previews

---

# P2 SEO Strategy

Core SEO focus:

## Inspiration Search Intent

Examples:

- Gundam color ideas
- Gunpla repaint ideas
- Cyberpunk mecha colors
- EVA inspired Gunpla

---

# P2 Success Metrics

- Indexed showcase pages
- Organic SEO traffic
- User-generated showcase growth
- Saved/remixed concepts

---

# PHASE 3 — Advanced Creative Platform

# Goal

Transform NeotypeLab into:

> A full creative operating system for hobby repaint planning.

---

# P3 Core Objectives

## 1. Advanced Paint Planning

## 2. Real-world Spray Simulation

## 3. AI Recommendation System

## 4. Affiliate Commerce Layer

## 5. Advanced Creator Ecosystem

---

# P3 Features

# Module 1 — Spray Feasibility System

Estimate:

- Masking complexity
- Paint cost
- Beginner difficulty
- Layer count
- Surface compatibility

---

# Module 2 — Smart Recommendations

Recommend:

- Similar styles
- Compatible paint finishes
- Trending palettes
- Beginner alternatives

---

# Module 3 — Paint Shopping Lists

Auto-generate:

- Paint purchase lists
- Brand alternatives
- Regional availability
- Affiliate links

---

# Module 4 — Creator Ecosystem

Potential future systems:

- Verified creators
- Featured styles
- Premium creator packs
- Marketplace presets

---

# Module 5 — Advanced Rendering

Potential future:

- Multi-angle preview
- Animated rotation
- Build-stage visualization
- Damage/weathering simulation

---

# Long-Term Vision

NeotypeLab becomes:

- A repaint planning tool
- A mecha inspiration platform
- A spray-ready design system
- A hobby creative ecosystem
- A structured paint knowledge graph

The long-term moat is NOT image generation.

The moat is:

- Structured style data
- Paint finish logic
- Paint mapping
- Community remix behavior
- Hobby workfl
