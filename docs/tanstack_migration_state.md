# TanStack Migration State

Last updated: 2026-06-16

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

## Retained Next Fallback

The `app/` tree is retained as a migration fallback and reference snapshot. It
is not the active production implementation.

P3 decision: keep the fallback available, but isolate it from the TanStack
runtime. Do not delete `app/` or remove Next dependencies until there is an
explicit cleanup task for removing fallback verification entirely.

Fallback ownership rules:

- Do not add new product features only in `app/`.
- If a fallback route receives a useful fix, port the useful behavior into
  `src/` in the same migration batch.
- Do not import Next-specific components or hooks into `src/`.
- Do not import fallback runtime assets from `app/` into the TanStack route
  tree. Shared or still-needed assets should live under `src/` or
  `components/`.
- Treat `build:next` and `start:next` as fallback verification commands, not
  release gates.

The active TanStack root loads global runtime styles from
`src/styles/globals.css` and product/application styles from
`src/styles/app.css`.

## `app/layouts/*`

`app/layouts/*` is a Next-only scaffold/demo area for sticky layout experiments.
It is not product IA, not linked from the TanStack route tree, and is not being
migrated into `src/`.

Decision for P2:

- Keep it out of the TanStack migration scope.
- Do not port these demos unless a future product task explicitly needs one of
  the patterns.
- Deletion or archival belongs to the later fallback-retirement step.

## Current Verification Baseline

Minimum checks for migration batches:

```bash
npx tsc --noEmit
npm run build
```

Use `npm run dev:tanstack` for route smoke checks. The default dev port is
`3001`; Vite may choose another port if it is already in use.
