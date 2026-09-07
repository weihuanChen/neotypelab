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

The former Next App Router fallback has been retired. Global runtime styles live
in `src/styles/globals.css`.

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

- `VITE_SITE_URL`
- `VITE_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `VITE_CLERK_PUBLISHABLE_KEY`
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
- `CLOUDFLARE_CACHE_PURGE_ZONE_ID`
- `CLOUDFLARE_CACHE_PURGE_TOKEN`
- generation provider keys such as `OPENAI_API_KEY`

Rules:

- keep local secrets in `.env.local`
- keep server-only keys out of client bundles
- configure public `VITE_*` values at build time and rebuild when they change
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

### Showcase publication

Changing a concept from private to public or unlisted is an asset publication
workflow rather than a direct visibility update. The workflow copies only the
ready Master, Preview, and Thumbnail from the private Library version to the
public Showcase bucket under an immutable version prefix. It records pending
public storage objects before copying and switches `activePublicationId` only
after the complete public set is ready. A failed replacement leaves the prior
publication active.

Public queries require an active `published` publication and resolve images
from its public storage objects. Grid surfaces prefer Thumbnail, feeds use
Preview, and prototype detail surfaces prefer Master. The legacy asset URL is
maintained only for compatibility.

Withdrawal hides the concept and clears its active publication before deleting
public objects. Showcase UGC uses a one-hour cache lifetime; when dedicated
cache-purge credentials are configured, withdrawal also purges the three public
URLs immediately. Failed cleanup remains in `withdrawing` state so a later
cleanup worker can retry it.

### Storage accounting and reservations

Storage quota enforcement is independent from Credits and plan names.
`accountStorageUsage` records used and reserved bytes for optimized Library,
temporary Original, and pinned Original storage. `storageReservations` keeps an
idempotent ledger entry for every generation job.

The initial generation transaction reserves 8 MiB of optimized output and 16
MiB of Original capacity before debiting Credits or scheduling model work. Once
image encoding finishes, the reservation is adjusted to the exact Original plus
Master/Preview/Thumbnail sizes before any R2 upload starts. Successful jobs
settle against actual bytes in the same database transaction that marks all
objects ready; failed jobs release their reservation before credit refund logic
continues.

Every reservation check reconciles used bytes from private ready objects and
releases expired holds first. Free and Pro Originals count as temporary;
accounts with effective permanent Original storage count them as pinned.
Public Showcase copies and Convex-managed feedback files are unmetered in the
Library quota model. The `storageAccounting.viewerUsage` query returns used,
reserved, quota, available, and over-quota values for each category.

### Retention and deletion lifecycle

Generated private objects use separate top-level prefixes so bucket fallback
rules cannot touch permanent or browsing assets:

- `temporary-originals/` contains Original files with a finite retention date
- `pinned-originals/` contains entitlement-backed permanent Originals
- `library/` contains Master, Preview, and Thumbnail renditions

Each Original stores the effective retention policy, retention-days snapshot,
and `retainUntil` at generation time. A new processing version does not replace
`mediaAssets.currentVersionId`. Once the complete new version succeeds, the
prior current version becomes history and receives its own version-retention
deadline. The lifecycle claim mutation checks the current pointer again and
will remove an accidental expiry from a current Master, Preview, or Thumbnail
instead of deleting it.

`crons.ts` runs the deletion sweep every 15 minutes. It recovers stale deletion
claims, claims at most 100 due objects, deletes them through the Node R2 action,
and then marks each result deleted or schedules exponential retry. Usage is
reconciled after successful deletion. The daily orphan audit scans bounded
pages under all three private prefixes and records R2 keys without live DB
records in `storageOrphanReports`; it does not delete orphan candidates.
Per-prefix continuation tokens in `storageAuditCursors` allow bounded daily
scans to progress through large buckets across multiple runs.

The private R2 bucket also carries a delayed lifecycle fallback on
`temporary-originals/`. Its default is 365 days, well beyond the current 90-day
maximum policy. Increase the fallback before introducing an entitlement with
longer Original retention. Pinned Originals and `library/` are excluded from
the bucket rule.

### User storage controls

The authenticated Library displays optimized, temporary Original, and pinned
Original usage separately, including held reservations. Quota overage never
removes existing work or blocks reads; generation and direct imports reserve or
check capacity before creating new storage records.

Each current asset reports its Original size and retention deadline. Downloads
use an ownership-checked, short-lived private URL with attachment disposition.
User cleanup is a two-phase R2 operation with three bounded modes:

- Delete Original removes only the current Original.
- Clean old versions removes private objects from superseded versions.
- Space Saver combines both operations.

All modes preserve the current Master, Preview, and Thumbnail. A superseded
version with a live public copy remains a valid version record until that
publication is withdrawn.

### Credits-based Original pinning

`Keep Original` moves an eligible temporary Original into the
`pinned-originals/` prefix. The operation first verifies the R2 object, then
atomically reserves its real byte size and debits Credits. A successful copy
changes the object to `pinned-original` accounting with permanent retention;
a failed copy records one idempotent refund and releases the reservation.

Pricing is based on verified object size: up to 8 MiB costs 10 Credits, up to
20 MiB costs 20 Credits, and up to 50 MiB costs 40 Credits. Larger files are
rejected instead of allowing a fixed price to create unbounded storage cost.
The mutation also verifies that the user-confirmed quote still matches the
actual size tier before charging.
Pending operations older than 30 minutes are refunded by a 15-minute cron so
an interrupted Node action cannot hold Credits or quota indefinitely.

### Subscription billing boundary

Subscriptions are provider-neutral records. A subscription entitlement grant
references a versioned Pro or Studio profile; recurring Credits use a separate
ledger keyed by subscription and billing-period start. Credit Pack orders do
not create or modify subscriptions.

Payment adapters POST normalized events to `/billing/webhook`. Requests carry
`x-neotypelab-timestamp` as Unix seconds and `x-neotypelab-signature` as
`v1=<hex HMAC-SHA256>` over `<timestamp>.<raw body>`, using
`BILLING_WEBHOOK_SECRET`. Timestamps outside five minutes are rejected.

```json
{
  "eventId": "evt_unique",
  "provider": "provider-name",
  "eventType": "subscription.renewed",
  "externalSubscriptionId": "sub_unique",
  "userId": "Convex user ID",
  "planType": "pro",
  "periodStart": 1788652800000,
  "periodEnd": 1791244800000,
  "monthlyCredits": 200,
  "cancelAtPeriodEnd": false,
  "occurredAt": 1788652800000
}
```

Supported event types are `subscription.started`, `subscription.renewed`,
`subscription.updated`, `subscription.payment_failed`,
`subscription.canceled`, and `subscription.refunded`. Event IDs prevent replay;
subscription plus period start prevents duplicate monthly Credits. Upgrades
apply immediately, downgrades wait until renewal, cancellation and payment
failure retain a 14-day grace period, and refunds revoke entitlement access
immediately without forcing the account Credit balance below zero.

---

## 8. Deployment

Default frontend deployment:

```bash
npm run build
npm run deploy
```

Equivalent explicit path:

```bash
npm run build
npm run deploy
```

Convex deploys separately:

```bash
npx convex deploy
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

The Next runtime was removed after route parity and authenticated workflow
verification. New frontend behavior belongs in `src/`.

See `docs/tanstack_migration_backlog.md` for task tracking and
`docs/tanstack_migration_state.md` for ownership rules.
