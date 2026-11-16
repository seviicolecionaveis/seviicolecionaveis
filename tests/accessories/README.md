# Accessory validation
Run SQL fixtures only in a fresh disposable PostgreSQL instance, never in the shared shop backend.
Apply bootstrap.sql, migrations 0041, 0042 and 0043, then scenarios.sql, concurrency.py and claim.sql.
The concurrency script targets only the explicit local socket /tmp/accessory-pg, port 55439.
Coverage: unique slugs/history, simultaneous last-unit reservation/purchase, duplicate decrement/restore, variant restoration, unchanged partial-cancellation stock, transactional order claim rollback, caller permissions, negative quantities and variant stock audit.
Public browser checks use the existing catalog, add only to local cart, and never place orders. Admin browser checks use intercepted fictional accounts/responses and do not validate hosted writes or actual customer email delivery.
