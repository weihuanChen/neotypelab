# Preview retry credit repair — 2026-10-08

## Cause and fix

`creationRuns.retry` charged each retry but left `creditTransactionId` pointing
to the initial debit. After the initial refund, another failed attempt reused
that debit and the idempotent ledger correctly skipped another refund of it.
The run nevertheless became `refunded: true`.

Retries now atomically store their own debit ID alongside the new attempt.
No schema or environment changes are required.

Tests cover repeated failures, repeated timeout callbacks, stale callbacks,
one successful final attempt, historical repair and rejected repair inputs.
The repeated-failure test fails against the old logic (balance 12 instead of
20) and passes with the fix. The two creation test fixtures now supply the
current preset style revision required by the existing generation contract.

## Confirmed production incident

Deployment: `resolute-giraffe-272`.
User: `shendongloving123@gmail.com` (`qs7284z7b1nev8c07jtq1h08z18ftv6y`).
Run: `t5793kjhmnj1z7j916gcqxwz2s8ftjsb`.
All timestamps below are Asia/Shanghai.

| Attempt | Started | Outcome | Credits |
| --- | --- | --- | --- |
| 1 | 2026-10-07 21:16:19 | Provider 503 disk overloaded | Debited 8, refunded at 21:16:53 |
| 2 | 2026-10-07 22:08:34 | Storage bucket does not exist | Debited 8, no refund |
| 3 | 2026-10-07 22:13:29 | Succeeded, output at 22:13:59 | Debited 8 |

The read-only production snapshot contained 4 creation runs, all settled.
Matching failed render attempts to chronologically ordered debits found only
the attempt-2 missing refund. The target user's 8 ledger entries reconciled
to balance 38: 70 granted minus 40 debited plus 8 refunded. Three successful
previews cost 24; refunding the missing 8 should leave 46 if no new activity
occurs.

## Production procedure (requires approval before execution)

1. Refresh production creation runs, generation jobs and credit transactions
   using read-only `convex data --deployment resolute-giraffe-272`. Confirm
   no running legacy retries still reference an earlier debit. If any exist,
   wait for settlement and audit their ledger before proceeding.
2. Deploy the tested backend to `resolute-giraffe-272`. Confirm the CLI's
   production target before executing `npx convex deploy`.
3. Run the read-only inspection with this exact JSON:

```json
{
  "userId": "qs7284z7b1nev8c07jtq1h08z18ftv6y",
  "generationJobId": "m97aqy1g48h2sgq7t7cpc75t3h8ftawk",
  "debitTransactionId": "m174eqk4xv56nf6dq5c01q3xgs8fvqs0",
  "expectedAmount": 8
}
```

Function: `creationRuns:inspectHistoricalRefund`.
Expected: run ID above, amount 8, `alreadyRefunded: false`.

4. After approval for the production refund, pass the same JSON to
   `creationRuns:refundHistoricalFailedAttempt`. Use an explicit deployment
   selector and never `--push` with a production run command.
5. Re-read the ledger, account and inspection. Confirm a single refund linked
   through `refundOfTransactionId` to the selected debit, amount 8, and
   `alreadyRefunded: true`. Reconcile the latest account balance with any
   intervening activity rather than forcing it to 46.

Both functions are internal. Repair requires a settled run, a failed retry
render, matching owner/reference/amount and an unambiguous debit sequence.
Ambiguous or oversized histories are refused. Refunds use the existing bucket
ledger and are idempotent by debit ID; successful run and output records stay
intact. The production debit is from permanent Credits.

## Validation

- Old logic: new repeated-failure regression fails with the missing 8 Credits.
- Fixed logic: all 62 test files / 275 tests pass.
- Development deployment `hallowed-raven-873`: `npx convex dev --once` succeeds.
- A pre-existing unnecessary type assertion in `CreatorRankingCard.tsx` was
  removed for the baseline ESLint check; it has no runtime effect.

## Production execution — completed

The user approved production deployment and the 8-Credit refund in this chat.
The pre-deployment refresh again showed all 4 runs settled, no existing refund
of the selected debit, and the target user's balance at 38.

- Production deploy to `resolute-giraffe-272` succeeded, including TypeScript
  and schema validation.
- Pre-refund inspection returned amount 8 and `alreadyRefunded: false`.
- Refund completed at **2026-10-08 10:11:03 Asia/Shanghai**.
- Refund transaction: `m179ev02t18591mcdd2eh9nq218fxjze`.
- Post-refund inspection returned `alreadyRefunded: true`.
- Fresh production data showed exactly one new transaction, delta +8 linked
  to debit `m174eqk4xv56nf6dq5c01q3xgs8fvqs0`.
- Balance and permanent balance are **46**, matching the sum of all ledger
  entries; lifetime spent is **24**, matching the three successful previews.
- Creation run records are unchanged by the refund.
