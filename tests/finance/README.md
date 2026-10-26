# Disposable PostgreSQL financial tests
Never run these fixtures against a managed, shared or production database.

Start a fresh disposable PostgreSQL 17 instance. Apply `bootstrap.sql`, then migrations 0018, 0019 and 0020 with ON_ERROR_STOP=1. Run `scenarios.sql` (transaction rolls back), `concurrent-setup.sql` (isolated fixture commits), then invoke finance_reserve_payment concurrently for order UUIDs ending 004 and 005, customer UUID ending 004, credit 8000, provider mercadopago and separate operation keys. Exactly one transaction must succeed; balance/reserved must be 10000/8000. Run `terminal.sql` afterward. Destroy the instance after testing.

These tests use fake provider identifiers. They verify accounting, permissions and PostgreSQL locking, not provider approval or customer email delivery.

For order-page item cancellation, run `item-cancellation.sql` after migrations 0018–0020 on a fresh bootstrap. This script adds fixture-only item fields and applies migration 0021 inside a rollback transaction; do not apply 0021 separately first. It checks JWT-derived active-admin access, quantity bounds, same-order membership, idempotent retries, proportional amounts, unchanged remaining order, no money before customer choice, and single completed accounting.
