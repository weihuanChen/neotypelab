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
- Legacy Next App Router files retained in `app/` during migration fallback

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

   Useful targeted commands:

   ```bash
   npm run dev:tanstack
   npm run dev:backend
   npm run dev:next
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

Equivalent explicit commands are:

```bash
npm run build:tanstack
npm run deploy:tanstack
```

The retained Next build is available only as a migration fallback:

```bash
npm run build:next
npm run start:next
```

## Cloudflare Environment

Set non-secret public values for both the build environment and Worker runtime:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Set secrets in Wrangler or the Cloudflare dashboard:

- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `SUPER_ADMIN_EMAILS`
- `OPENAI_API_KEY`
- R2 credentials used by generation and asset stabilization

Convex stays deployed separately:

```bash
npx convex deploy
```

## Verification

Before shipping a migration batch, run:

```bash
npm run build
npm run lint
```

Suggested smoke checks:

- `/`
- `/showcase`
- `/t`
- `/t/create`
- `/t/library`
- `/robots.txt`
- `/sitemap.xml`
