# NeotypeLab UI Direction Document

# Visual Direction

## Core Style

NeotypeLab should use:

> Death Stranding-inspired industrial terminal UI as the primary design language, with Hathaway cockpit HUD elements as controlled accents.

The interface should feel like:

> A future mecha R&D terminal for testing repaint concepts before real spraying.

It should NOT feel like:

- A generic AI image generator
- An anime fan site
- A web3 dashboard
- A colorful SaaS landing page
- A toy catalog

---

# Brand Atmosphere

## Core Keywords

- Industrial
- Terminal
- Prototype
- Tactical
- Laboratory
- Post-collapse technology
- Mecha R&D
- Controlled energy
- Spray-ready planning
- Experimental system

---

# Design Ratio

## 70% Death Stranding

Used for:

- Layout
- Dashboard
- Navigation
- Data panels
- Typography
- Empty states
- Admin panel
- Mobile usability
- Long-session comfort

## 30% Hathaway Cockpit HUD

Used for:

- Generation state
- Loading animation
- Simulation overlay
- Reactor-style status indicators
- High-value preview moments
- Hero section accent
- Warning and cost confirmation states

---

# Design Principle

## UI Is the Container, User Work Is the Visual Focus

The user-generated repaint images and color schemes should be the most colorful elements on the page.

The UI should be restrained, dark, modular, and functional.

Do not let interface colors compete with generated works.

---

# Color System

## Background Colors

Use dark industrial colors.

```css
--bg-main: #0D1117;
--bg-surface: #11161D;
--bg-panel: #161B22;
--bg-elevated: #1B222C;
```

## Border / Line Colors

```css
--line-muted: #2B3440;
--line-active: #3A4654;
--line-subtle: rgba(255,255,255,0.08);
```

## Text Colors

```css
--text-primary: #E6EDF3;
--text-secondary: #9BA7B4;
--text-muted: #6E7A88;
```

## Accent Colors

Primary accent should be Reactor Cyan.

```css
--accent-cyan: #3DD9FF;
--accent-cyan-soft: rgba(61,217,255,0.16);
```

Secondary accent can be Reactor Green.

```css
--accent-green: #58FFB2;
--accent-green-soft: rgba(88,255,178,0.14);
```

Warning / cost / irreversible action color:

```css
--accent-amber: #FFB84D;
--accent-red: #FF5F5F;
```

## Avoid

Do not use classic Gundam blue-white-red-yellow as the main UI palette.

Those colors may appear inside generated content, but not as the brand UI system.

---

# Typography

## Recommended Fonts

Primary:

- Inter
- Sora
- Space Grotesk

Technical accent font:

- JetBrains Mono
- IBM Plex Mono
- Space Mono

Optional display font:

- Orbitron, used very sparingly

## Typography Rules

Use clean, readable fonts for most UI.

Use mono fonts for:

- Status labels
- Model IDs
- Generation logs
- Credit costs
- Prompt/debug-style panels

Avoid overly decorative anime fonts.

---

# Layout System

## Desktop Layout

Use a modular terminal layout.

Recommended structure:

```text
Left Rail Navigation
Main Workspace
Right Context Panel
```

### Left Rail

Contains:

- Dashboard
- Prototype
- Library
- Showcase
- Feedback
- Credits
- Admin, if applicable

### Main Workspace

Contains:

- Builder flow
- Preview area
- Scheme cards
- Community content

### Right Context Panel

Contains:

- Current credit cost
- Selected style DNA
- Paint finish
- Weathering level
- Paint mapping
- Output status

---

# Mobile Layout

Mobile is critical.

Users may get repaint inspiration while browsing Reddit, Facebook, YouTube, or hobby forums.

The mobile experience must allow users to create quickly without feeling like they need a desktop.

## Mobile Design Goal

> Capture inspiration and create a repaint concept in under 60 seconds.

---

# Mobile Navigation

Use bottom navigation instead of desktop side rail.

Recommended tabs:

1. Create
2. Explore
3. Library
4. Feedback
5. Account

Keep the main action always accessible.

Primary CTA:

```text
Prototype
```

or:

```text
Run Simulation
```

Avoid using only:

```text
Generate
```

---

# Mobile Creation Flow

The mobile flow should be step-based and thumb-friendly.

## Step 1 — Select Base Model

Use large cards.

Each card contains:

- Model image
- Name
- Series
- Difficulty indicator

## Step 2 — Select Style DNA

Use horizontal scroll cards.

Examples:

- EVA-inspired
- Military Prototype
- Cyberpunk
- Stealth Black
- Desert Ops
- Industrial Mecha

## Step 3 — Select Paint Finish

Use chips or compact cards.

Examples:

- Matte Finish
- Semi-gloss Finish
- Gloss Finish
- Metallic Finish
- Pearl Finish
- Candy Coat

## Step 4 — Select Weathering

Use a 3-option control with optional effect chips:

- Clean
- Light
- Heavy

Optional effects:

- Dry Brushing
- Chipping
- Wash
- Rust Effects
- Dust Effects
- Burn Marks

## Step 5 — Optional Note

Small text input.

Limit:

- 50–100 characters

Placeholder:

```text
Add a small direction, e.g. orange warning decals
```

## Step 6 — Review Cost

Show credit cost clearly before running.

Example:

```text
Palette Plan: 2 credits
HD Preview: +5 credits optional
```

## Step 7 — Result

Show:

- Preview image
- Color breakdown
- Paint mapping
- Save button
- Remix button
- Share button

---

# Mobile Interaction Rules

## Must-Have

- One-handed use
- Sticky bottom CTA
- Large touch targets
- Fast style browsing
- Save draft automatically
- Allow generation without long typing

## Avoid

- Large prompt textareas
- Desktop-style tables
- Tiny controls
- Multi-column forms
- Complex sliders
- Hidden credit cost

---

# Component Design

# 1. Cards

Cards should feel like industrial data modules.

Style:

- Dark panel background
- Thin border
- Subtle glow only on active state
- Small technical label

Example:

```text
STYLE DNA / EVA-INSPIRED
High contrast · Experimental · Neon accent
```

---

# 2. Buttons

Primary CTA:

- Dark fill
- Cyan border or glow
- Strong label

Suggested labels:

- Initialize Prototype
- Run Simulation
- Build Concept
- Save to Hangar
- Remix Scheme

Secondary buttons:

- Outline style
- Minimal glow

Danger / cost buttons:

- Amber confirmation

---

# 3. Status Indicators

Use system-style labels.

Examples:

```text
STYLE DNA LOADED
PAINT FINISH ACTIVE
WEATHERING EFFECTS READY
PAINT MAPPING ONLINE
REACTOR OUTPUT READY
```

Use these sparingly.

They should create atmosphere without reducing usability.

---

# 4. Loading / Generation State

This is where Hathaway HUD accents can appear.

Recommended sequence:

```text
INITIALIZING STYLE DNA
SYNCING PAINT FINISH
CALCULATING WEATHERING TIPS
COMPOSING SPRAY PLAN
RENDERING PREVIEW
OUTPUT STABILIZED
```

Visual effects:

- Thin scan lines
- Subtle radar arcs
- Cyan pulse
- Panel flicker
- Tactical grid overlay

Avoid:

- Overly long loading theater
- Loud animations
- Flashing effects
- Full-screen chaos

---

# 5. Credit Display

Credits should feel like system energy or capacity, but remain understandable.

Recommended label:

```text
Reactor Credits
```

or:

```text
Credit Capacity
```

Do not make payment language too obscure.

Best compromise:

```text
Credits / Reactor Capacity
```

Example display:

```text
Available Credits: 84
HD Preview Cost: 5 credits
```

---

# 6. Feedback System UI

Feedback should feel like sending a lab report.

Categories:

- Request New Model
- Request New Style
- Report Bad Output
- Paint Mapping Issue
- Other

Suggested label:

```text
Submit Lab Report
```

Mobile feedback should be very easy.

After a result, show:

```text
Was this output useful?
[Yes] [Needs Improvement]
```

If improvement is selected:

- Bad color separation
- Unrealistic finish
- Wrong model silhouette
- Poor paint mapping
- Too complex to spray
- Other

---

# Page-Level Direction

# 1. Landing Page

## Goal

Communicate that NeotypeLab is a spray-ready mecha repaint planning platform.

## Hero Feel

Industrial terminal + mecha preview.

## Suggested Hero Copy

```text
Prototype your next repaint before you spray.
```

Subcopy:

```text
Build spray-ready mecha color concepts with structured style DNA, paint finishes, weathering effects, and realistic paint planning.
```

Primary CTA:

```text
Initialize Prototype
```

Secondary CTA:

```text
Explore Community Schemes
```

---

# 2. Create Page

## Goal

Fast concept creation.

Desktop:

- Left: selection controls
- Center: preview
- Right: system summary / credit cost

Mobile:

- Step-based wizard
- Sticky CTA
- Autosave selections

---

# 3. Result Page

## Goal

Turn output into a useful repaint decision asset.

Must include:

- Preview image
- Color role breakdown
- Paint finish
- Weathering tips
- Paint mapping
- Difficulty estimate
- Save
- Remix
- Share
- Feedback

---

# 4. Library Page

## Goal

Help users store and revisit concepts.

Use terms like:

- Hangar
- Saved Prototypes
- Build Library

Avoid making it feel like a generic image gallery.

---

# 5. Showcase Page

## Goal

Community inspiration and SEO.

Each showcase card should include:

- Preview image
- Base model
- Style DNA
- Paint finish
- Weathering level
- Like/save/remix

Grid should be clean and image-first.

UI should not overpower the cards.

---

# 6. Admin Panel

Admin should be more functional than cinematic.

Use the same design system, but reduce HUD effects.

Admin priorities:

- Speed
- Clarity
- Filtering
- Batch editing
- Feedback triage
- Cost monitoring

---

# Motion Design

## Recommended Motion

- Panel fade-in
- Soft scan activation
- Small HUD pulse
- Progress line sweep
- Card hover lift

## Avoid

- Heavy 3D animations
- Excessive particles
- Long cinematic intros
- Motion that blocks workflow

---

# Iconography

Use clean technical icons.

Recommended style:

- Thin line icons
- Industrial symbols
- System status icons

Icon categories:

- Model
- Style
- Paint finish
- Weathering
- Credits
- Feedback
- Save
- Remix
- Share
- Warning

---

# Imagery Direction

## Generated Preview Images

Should be treated as hero assets.

Use:

- Large preview area
- Dark background
- Minimal UI interference
- Optional blueprint overlay

## Avoid

- Too many UI decorations over images
- Classic anime poster layout
- Colorful background gradients

---

# Accessibility

Must support:

- Strong contrast
- Readable text on dark background
- Clear active states
- Mobile-friendly touch targets
- Reduced motion option

Avoid relying only on color to communicate status.

---

# Do / Don't Summary

## Do

- Make the site feel like a future mecha lab
- Keep UI dark, restrained, and modular
- Let user creations provide color
- Use Death Stranding-like terminal logic
- Use Hathaway cockpit HUD only for emotional moments
- Make mobile creation fast and thumb-friendly
- Show credit cost before paid actions

## Don't

- Use classic Gundam blue-white-red as the main UI system
- Build a generic AI image generator interface
- Overuse neon effects
- Make users write long prompts
- Hide costs
- Overload mobile screens
- Make the whole site feel like a cockpit simulator

---

# Final Design Target

When users open NeotypeLab, they should feel:

> I am operating a future mecha R&D terminal to test the next repaint concept before committing paint to plastic.

The experience should be:

- Fast enough for mobile inspiration
- Serious enough for hobby builders
- Stylish enough for sharing
- Structured enough for SEO and data expansion
- Controlled enough to manage AI cost and output quality
