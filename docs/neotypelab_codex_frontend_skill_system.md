# NeotypeLab Frontend Skill System

# Purpose

This document defines the mandatory frontend development constitution for all future NeotypeLab development tasks.

This skill system exists to ensure:

- Visual consistency
- Brand identity stability
- Mobile usability
- Controlled cinematic atmosphere
- Long-term maintainability
- High-quality UI execution using Codex or AI coding systems

---

# Core Product Identity

NeotypeLab is NOT:

- A generic AI image generator
- An anime portal
- A web3 dashboard
- A colorful SaaS template
- A toy catalog

NeotypeLab IS:

> A future mecha repaint R&D terminal for hobby builders.

The experience should feel like:

- Industrial
- Tactical
- Experimental
- Structured
- Functional
- Cinematic but restrained

Core mood:

> Death Stranding industrial terminal UI
+ Hathaway cockpit HUD accents

---

# Mandatory Frontend Philosophy

# 1. Controlled Creativity

The UI must guide creativity without chaos.

Avoid:

- Overwhelming effects
- Visual noise
- Infinite customization complexity
- Over-designed interfaces

The system should feel:

- Stable
- Engineered
- Purpose-built

---

# 2. User Creations Are the Hero

The generated repaint concepts are the primary visual focus.

The UI is only the delivery system.

Therefore:

- UI colors must remain restrained
- Layout should frame the work
- Interface should not compete with generated images

---

# 3. Mobile-First Inspiration Workflow

The platform must work extremely well on mobile.

Users may discover inspiration from:

- Reddit
- Facebook
- YouTube
- Pinterest
- Discord

The UI should allow users to prototype concepts quickly on mobile.

Goal:

> Create a repaint concept in under 60 seconds.

---

# Global Design Direction

# Primary Design Language

70% Death Stranding

Used for:

- Layout
- Navigation
- Panels
- Typography
- Dashboard
- Empty states
- Information architecture

30% Hathaway HUD

Used for:

- Loading sequences
- Simulation moments
- Tactical overlays
- Reactor feedback
- Cinematic emphasis

Do NOT turn the entire application into a cockpit simulator.

HUD effects must be used sparingly.

---

# Visual Restrictions

# Forbidden Styles

NEVER use:

- Rainbow gradients
- Web3 glow effects
- Neon overload
- Generic AI startup visuals
- Anime portal aesthetics
- Bright saturated dashboard colors
- Oversized marketing typography
- Glassmorphism overload
- Floating blob backgrounds
- Excessive motion
- Colorful cards everywhere

Avoid:

- Pure black backgrounds
- Full cyberpunk UI
- Cartoon styling
- Cute anime aesthetics

---

# Required Visual Traits

Always prioritize:

- Industrial dark surfaces
- Thin borders
- Modular layouts
- Tactical spacing
- System-style labeling
- Strong hierarchy
- Functional minimalism
- Cinematic restraint

---

# Color System

# Primary Background Colors

```ts
export const colors = {
  bgMain: '#0D1117',
  bgSurface: '#11161D',
  bgPanel: '#161B22',
  bgElevated: '#1B222C',
}
```

# Border Colors

```ts
export const borders = {
  subtle: 'rgba(255,255,255,0.08)',
  muted: '#2B3440',
  active: '#3A4654',
}
```

# Text Colors

```ts
export const text = {
  primary: '#E6EDF3',
  secondary: '#9BA7B4',
  muted: '#6E7A88',
}
```

# Accent Colors

Primary accent:

```ts
export const accent = {
  cyan: '#3DD9FF',
  cyanSoft: 'rgba(61,217,255,0.16)',
}
```

Secondary accent:

```ts
export const accentGreen = {
  green: '#58FFB2',
  greenSoft: 'rgba(88,255,178,0.14)',
}
```

Warning colors:

```ts
export const warning = {
  amber: '#FFB84D',
  red: '#FF5F5F',
}
```

---

# Typography Rules

# Primary Fonts

Allowed:

- Inter
- Sora
- Space Grotesk

# Technical Fonts

Allowed:

- JetBrains Mono
- IBM Plex Mono
- Space Mono

# Optional Accent Font

Allowed sparingly:

- Orbitron

Do NOT overuse sci-fi fonts.

Main UI should remain readable.

---

# Typography Hierarchy

Avoid:

- Giant landing-page typography
- Marketing-heavy SaaS headlines

Prefer:

- System hierarchy
- Technical labeling
- Compact structured sections

Example labels:

```text
STYLE DNA
PAINT FINISH
WEATHERING
REACTOR OUTPUT
PAINT MAPPING
```

---

# Layout Rules

# Desktop Layout

Preferred structure:

```text
Left Navigation Rail
Main Workspace
Right Context Panel
```

# Left Navigation

Contains:

- Dashboard
- Prototype
- Library
- Showcase
- Feedback
- Credits
- Settings

# Main Workspace

Contains:

- Builder flow
- Preview area
- Community showcase
- Result display

# Right Panel

Contains:

- Credit cost
- Style DNA
- Paint finish
- Weathering level
- Paint mapping
- Reactor status

---

# Mobile Layout Rules

# Mobile Is Mandatory

Every component must work naturally on mobile.

Do NOT treat mobile as secondary.

# Mobile Priorities

- One-thumb operation
- Fast creation
- Minimal typing
- Large touch targets
- Sticky bottom CTA
- Quick preview access

# Mobile Navigation

Use bottom navigation.

Recommended tabs:

- Create
- Explore
- Library
- Feedback
- Account

---

# Component Constitution

# Panels

All panels MUST:

- Use dark surfaces
- Use thin borders
- Use subtle elevation only
- Avoid bright glow
- Maintain modular spacing

Standard:

```css
border-radius: 16px;
border: 1px solid rgba(255,255,255,0.08);
background: #161B22;
```

---

# Buttons

# Primary CTA

Required style:

- Dark fill
- Cyan border or glow
- Strong typography
- Minimal animation

Allowed labels:

- Initialize Prototype
- Run Simulation
- Build Concept
- Save to Hangar
- Remix Scheme

Avoid:

- “Generate AI Art”
- “Create Image”
- Generic AI wording

# Secondary Buttons

- Outline style
- Low emphasis
- Minimal glow

---

# Cards

Cards should feel like:

> Industrial data modules.

Card structure:

- Thumbnail
- Technical label
- Small metadata
- Minimal decoration

Avoid:

- Large colorful shadows
- Bright gradients
- Overly playful layouts

---

# Inputs

Inputs should:

- Be compact
- Be structured
- Feel technical

Avoid:

- Giant prompt textareas
- Long freeform prompt systems

Users should mostly interact through:

- Structured selections
- Chips
- Presets
- Toggles
- Limited notes

---

# Motion Constitution

# Allowed Motion

- Panel fade
- Soft scan activation
- Tactical sweep
- Reactor pulse
- Progress line animation
- Small hover lift

# Forbidden Motion

- Excessive particles
- Floating animations everywhere
- Large cinematic transitions
- Long intro animations
- Motion that blocks interaction
- Web3-style movement systems

Animation must support usability.

---

# HUD Accent Rules

HUD overlays are accent systems only.

Allowed use cases:

- Generation state
- Reactor loading
- Simulation complete
- High-value reveal moments

Allowed HUD elements:

- Thin scan lines
- Tactical grids
- Small radar arcs
- System diagnostics
- Numeric overlays

Do NOT:

- Cover the whole screen
- Reduce readability
- Use permanent cockpit overlays

---

# Loading State Rules

Loading sequences should feel like:

> A simulation process.

Allowed examples:

```text
INITIALIZING STYLE DNA
SYNCING PAINT FINISH
CALCULATING WEATHERING TIPS
COMPOSING SPRAY PLAN
RENDERING PREVIEW
OUTPUT STABILIZED
```

Avoid meme AI loading text.

---

# Content Philosophy

# User Work Is the Content

The interface should elevate:

- Generated concepts
- Paint plans
- Community showcases
- Remix culture

The interface itself should not dominate.

---

# Community Experience Rules

The platform should feel:

- Serious enough for hobby builders
- Stylish enough for sharing
- Functional enough for long-term use

Avoid:

- Social media chaos
- Meme overload
- Excessive gamification

---

# Mobile Workflow Constitution

# Target Experience

Users should:

1. Open app/site
2. Select base model
3. Select style DNA
4. Select paint finish
5. Select weathering
6. Run prototype
7. Save/share concept

All within:

> Under 60 seconds.

---

# Mobile UX Rules

Required:

- Sticky CTA
- Large cards
- Horizontal preset scrolling
- Minimal typing
- Autosave selections
- Fast transitions

Forbidden:

- Multi-column forms
- Tiny controls
- Long dropdowns
- Hidden actions
- Desktop-style tables

---

# Design Tokens Requirement

All UI must use centralized design tokens.

Required files:

```text
/colors.ts
/spacing.ts
/typography.ts
/motion.ts
/radius.ts
/shadows.ts
```

Never hardcode styles repeatedly.

---

# Engineering Requirements

# Frontend Stack Direction

Preferred:

- Next.js
- Tailwind
- shadcn/ui as base only
- Framer Motion (restrained usage)

shadcn/ui must be heavily customized.

Do NOT ship default shadcn appearance.

---

# Responsive Rules

All screens must be validated for:

- Mobile portrait
- Tablet portrait
- Desktop widescreen

Desktop-only interfaces are unacceptable.

---

# Accessibility Rules

Required:

- Strong contrast
- Readable text
- Clear active states
- Reduced motion support
- Keyboard navigation support

Avoid relying only on color.

---

# Page-Level Direction

# Landing Page

Feel:

- Future industrial terminal
- Controlled cinematic atmosphere
- Mecha R&D system

Avoid:

- Marketing-heavy SaaS hero
- Bright startup visuals

# Create Page

Feel:

- Structured prototype workflow
- Technical but approachable

# Showcase Page

Feel:

- Curated concept archive
- Industrial gallery

# Admin Panel

Feel:

- Functional operations terminal
- Minimal cinematic effects

---

# Language Rules

Preferred wording:

- Prototype
- Simulation
- Style DNA
- Paint Finish
- Weathering
- Reactor Output
- Build Concept
- Paint Mapping
- Saved Hangar

Avoid:

- AI image generator
- Prompt engineering
- AI art creation
- Magic generation wording

---

# Final UX Target

Users should feel:

> I am operating a future mecha repaint system used to prototype experimental machine configurations before committing paint to plastic.

The experience must feel:

- Functional
- Premium
- Immersive
- Structured
- Stable
- Mobile-friendly
- Community-ready

Not:

- Cheap AI tool
- Anime fan portal
- Generic startup dashboard
