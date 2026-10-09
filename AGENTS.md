# Repository Guidelines

## Project Structure & Module Organization
This is a TanStack Start project deployed on Cloudflare Workers with a Convex backend. Route files live in `src/routes/`, application components in `src/components/`, shared UI primitives in `components/ui/`, and small utilities in `lib/` via the `@/*` path alias. Backend schema, mutations, queries, and auth setup live in `convex/`; treat `convex/_generated/` and `src/routeTree.gen.ts` as generated code and do not edit them manually. Product and design notes live in `docs/`. For any UI or visual work, `docs/ui-direction.md` (Cool Almanac) is the single authoritative direction document; earlier direction docs have been removed and must not be reintroduced.

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
Creem checkout additionally requires `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_PRO_MONTHLY_PRODUCT_ID`, `CREEM_STUDIO_MONTHLY_PRODUCT_ID`, `CREEM_CREDIT_PACK_64_PRODUCT_ID`, `CREEM_CREDIT_PACK_160_PRODUCT_ID`, `CREEM_CREDIT_PACK_400_PRODUCT_ID`, and `CREEM_CHECKOUT_RETURN_ORIGINS` in the Convex environment. Keep `CREEM_BILLING_ENABLED` unset or `false` until signed Webhook delivery and catalog setup have been verified; only then set it to `true` for that deployment. Set `CREEM_SERVER_URL=https://test-api.creem.io` only on the Test Mode development deployment. Creem posts signed events to `/creem/events`; purchases must start from the authenticated pricing page so checkout metadata contains the Convex user ID.
The Waffo Pancake TypeScript SDK is installed. Outbound API calls require `WAFFO_MERCHANT_ID` and server-only `WAFFO_PRIVATE_KEY`; inbound `/waffo/events` additionally requires `WAFFO_STORE_ID` and `WAFFO_ENVIRONMENT` (`test` or `prod`) in the Convex deployment. The five mapped catalog IDs use `WAFFO_PRO_MONTHLY_PRODUCT_ID`, `WAFFO_STUDIO_MONTHLY_PRODUCT_ID`, `WAFFO_CREDIT_PACK_64_PRODUCT_ID`, `WAFFO_CREDIT_PACK_160_PRODUCT_ID`, and `WAFFO_CREDIT_PACK_400_PRODUCT_ID`. Run `npx convex run waffoCatalog:check` against the intended deployment to verify product type, billing period, price, and unique IDs. Pro-to-Studio changes additionally require `WAFFO_PLAN_GROUP_ID`, created or checked in the sandbox with `waffoCatalog:configureTestPlanGroup` and published to Live with its returned Live group ID. New card and other-method purchases use Waffo; existing Creem subscription upgrades stay on Creem. Authenticated checkout requires `WAFFO_CHECKOUT_RETURN_ORIGINS` and an explicit `WAFFO_CHECKOUT_ENABLED=true`; enable the latter only after signed sandbox purchase and entitlement verification. Checkout passes the Convex user ID as Waffo `buyerIdentity` and metadata. Signed Webhooks verify the user and Waffo order product before issuing subscription entitlements or permanent Credit Pack Credits through the billing ledger; refunds revoke eligible Credits. The SDK includes test/prod Webhook verification public keys, with optional `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` and `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` overrides.
Text/image provider execution in Convex additionally uses `CLOUDFLARE_IMAGE2_SUNBURST_API_KEY` and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare AI Run `openai/gpt-image-2.5-sunburst`, the HD Render primary), `OPENAI_IMAGE_FOR_LLM_RELAY` (LLMRelay `gpt-image-2` Images API), and `GEMINI_API_KEY_OFFCIAL` (official Gemini text via its OpenAI-compatible endpoint). Preserve these exact key names. Provider profiles must specify a model ID and matching capability; see README.md for request protocol settings.
Every text and image provider call is preceded by Waffo prompt safety screening (`convex/contentSafetyNode.ts`, audit rows in `contentSafetyScans`, prompt text never stored). It reuses `WAFFO_MERCHANT_ID` / `WAFFO_PRIVATE_KEY`; `CONTENT_SAFETY_MODE` is `enforce` by default (fail closed), `monitor` (log only), or `off`. A maintained blocklist (`contentBlocklistTerms`, base list in `convex/contentBlocklistPolicy.ts`) runs first; `contentBlocklistPolicy.test.ts` fails if any base term matches the product's own prompt templates or seeds — never add domain words such as weapon, battle damage, blood red, or kit/paint brands. The public model disclosure lives in `src/lib/aiDisclosure.ts` and feeds the AI Acceptable Use Policy (`/acceptable-use`), the Privacy Policy, and in-product notes — update it whenever a provider route changes.

Creation setup: run `npx convex run creativeSetup:configure '{"textModelId":"gemini-3.5-flash"}' --push` for the verified text/image profiles, `creation.v2` text bindings, and `render.v2` HD guardrails. Text generation persists validated results in promptCompositions; concepts freeze visualPaletteJson, paintRecommendationSetsJson, palettePlanJson, and renderSpecificationJson. Keep visual colors separate from catalog paint products when changing downstream consumers.

Library details use private signed downloads. Configure exact frontend CORS origins with `libraryDownloadsNode:configureCors` (GET/HEAD only; local development uses `http://localhost:3001`). Preserve owner-only access in `libraryDetails.get` and do not return private storage keys in detail payloads.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
