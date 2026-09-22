# Pricing and Credit Policy

This document is the implementation-facing source of truth for the MVP pricing
page. It separates committed product terms from policies that remain under
evaluation.

## MVP plans

| Plan | Price | Credits | Complete builds | Workspace | Original retention |
|---|---:|---:|---:|---:|---:|
| Free | $0 | 20 once | 2, with 4 Credits remaining | 500 MB | 7 days |
| Pro | $19.90 / month | 160 / month | 20 | 10 GB | 30 days |
| Studio | $29.90 / month | 320 / month | 40 | 30 GB | 90 days |

A complete build currently costs 8 Credits: Color Plan 1, Repaint
Specification 2 and HD Render 5. Custom Style interpretation costs 1 Credit and
is available on every plan. Spray Plan generation is included and does not have
a separate Credit debit.

Concurrency is deliberately absent from commercial plan copy. The current
complete-build workflow permits one active preview per owner. Plan-specific
concurrency may be evaluated after real workload and provider-capacity data is
available.

The matching storage and retention baselines are published as entitlement
profile revision 2 (`free-mvp-v2`, `pro-mvp-v2` and `studio-mvp-v2`). Run
`npx convex run init:seedEntitlementProfiles` after deploying the backend to add
them idempotently. Older profile revisions remain available for audit history.

## Credit packs

| Pack | Price | Equivalent complete builds |
|---|---:|---:|
| 64 Credits | $9 | 8 |
| 160 Credits | $19 | 20 |
| 400 Credits | $39 | 50 |

Credit Packs are planned for active subscribers. Separately purchased Credits
do not expire. Checkout and pack fulfillment are not active yet, so the public
page presents these as announced terms rather than functioning purchase actions.

## Monthly rollover: evaluated, not committed

The current implementation keeps one aggregate balance in `creditAccounts`.
Subscription grants, purchased Credits, campaign rewards and refunds all change
that same balance. A capped monthly rollover cannot be implemented safely by
simply reducing the aggregate balance at renewal because purchased Credits must
remain permanent and generation refunds must return value to the source that was
spent.

The recommended MVP implementation is a two-bucket account:

- `subscriptionBalance` contains monthly and rolled subscription Credits;
- `permanentBalance` contains purchased and grandfathered Credits;
- spending consumes subscription Credits first, then permanent Credits;
- every debit records the split between both buckets so refunds are exact;
- renewal retains subscription Credits only up to the configured plan cap, then
  adds the new monthly grant;
- cancellation expires the subscription bucket at the end of paid access while
  preserving the permanent bucket.

A reasonable initial cap is 50% of the monthly grant: 80 Credits for Pro and 160
Credits for Studio. Immediately after renewal, the maximum subscription balance
would therefore be 240 for Pro and 480 for Studio. This cap is a recommendation,
not yet a public promise.

Implementation complexity is medium-high because debit and refund logic is
currently distributed across complete builds, individual generation stages,
Custom Style interpretation, Keep Original and administrative adjustments. The
work should be delivered as a separate billing iteration:

1. Centralize all Credit debit and refund operations behind one transactional
   helper.
2. Add optional subscription and permanent bucket fields, plus per-transaction
   allocation metadata.
3. Migrate existing aggregate balances into the permanent bucket so no existing
   user loses Credits.
4. Add idempotent renewal, cancellation, upgrade, downgrade and refund handling.
5. Add reconciliation checks and tests for period boundaries, mixed balances,
   retries and duplicate webhooks.

Do not advertise a numeric rollover cap until this iteration is implemented and
the billing provider's renewal and refund behavior has been tested end to end.
