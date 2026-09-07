# Next Runtime Retirement

TanStack Start is the only application runtime. The Next App Router fallback
was removed on 2026-09-07 after the parity and verification gates passed.

## P1 Runtime Boundary

- `src/` owns TanStack routes, providers, application components, and runtime
  styles.
- `npm run check:tanstack-boundary` fails when `src/` imports `next`, a
  `next/*` module, or `@clerk/nextjs`.
- Public configuration uses `VITE_*` names exclusively.

## Route Parity

| Surface | Next route | TanStack route | P1 decision |
| --- | --- | --- | --- |
| Discovery | `/` | `/` | Migrated |
| Showcase | `/showcase` | `/showcase` | Migrated |
| Showcase archive | Not present | `/showcase/archive` | TanStack-only |
| Create | `/t/create` | `/create` | Migrated; legacy redirect retained |
| Library | `/t/library` | `/library` | Migrated; legacy redirect retained |
| Studio | `/t` | `/studio` | Migrated; legacy redirect retained |
| Feedback | `/t/feedback` | `/feedback` | Migrated; legacy redirect retained |
| Admin | `/t/admin` | `/admin` | Migrated; legacy redirect retained |
| Spec admin | `/spec-admin/*` | `/spec-admin/*` | Migrated, including index redirect |
| Public prototype | `/prototype/[conceptId]` | `/prototype/$conceptId` | Migrated |
| Public pilot | `/pilot/[handle]` | `/pilot/$handle` | Migrated |
| Creator | `/creator/[handle]` | `/creator/$handle` | Migrated |
| Creator pack | `/creator-pack/[slug]` | `/creator-pack/$slug` | Migrated |
| SEO landing | `/[baseModelSlug]/[stylePresetSlug]` | `/$baseModelSlug/$stylePresetSlug` | Migrated |
| Share images | Dynamic Next image routes | Matching TanStack resource routes | Migrated |
| Crawler metadata | `/robots.txt`, `/sitemap.xml` | Matching TanStack resource routes | Migrated |
| Layout experiments | `/layouts/*` | Not migrated | Development-only; remove with Next |

## Completed Exit Gate

- Authenticated browser coverage passes for Studio, Library, Create, and Admin
  authorization.
- Public browser coverage includes primary routes, legacy redirects, and the
  application not-found boundary.
- Dynamic share-image and crawler routes are owned by TanStack resource routes.
- Next source, configuration, scripts, dependencies, and environment fallbacks
  are removed.
