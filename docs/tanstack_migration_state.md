# TanStack Migration State

Last updated: 2026-09-07

TanStack Start under `src/` is the canonical frontend implementation for
NeotypeLab. Cloudflare Workers is the default production deployment path, with
Convex as the canonical backend.

## Canonical Ownership

- Public routes live in `src/routes` and shared public UI lives in
  `src/components/public`, `src/components/prototype`,
  `src/components/pilot`, and `src/components/showcase`.
- Authenticated terminal routes live in `src/routes/t*.tsx`, with shared
  terminal chrome in `src/components/terminal`.
- Convex schema, queries, mutations, actions, and auth setup remain in
  `convex/`.
- Shared low-level UI primitives remain in `components/ui`.

## Runtime Retirement

The Next App Router fallback, middleware, configuration, scripts, and
dependencies were removed on 2026-09-07 after route parity, production builds,
and authenticated Clerk-to-Convex E2E coverage passed. `src/` is the only
frontend runtime boundary.

The active TanStack root loads global runtime styles from
`src/styles/globals.css` and product/application styles from
`src/styles/app.css`.

## Current Verification Baseline

Minimum checks for migration batches:

```bash
npm run lint
npm test
npm run build
```

Use `npm run dev:frontend` for route smoke checks. The default dev port is
`3001`; Vite may choose another port if it is already in use.
