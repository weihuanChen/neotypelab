# Waffo Live rollout — 2026-10-09

Production Convex: `resolute-giraffe-272`. Frontend: https://neotypelab.com.
Waffo store: `STO_26rpXBgZtML8QcCx0M8P2T`.

Sandbox products were published to Live using the Waffo SDK. Product IDs are
preserved; prices, active status, SaaS tax category and monthly billing match the
sandbox catalog.

| Offer | USD price | Live product ID |
| --- | --- | --- |
| Pro | $19.90/month | `PROD_6Tejg1ayTo8rhrliZ2R2no` |
| Studio | $29.90/month | `PROD_6NaeY0XA34oV1bqTAMCe7G` |
| 64 Credits | $9.00 | `PROD_20ueVpDUHFHmnGARQ6Rdmi` |
| 160 Credits | $19.00 | `PROD_3CS3r5aV1ViW8udXXnO7Wa` |
| 400 Credits | $39.00 | `PROD_7hJCWaEw55si0BPcuceXxk` |

Live plan group: `a39f7f80-835c-46f3-a333-1a65144fddd1`.
Sandbox group: `0eb5f3fa-2bc2-41df-972a-1c3efacb7daa`.
Both contain only Pro and Studio, with shared trials and customer self-service
plan changes disabled. Application-issued Pro-to-Studio upgrades remain enabled.

Live HTTP Webhook: `cc6e08f1-1198-4e21-8db2-cf3af3ca305f`,
https://resolute-giraffe-272.convex.site/waffo/events, `testMode: false`.
Its 14 subscribed events match the sandbox endpoint.

Production uses `WAFFO_ENVIRONMENT=prod`, `WAFFO_CHECKOUT_ENABLED=true`,
`WAFFO_CHECKOUT_RETURN_ORIGINS=https://neotypelab.com`, the store and product IDs
above, and the Live plan group ID. Existing production merchant credentials were
reused without printing or copying their secrets to files. Development keeps its
Test Mode configuration.

New subscriptions and Credit Packs use Waffo for both card and other payment
methods. Existing Creem subscription upgrades remain on Creem to preserve the
existing recurring subscription.

## Verification

- Production `waffoConnectivity:check`: `ok: true`, `storeCount: 1`.
- Production `waffoCatalog:check`: `configured: true`, all five products valid,
  no issues.
- Production plan group query matches both subscription product IDs.
- Waffo store reports `prodEnabled`, `payinEnable`, and `isLive` all true.
- The production Webhook returns HTTP 401 for an unsigned request.
- Production and development Convex code deployed successfully.
- Cloudflare Worker version: `e9526756-ab75-47c5-b239-11c969ae5acb`.
- Production checkout UI loads with card selected and both methods enabled.
- `npm run lint`: passed, with 124 existing warnings and no errors.
- `npm test`: 69 files and 318 tests passed, including production checkout routing.
- `npm run build`: passed.
- Public E2E: pricing and checkout passed; full run had 11 passes and four failures
  from older discovery/showcase/create title or heading expectations.

No real purchase or refund was made. API connectivity, configuration and endpoint
validation do not establish delivery of a real signed Live payment or settlement.
