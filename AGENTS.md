# Repository Guidelines

## Project Structure & Module Organization
This is a TanStack Start project deployed on Cloudflare Workers with a Convex backend. Route files live in `src/routes/`, application components in `src/components/`, shared UI primitives in `components/ui/`, and small utilities in `lib/` via the `@/*` path alias. Backend schema, mutations, queries, and auth setup live in `convex/`; treat `convex/_generated/` and `src/routeTree.gen.ts` as generated code and do not edit them manually. Product and design notes live in `docs/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start TanStack Start and Convex together for local development.
- `npm run predev`: bootstrap Convex until it connects, then open the Convex dashboard.
- `npm run build`: produce the production TanStack Start Worker build.
- `npm run start`: serve the production build locally.
- `npm run lint`: run TypeScript, the TanStack runtime boundary check, and ESLint; use this as the minimum pre-PR check.
- `npx convex run init:init`: seed initial roles and permissions after environment setup.

## Coding Style & Naming Conventions
Use TypeScript and React function components with 2-space indentation, semicolons, and double quotes, matching the existing codebase. Prefer PascalCase for components (`CreateTeamDialog.tsx`), camelCase for helpers, and route-specific logic close to its `src/routes/` segment. Reuse `components/ui/` shadcn primitives instead of duplicating base controls. Keep imports on the `@/` alias when referencing repository code.

## Testing Guidelines
Run `npm run lint` and `npm test` as the baseline, then use `npm run test:e2e:public` for frontend route changes. Authenticated E2E additionally requires the dedicated Clerk test-user variables. Colocate unit and integration tests as `*.test.ts` or `*.test.tsx` beside the feature, and keep browser workflows in `tests/e2e/`.

## Commit & Pull Request Guidelines
Git history is not available in this checkout, so no repository-specific commit convention could be verified. Use short, imperative commit subjects such as `Add team settings member filter`. PRs should include a concise summary, note any schema or env changes, link the related issue, and attach screenshots or screen recordings for UI work.

## Security & Configuration Tips
Keep secrets in `.env.local`, which is gitignored. Current local config relies on Convex and R2-related variables such as `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_END_POINT`, `R2_ACCESS_KEY_ID`, and `R2_PUBLIC_BASE_URL`; immediate CDN removal additionally uses `CLOUDFLARE_CACHE_PURGE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN`. Document any new required keys in `README.md` and this guide when setup changes.
Subscription event ingestion additionally requires `BILLING_WEBHOOK_SECRET` in the Convex environment.
Text/image provider execution in Convex additionally uses `OPEMAI_IMAGE_FOR_LLM_RELAY` (LLMRelay `gpt-image-2` Images API) and `GEMINI_API_KEY_OFFCIAL` (official Gemini text via its OpenAI-compatible endpoint). Preserve these exact key names. Provider profiles must specify a model ID and matching capability; see README.md for request protocol settings.

Creation setup: run `npx convex run creativeSetup:configure '{"textModelId":"gemini-3.5-flash"}' --push` for the verified text/image profiles and `creation.v1` template bindings. Text generation persists validated results in promptCompositions; concepts freeze palettePlanJson/renderSpecificationJson. Keep snapshot usage intact when changing downstream paint-plan consumers.

Library details use private signed downloads. Configure exact frontend CORS origins with `libraryDownloadsNode:configureCors` (GET/HEAD only; local development uses `http://localhost:3001`). Preserve owner-only access in `libraryDetails.get` and do not return private storage keys in detail payloads.
