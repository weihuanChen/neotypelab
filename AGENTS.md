# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 14 App Router project with a Convex backend. Route files live in `app/`, including the team workspace under `app/t/` and layout experiments under `app/layouts/`. Shared UI primitives are in `components/ui/`, layout helpers in `components/layout/`, and small utilities in `lib/` via the `@/*` path alias. Backend schema, mutations, queries, and auth setup live in `convex/`; treat `convex/_generated/` as generated code and do not edit it manually. Product and design notes live in `docs/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Next.js and Convex together for local development.
- `npm run predev`: bootstrap Convex until it connects, then open the Convex dashboard.
- `npm run build`: produce a production Next.js build.
- `npm run start`: serve the production build locally.
- `npm run lint`: run `tsc` and `next lint`; use this as the minimum pre-PR check.
- `npx convex run init:init`: seed initial roles and permissions after environment setup.

## Coding Style & Naming Conventions
Use TypeScript and React function components with 2-space indentation, semicolons, and double quotes, matching the existing codebase. Prefer PascalCase for components (`CreateTeamDialog.tsx`), camelCase for helpers, and route-specific logic close to its `app/` segment. Reuse `components/ui/` shadcn primitives instead of duplicating base controls. Keep imports on the `@/` alias when referencing repository code.

## Testing Guidelines
There is no committed test runner or `npm test` script yet. For now, contributors should validate changes with `npm run lint` and targeted manual checks in `npm run dev`. If you add tests, colocate them as `*.test.ts` or `*.test.tsx` beside the feature or in a dedicated `tests/` folder, and prefer lightweight component or integration coverage over snapshot-heavy suites.

## Commit & Pull Request Guidelines
Git history is not available in this checkout, so no repository-specific commit convention could be verified. Use short, imperative commit subjects such as `Add team settings member filter`. PRs should include a concise summary, note any schema or env changes, link the related issue, and attach screenshots or screen recordings for UI work.

## Security & Configuration Tips
Keep secrets in `.env.local`, which is gitignored. Current local config relies on Convex and R2-related variables such as `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_END_POINT`, `R2_ACCESS_KEY_ID`, and `R2_PUBLIC_BASE_URL`; immediate CDN removal additionally uses `CLOUDFLARE_CACHE_PURGE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN`. Document any new required keys in `README.md` and this guide when setup changes.
Subscription event ingestion additionally requires `BILLING_WEBHOOK_SECRET` in the Convex environment.
