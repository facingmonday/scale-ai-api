# Organization seat credits

Purchased and promotional seats share the existing organization seat pool.
`addSeats({ organizationId, quantity, source, referenceId, actor })` records a
`SeatCredit` and increments the pool in one MongoDB transaction. The unique
organization/source/reference index makes credits safe to retry. There is no
separate complimentary-seat balance or public grant endpoint.

## Grant promotional seats in Clerk

In the Clerk Dashboard, select the professor's **organization**, edit its
**private metadata**, and merge this object into any existing metadata:

```json
{
  "seatGrant": {
    "id": "fall-2026-promotion",
    "quantity": 50
  }
}
```

The signed `organization.created` or `organization.updated` webhook applies the
credit. Backend organization provisioning and `npm run sync:clerk` also process
these grants. Public metadata and user metadata cannot grant seats.

- `quantity` must be a positive integer JSON number; strings are invalid.
- Reusing the same ID and quantity adds nothing, even on later organization edits.
- To add **20 more** seats, replace the grant with a new ID and quantity `20`.
  The quantity is an addition, not the desired total. Wait for the first grant to
  be credited before replacing it; a sync only sees the currently stored grant.
- Reusing an ID with a different quantity logs `SEAT_CREDIT_CONFLICT` and adds nothing.
- Removing metadata does not revoke credited seats. Grants never expire.
- The grant ID is scoped to the organization, so different professors can share
  a campaign ID. Different IDs delivered out of order each apply once.
- Invalid grants log `INVALID_SEAT_CREDIT`; organization sync still succeeds.
  Database failures fail the webhook so Clerk can retry.

Verify the updated total under **Settings → Billing**. Reservations, enrollment,
and returning seats on student removal use the existing pool. Existing paid
options and classroom limits are unchanged.

Preview a sync without credits, identity writes, collection creation, or indexing:

```bash
npm run sync:clerk -- --dry-run --only-org=org_example
```

## Rollout preflight

MongoDB **6.0 or newer**, configured as a replica set or sharded cluster with
transactions, is required. Local standalone MongoDB is insufficient. Transaction
tests use a one-member in-memory replica set (MongoDB 7.0.14 by default).

Before starting the new API/webhook version or running a non-dry Clerk sync:

1. Stop/drain the old webhook handlers and checkout processing; keep incoming
   webhooks retryable during the cutover. Do not overlap old and new writers.
2. With environment variables pointing at the target database, run:

   ```bash
   npm run audit:seat-credits
   ```

   This read-only audit disables automatic indexing/collection creation, executes
   a read transaction, checks the MongoDB version, and lists duplicate active
   pools, duplicate active email reservations, and unfinished organization purchases.
   A failing preflight exits nonzero. The reservation index now uses MongoDB's
   supported active-status filter in place of the previous unsupported `$ne` filter.
3. Reconcile every reported duplicate pool and ambiguous unfinished purchase
   against existing balances and Stripe payment records. Do not blindly add or
   sum balances. For a purchase already credited by the old code, preserve its
   balance and mark the checkout completed after verification; an unpaid/expired
   checkout needs resolution before proceeding. The audit makes no repairs.
4. Rerun the audit until `ready` is true, then start the new version with automatic
   index creation enabled (the repository default). Confirm creation of
   `unique_active_org_seat_pool` on `seatpools` and
   `unique_organization_seat_credit` on `seatcredits` before sending grants.
   Index conflicts must be resolved; do not drop uniqueness constraints.
5. Grant a small allocation to a test organization, replay the same event, and
   confirm that the total increases only once. Verify enrollment and seat release.

Existing completed Stripe checkout records remain authoritative: replaying them
does not backfill or re-add seats. No historical balance migration is performed.
New credits use the Stripe checkout session ID. If marking checkout completion
fails after a credit commits, a retry finds the credit and only finishes the
checkout record. The audit lists such purchases separately as retryable.

Do not delete credit records or completed checkout records while the organization
exists: they provide permanent replay protection. Watch webhook failures and
`Clerk seat grant skipped` diagnostics after rollout. If rolling back, pause seat
writers first; the old Stripe handler does not understand the credit ledger.
