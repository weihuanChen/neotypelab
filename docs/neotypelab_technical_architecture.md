# NeotypeLab Technical Architecture

## 1. Document Purpose

This document describes the current technical baseline for NeotypeLab after the
TanStack migration work.

NeotypeLab is built with:

- `TanStack Start` and `TanStack Router` for the frontend and application shell
- `Cloudflare Workers` for the default frontend deployment target
- `Convex` for backend data, realtime queries, mutations, actions, and server
  orchestration
- `Clerk` for authentication, bridged into Convex auth
- `R2` for generated assets and public preview delivery

The old Next App Router tree under `app/` is retained only as a migration
fallback/reference snapshot.

P3 isolation keeps that fallback available without making the TanStack runtime
depend on it. Global runtime styles used by TanStack live in
`src/styles/globals.css`; `app/globals.css` belongs to the retained Next
fallback.

---

## 2. Current Baseline

The active product implementation now lives in `src/`.

Implemented production surfaces include:

- public showcase and discovery routes
- public prototype pages with SSR snapshots and live Convex hydration
- public pilot, creator hub, creator pack, and SEO landing routes
- Open Graph, social/export SVG routes, sitemap, and robots output
- authenticated terminal routes for overview, create, library, showcase,
  feedback, and admin
- shared terminal navigation/readout shell for TanStack routes
- Convex domain modules for product catalog, concepts, generation jobs, credits,
  feedback, public engagement, recommendations, shopping, and feasibility

The retained `app/` tree is not the production source of truth.

---

## 3. System Boundary

### 3.1 Frontend Layer: TanStack Start

Responsibilities:

- file routes in `src/routes`
- SSR data snapshots through TanStack loaders/server functions
- public route metadata, canonical tags, social cards, sitemap, and robots
- authenticated terminal UI
- client interaction state
- integration with Clerk and Convex client providers

### 3.2 Application/Data Layer: Convex

Responsibilities:

- canonical product data model
- authenticated and public queries/mutations
- realtime updates
- credits and usage logic
- feedback and admin operations
- generation job orchestration hooks
- recommendation, feasibility, shopping, and render-support data

### 3.3 Auth Layer: Clerk

Responsibilities:

- sign in / sign up
- session management
- identity token generation for Convex
- TanStack Start middleware and client provider integration

### 3.4 External Services

Expected integrations:

- `R2` for generated assets, references, and derived previews
- generation providers for image/render workflows
- `Resend` if transactional email returns to active scope

---

## 4. Frontend Module Architecture

Canonical frontend ownership:

- `src/routes` for TanStack routes and route metadata
- `src/components/create` for authenticated creation workflow
- `src/components/library` for authenticated library and render tools
- `src/components/feedback` for authenticated feedback relay
- `src/components/admin` for admin operations
- `src/components/prototype` for public prototype pages
- `src/components/public` for creator, creator pack, SEO landing, and shared
  public actions
- `src/components/pilot` for public pilot profiles
- `src/components/showcase` for public and terminal showcase feed components
- `src/components/terminal` for shared authenticated terminal shell
- `src/lib` for TanStack-safe server/client helpers
- `components/ui` for shared low-level UI primitives

The `app/layouts/*` directory is a retained Next-only layout demo/scaffold area.
It is not product IA and is not being migrated into TanStack.

---

## 5. Auth and Request Flow

Current auth path:

1. Clerk authenticates the user.
2. `StartProviders` installs Clerk and Convex client providers when environment
   variables are available.
3. `ConvexProviderWithClerk` passes auth to Convex.
4. Convex resolves the authenticated identity and maps it to an internal user
   record.
5. Public routes can render from server-side Convex HTTP snapshots and hydrate
   live client data when providers are available.

Current relevant files:

- `src/providers/StartProviders.tsx`
- `src/start.ts`
- `convex/auth.config.js`
- `convex/users.ts`
- `src/lib/convexServer.ts`

---

## 6. Product Domain Modules

The Convex backend now owns the product domain. Important modules include:

- base models, style presets, material presets, color roles, and paint mappings
- concepts, saved public concepts, public engagement, and remix lineage
- generation jobs, render history, and prototype tools
- feasibility, shopping lists, recommendations, and recommendation feedback
- feedback reports and admin triage
- credit accounts, credit ledger, campaigns, and activation codes

User-facing creation exposes:

```text
Base Model + Style DNA + Paint Finish + Weathering
```

`Paint Finish` is a spray decision that affects surface state, compatibility,
finish feasibility, paint matching, and generated spray plans.

`Weathering` is a finishing effect layer. It affects preview/render guidance,
effort estimation, skill level, and user tips, but should not be treated as a
base paint product selector.

---

## 7. Environment and Configuration

Common environment variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `VITE_CONVEX_URL` when using Vite-only local naming
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY` when using Vite-only local naming
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `SUPER_ADMIN_EMAILS`
- `R2_BUCKET_PUBLIC`
- `R2_BUCKET_PRIVATE`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_END_POINT`
- `R2_PUBLIC_BASE_URL`
- `R2_PRIVATE_BASE_URL` reserved for a future authenticated delivery Worker
- generation provider keys such as `OPENAI_API_KEY`

Rules:

- keep local secrets in `.env.local`
- keep server-only keys out of client bundles
- configure public `NEXT_PUBLIC_*` values for both build and Worker runtime
- set Worker secrets through Wrangler or the Cloudflare dashboard
- use `R2_PUBLIC_BASE_URL` only for public distribution objects
- authorize private asset requests before returning a short-lived S3 presigned URL

### Asset persistence model

Asset persistence separates user-visible works from their versions and physical
storage objects:

- `mediaAssets` owns the logical image or file and points to its current version
- `assetVersions` records generation, upload, edit, and upscale history
- `storageObjects` records each physical `original`, `master`, `preview`, or
  `thumbnail` rendition and its bucket role
- `assetPublications` records explicit copies published to Showcase, templates,
  or product static content

The legacy `assets` table remains the compatibility surface during migration.
New writes atomically create both the legacy row and the new asset graph, with
cross-references on the legacy asset, concept, and generation job. Existing
queries continue reading `assets` until the Library and Showcase read paths are
migrated in later phases.

### Entitlement resolution

Account capabilities are resolved independently from credits and storage
objects. `entitlementProfiles` contains the versioned Free, Pro, and Studio
baselines, while `accountEntitlementGrants` contains time-bound subscription,
promotion, feedback, early-adopter, and manual additions.

The effective entitlement resolver applies these rules:

- byte quota adjustments are additive and cannot reduce a result below zero
- retention periods and maximum dimensions use the highest active value
- capability flags are enabled when any active source enables them
- grants outside their active window or with `revokedAt` do not participate
- `users.entitlementProfileId` overrides the profile selected by `planType`
- built-in defaults provide a deployment-safe fallback before profiles are seeded

Credits remain a separate consumption ledger. Storage and generation code must
read effective entitlements rather than branching on `planType`.

### Private Library ingestion

AI model output is stored as an `original` object in `R2_BUCKET_PRIVATE` using
a deterministic key derived from the user, concept, and generation job. The
write flow reserves the legacy asset, version, and storage object as
`processing`/`pending` before uploading, then atomically marks them ready with
the generation job. Retries reuse the same version and object key. Failed
uploads retain a recoverable failed record instead of creating duplicate asset
graphs.

Private URLs are never persisted. An authenticated action verifies object
ownership, ready status, private bucket role, and effective Original download
entitlement before issuing a 15-minute S3 presigned URL. The legacy public URL
stabilizer rejects private storage objects.

### Image rendition pipeline

Each generated Original is processed once with Sharp before the generation job
is completed. The private Library version receives three WebP renditions:

- `master`: effective `masterMaxDimensionPx`, WebP quality 86
- `preview`: maximum 1280px, WebP quality 80
- `thumbnail`: maximum 512px, WebP quality 74

Resizing preserves aspect ratio and never enlarges a smaller source. Original
and derived objects record their actual width, height, byte size, SHA-256
checksum, content type, and R2 ETag. All four deterministic object keys are
reserved as pending before parallel upload. A job becomes successful only when
the complete Master/Preview/Thumbnail set is recorded as ready.

---

## 8. Deployment

Default frontend deployment:

```bash
npm run build
npm run deploy
```

Equivalent explicit path:

```bash
npm run build:tanstack
npm run deploy:tanstack
```

Convex deploys separately:

```bash
npx convex deploy
```

The retained Next build is fallback-only:

```bash
npm run build:next
npm run start:next
```

---

## 9. Verification

Minimum migration checks:

```bash
npx tsc --noEmit
npm run build
```

Recommended smoke routes:

- `/`
- `/showcase`
- `/prototype/:conceptId`
- `/prototype/:conceptId/opengraph-image`
- `/prototype/:conceptId/watermarked-image`
- `/t`
- `/t/create`
- `/t/library`
- `/t/showcase`
- `/t/feedback`
- `/robots.txt`
- `/sitemap.xml`

---

## 10. Migration Notes

Do not add new product behavior only in `app/`. If a useful fallback fix lands
there, port the behavior into `src/` and document the migration state.

See `docs/tanstack_migration_backlog.md` for task tracking and
`docs/tanstack_migration_state.md` for ownership rules.
