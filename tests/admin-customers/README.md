# Admin customer search tests

Disposable PostgreSQL only — never run against a managed or shared database.

1. Start a fresh PostgreSQL 17 instance.
2. Apply `tests/finance/bootstrap.sql` (provides `auth.uid()`, `app_role`, `user_roles`, `has_role`, stub tables).
3. Run `search.sql` (`psql -v ON_ERROR_STOP=1 -f tests/admin-customers/search.sql`). It stubs `auth.users`, applies migration `0022_admin_customer_search` and checks, inside a rollback transaction, that admins see all customers and search by name/e-mail, while non-admins and unauthenticated sessions get no rows.

Destroy the instance after testing.
