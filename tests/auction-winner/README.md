# Auction winner reassignment checks

Run only against a disposable local PostgreSQL database, never the shared store database.
The cluster must have `anon`, `authenticated` and `service_role` roles. Create a fresh
database, then run with `psql -v ON_ERROR_STOP=1` in this order:

1. `bootstrap.sql`
2. `../../drizzle/migrations/0050_admin_auction_winner_reassignment.sql`
3. `../../drizzle/migrations/0051_auction_winner_change_variable_scope.sql`
4. `reassignment.sql`

The fixtures are fictitious. Checks cover the previous valid bidder, same-account
and retracted bids, per-item transfer, totals, paid destination isolation, empty
source cancellation, live-admin authorization, initiated payments, stale value,
rollback, internal WhatsApp identifiers, audit and idempotent confirmation.