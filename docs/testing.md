# Integration Testing

NeotypeLab uses two test layers:

- Vitest with `convex-test` for deterministic Convex query, mutation, schema,
  authorization, and ledger behavior.
- Playwright for browser-visible routing, authentication gates, and critical
  product workflows.

Real image generation and R2 delivery are excluded from the default suites.
They belong in a dedicated staging smoke test so routine test runs do not call
paid providers.

## Commands

```bash
npm run test:integration
npm run test:integration:watch
npm run test:e2e:public
npm run test:e2e
```

`npm test` runs the Convex integration suite.

## Convex Integration Tests

Tests are colocated with Convex functions as `convex/*.test.ts`. The Convex
function compiler excludes these files through `convex/tsconfig.json`, while
Vitest runs them in the Edge Runtime environment.

Every test creates an isolated in-memory Convex backend. Seed users must use a
matching database `tokenIdentifier` and test identity so the repository's
custom authenticated function wrappers execute normally.

## Browser Tests

Playwright starts the TanStack frontend on `http://localhost:3100`. The public
project runs without an authenticated account.

Authenticated tests require these environment variables:

```bash
E2E_USER_EMAIL=dedicated-test-user@example.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

`E2E_USER_EMAIL` must identify a dedicated user in the configured Clerk
development instance. Export it in the test shell; Clerk credentials may remain
in `.env.local`, which the Clerk test setup loads automatically. Clerk creates a short-lived testing token and Playwright
stores the resulting browser state under `playwright/.auth/`, which is ignored
by Git.

Do not use a personal or production operator account for browser tests that
modify server state. Add separate pilot and administrator accounts before
introducing parallel multi-role scenarios.

## Current Coverage

The initial suite covers:

- activation-code redemption and ledger consistency
- duplicate redemption and per-user campaign limits
- campaign administration authorization
- concurrent generation limits
- published prompt-template version resolution
- idempotent failed-generation refunds
- optimistic revision conflicts for generation settings
- public discovery rendering
- signed-out create behavior
- legacy terminal redirects
- the application not-found boundary

The next integration batch should cover authenticated create-to-library flow,
publish readiness, administrator settings, and role isolation. Add the real
generation/R2 smoke test after the Cloudflare asset domain is available.
