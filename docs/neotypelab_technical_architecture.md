# NeotypeLab Technical Architecture

## 1. Document Purpose

This document defines the current technical baseline and target architecture for NeotypeLab.

NeotypeLab is built with:

- `Next.js` for frontend and application shell
- `Convex` for backend data, realtime queries, and server logic
- `Clerk` for authentication

Deployment is not locked yet. The frontend may be deployed to `Vercel` or `Cloudflare`, while `Convex` remains the hosted backend.

---

## 2. Current Baseline

The current repository is still based on a Convex SaaS starter template.

Already implemented:

- `Next.js 14 App Router`
- `Convex` client/server integration
- `Clerk` authentication middleware
- team, member, invite, role, and message data models
- a starter dashboard flow under `app/t/*`

Current technical reality:

- `app/page.tsx` is still starter marketing content
- `app/t/*` is still team-space starter logic, not NeotypeLab domain logic
- `convex/schema.ts` currently models SaaS collaboration entities, not product entities like base models, style DNA, paint finishes, weathering effects, or paint mappings

This means the project has a usable infrastructure base, but the product domain still needs to be rebuilt around the PRD.

---

## 3. Target System Boundary

NeotypeLab should be split into four layers:

### 3.1 Frontend Layer: Next.js

Responsibilities:

- App Router pages and layouts
- mobile-first product flows
- marketing, dashboard, create, result, library, showcase, admin UI
- SSR/streaming where useful
- client-side interaction state
- integration with Clerk and Convex

### 3.2 Application/Data Layer: Convex

Responsibilities:

- canonical product data model
- authenticated queries and mutations
- realtime updates
- credits and usage logic
- feedback pipeline
- admin operations
- generation-job orchestration hooks for later phases

### 3.3 Auth Layer: Clerk

Responsibilities:

- sign in / sign up
- session management
- identity token generation for Convex
- route protection via `middleware.ts`

### 3.4 External Services

Expected integrations:

- `Resend` for transactional email
- `R2` for generated assets, references, and derived previews
- model/image generation providers in later phases

---

## 4. Recommended Product Module Architecture

Target Convex domain modules should move from the current team model to NeotypeLab product modules:

- `baseModels`
- `stylePresets`
- `paintFinishes`
- `weatheringEffects`
- `colorRoles`
- `paintMappings`
- `generationJobs`
- `savedConcepts`
- `feedbackReports`
- `creditAccounts`
- `creditLedger`
- `adminAuditLogs`

Recommended frontend route groups:

- `app/(marketing)` for landing and public pages
- `app/(app)` for authenticated product flows
- `app/(app)/create`
- `app/(app)/library`
- `app/(app)/showcase`
- `app/(app)/feedback`
- `app/(app)/admin`

The current `app/t/*` structure can be treated as temporary starter code and should not become the long-term product IA.

---

## 4.1 Paint Finish and Weathering Boundary

User-facing creation should expose:

```text
Base Model + Style DNA + Paint Finish + Weathering
```

`Paint Finish` is a real spray decision. It affects surface state, paint compatibility, finish feasibility, paint library matching, and generated spray plans.

`Weathering` is a finishing effect layer. It represents time, use, and damage marks such as dry brushing, chipping, wash, rust effects, dust effects, and burn marks. It should affect preview rendering, estimated effort, skill level, and small user tips, but it should not change base paint product matching.

Backend resolution should keep internal fields like `material_prompt`, `surface_reflection`, `finish_type`, and `spray_technique` available for prompt composition and spray-plan generation. These fields should not be surfaced as primary user-facing controls.

---

## 5. Auth and Request Flow

Current auth path is sound and can be retained:

1. Clerk authenticates the user.
2. `ConvexProviderWithClerk` passes auth to the Convex client.
3. Server-side Next.js calls can fetch a Clerk token with the `convex` template.
4. Convex resolves the authenticated identity and maps it to an internal user record.

Current relevant files:

- `app/ConvexClientProvider.tsx`
- `app/t/auth.ts`
- `middleware.ts`
- `convex/auth.config.js`
- `convex/users.ts`

This integration should stay, but the user bootstrap logic should eventually provision NeotypeLab user records instead of starter team records.

---

## 6. Frontend Architecture Direction

Frontend implementation must follow the existing design documents:

- industrial terminal UI
- restrained dark surfaces
- mobile-first workflow
- structured input instead of prompt-heavy UX

Engineering rules:

- use centralized design tokens
- heavily customize `shadcn/ui`
- avoid hardcoded one-off visual values
- keep generated content as the visual hero

Recommended shared frontend layers:

- `components/ui` for low-level primitives
- `components/system` for NeotypeLab-specific terminal/HUD components
- `components/domain` for product components like style cards, paint finish selectors, weathering controls, credit summaries
- `lib` for helpers, formatting, and shared client utilities

---

## 7. Environment and Configuration

Current or expected environment variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `RESEND_API_KEY` if invite or notification email is enabled
- `HOSTED_URL` for email links
- `R2_*` variables for the selected object storage layer
- `R2_PUBLIC_BASE_URL` when public previews should resolve against a fixed CDN or bucket domain

Rules:

- keep local secrets in `.env.local`
- keep server-only keys out of client bundles
- treat storage and generation-provider credentials as server-only

Object storage decision:

> `R2` is the selected object storage backend.

---

## 8. Deployment Decision Frame

Deployment status: `TBD`

### Option A: Vercel

Strengths:

- lowest-friction fit for `Next.js`
- simple App Router deployment path
- better default alignment for SSR and preview workflows

Recommended use:

- default frontend hosting candidate for the first stable release

### Option B: Cloudflare

Strengths:

- global edge distribution
- possible long-term fit if the product later needs edge-heavy delivery

Tradeoff:

- requires a separate compatibility spike before lock-in
- should be evaluated only after the core product flow is stable

Current recommendation:

> Build the application so deployment remains platform-neutral, but optimize the first release path around `Next.js + Convex` with Vercel as the simpler default candidate.

This is a recommendation, not a final platform decision.

---

## 9. Implementation Priorities

### Phase 1

- replace starter landing page
- replace starter team schema with product schema
- build create flow, saved concepts, feedback, and basic admin
- implement credits logic and generation pipeline shell

### Phase 2

- add showcase, remix, public SEO pages, profiles, and sharing

### Phase 3

- add spray-feasibility tooling, advanced recommendations, and commerce/supporting ecosystem modules

---

## 10. Immediate Technical Gaps

Current gaps between codebase and target product:

- starter schema does not match PRD entities
- starter routes do not match NeotypeLab information architecture
- no product-grade design token layer yet
- no test suite or deployment pipeline committed yet
- storage/generation pipeline is not implemented yet

The next engineering step should be a schema and route refactor plan, not cosmetic UI polishing.
