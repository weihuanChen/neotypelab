# NeotypeLab

NeotypeLab is a TanStack Start frontend deployed on Cloudflare Workers with
Convex as the canonical backend. The app exposes public prototype discovery
routes, OG/social cards, sitemap/robots output, and an authenticated terminal for
create and library workflows.

## Stack

- TanStack Start and TanStack Router in `src/`
- Cloudflare Workers deployment through `wrangler.jsonc`
- Convex queries, mutations, actions, and schema in `convex/`
- Clerk authentication bridged into Convex auth
- Tailwind/shadcn UI primitives shared from `components/`

## Local Development

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill the Convex, Clerk, site URL,
   R2, and generation keys that your environment needs.

3. Start the TanStack frontend and Convex backend together.

   ```bash
   npm run dev
   ```

   `npm run dev` is an alias for the full-stack local workflow:

   ```bash
   npm run dev:full
   ```

   Useful targeted commands:

   ```bash
   npm run dev:frontend # frontend only; admin Convex data will stay pending
   npm run dev:backend
   ```

4. Seed the Convex deployment after first-time setup.

   ```bash
   npx convex run init:init
   ```

## Production Build

The default production path is TanStack Start on Cloudflare Workers.

```bash
npm run build
npm run deploy
```

## Migration Ownership

TanStack Start under `src/` is the only frontend runtime. The former Next App
Router fallback was removed after route parity and authenticated workflow checks
were completed.

See `docs/tanstack_migration_state.md` for the current migration ownership
rules.

## Cloudflare Environment

Set non-secret public values in the build environment. They are embedded into
both browser and Worker bundles, so changing them requires a rebuild:

- `VITE_SITE_URL`
- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

Set secrets in Wrangler or the Cloudflare dashboard:

- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `SUPER_ADMIN_EMAILS`
- `OPENAI_API_KEY`
- R2 credentials used by generation and asset stabilization
- `BILLING_WEBHOOK_SECRET` for normalized subscription event authentication

R2 storage is separated by access boundary in every environment:

- `R2_BUCKET_PUBLIC` stores public showcase and distribution assets.
- `R2_PUBLIC_BASE_URL` is the delivery origin for public object URLs.
- `R2_BUCKET_PRIVATE` stores user library assets.
- private objects are delivered with short-lived S3 presigned URLs; the application
  does not construct private URLs from a public base domain.
- `R2_END_POINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` configure the
  shared S3-compatible connection.

Platform administrators can run a read/write/delete check against both buckets
from the Environment section in Admin Settings. The test objects use the
`_connectivity-tests/` prefix and are removed before the check finishes.

Showcase withdrawal can purge custom-domain cache entries immediately when
`CLOUDFLARE_CACHE_PURGE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN` are set in
the Convex environment. Use a dedicated token with only cache purge access.

Private asset retention is enforced by the Convex lifecycle cron. R2 provides
a delayed fallback only for the `temporary-originals/` prefix; never apply an
expiration rule to `library/` or `pinned-originals/`. Run retention backfills
before enabling lifecycle processing on an existing deployment.

Subscription providers integrate through the Convex HTTP endpoint
`/billing/webhook`. The provider adapter must send the normalized JSON contract
documented in `docs/neotypelab_technical_architecture.md`, plus
`x-neotypelab-timestamp` and `x-neotypelab-signature` headers. The signature is
`v1=` followed by the lowercase HMAC-SHA256 hex digest of
`<timestamp>.<raw-request-body>` using `BILLING_WEBHOOK_SECRET`.

Convex stays deployed separately:

```bash
npx convex deploy
```

## Verification

Before shipping a migration batch, run:

```bash
npm run build
npm run lint
npm run test:integration
npm run test:e2e:public
```

See `docs/testing.md` for the test architecture, authenticated Playwright setup,
and staging smoke-test boundary.

Suggested smoke checks:

- `/`
- `/showcase`
- `/t`
- `/t/create`
- `/t/library`
- `/robots.txt`
- `/sitemap.xml`
