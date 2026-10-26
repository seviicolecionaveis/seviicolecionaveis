-- Admin customer search gating test (disposable PostgreSQL).
-- Apply bootstrap.sql from tests/finance first (provides auth.uid(), has_role, app_role, user_roles).
-- Then run this script: it creates fixture tables, applies migration 0022, and checks access in a rollback transaction.

BEGIN;

-- profiles/orders already exist from tests/finance/bootstrap.sql; extend with the columns this test needs.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text, ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS whatsapp text, ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT authenticated, service_role TO CURRENT_USER;

-- fixture customers
INSERT INTO public.profiles (user_id, full_name, cpf) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Camilla Teste', '11122233344'),
  ('22222222-2222-2222-2222-222222222222', 'Outro Cliente', '55566677788');
INSERT INTO public.orders (id, user_id, email) VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'outro@exemplo.com');

-- admin customer
INSERT INTO public.user_roles (user_id, role) VALUES ('11111111-1111-1111-1111-111111111111', 'admin');

\i drizzle/migrations/0022_admin_customer_search.sql

-- 1. admin sees all customers (no search filter)
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT CASE WHEN (SELECT count(*) FROM public.admin_search_customers('', 50, 0)) = 2
  THEN 'PASS admin sees all customers' ELSE 'FAIL admin sees all customers' END;

-- 2. admin search by profile name
SELECT CASE WHEN (SELECT count(*) FROM public.admin_search_customers('Camilla', 50, 0)) = 1
  THEN 'PASS search by name' ELSE 'FAIL search by name' END;

-- 3. admin search by email via orders
SELECT CASE WHEN (SELECT count(*) FROM public.admin_search_customers('outro@exemplo.com', 50, 0)) = 1
  THEN 'PASS search by email' ELSE 'FAIL search by email' END;

-- 4. non-admin gets no rows
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT CASE WHEN (SELECT count(*) FROM public.admin_search_customers('', 50, 0)) = 0
  THEN 'PASS non-admin gets no rows' ELSE 'FAIL non-admin gets no rows' END;

-- 5. unauthenticated (anon JWT-less session) gets no rows
RESET request.jwt.claim.sub;
SELECT CASE WHEN (SELECT count(*) FROM public.admin_search_customers('', 50, 0)) = 0
  THEN 'PASS unauthenticated gets no rows' ELSE 'FAIL unauthenticated gets no rows' END;

ROLLBACK;
