
-- 1) Permitir 'expiration' como motivo no ledger
ALTER TABLE public.loyalty_points_ledger
  DROP CONSTRAINT IF EXISTS loyalty_points_ledger_reason_check;
ALTER TABLE public.loyalty_points_ledger
  ADD CONSTRAINT loyalty_points_ledger_reason_check
  CHECK (reason = ANY (ARRAY[
    'signup','birthday','order_earned','order_redeemed',
    'admin_adjust','refund','expiration'
  ]));

-- 2) Total ganho ao longo da vida (apenas créditos que contam para tier)
CREATE OR REPLACE FUNCTION public.user_lifetime_earned(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::int
  FROM public.loyalty_points_ledger
  WHERE user_id = _user_id
    AND delta > 0
    AND reason IN ('order_earned','signup','birthday');
$$;

-- 3) Tier do usuário (bronze / silver / gold)
CREATE OR REPLACE FUNCTION public.user_tier(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.user_lifetime_earned(_user_id) >= 20000 THEN 'gold'
    WHEN public.user_lifetime_earned(_user_id) >= 5000  THEN 'silver'
    ELSE 'bronze'
  END;
$$;

-- 4) Multiplicador de pontos por tier (basis points para evitar floats)
CREATE OR REPLACE FUNCTION public.user_tier_multiplier_bp(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.user_tier(_user_id)
    WHEN 'gold'   THEN 15000  -- 1.50x
    WHEN 'silver' THEN 12500  -- 1.25x
    ELSE 10000                -- 1.00x
  END;
$$;

-- 5) Job de expiração — pontos vencem 12 meses após ganhos.
-- Lógica FIFO equivalente: para cada usuário, se o total de créditos elegíveis
-- (excl. já-expiração) com mais de 12 meses for maior que o total já debitado,
-- a diferença é o saldo a expirar (limitado ao saldo atual).
CREATE OR REPLACE FUNCTION public.expire_old_loyalty_points()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  to_expire integer;
  inserted_count integer := 0;
BEGIN
  FOR rec IN
    WITH old_credits AS (
      SELECT user_id, COALESCE(SUM(delta),0)::int AS old_pos
      FROM public.loyalty_points_ledger
      WHERE delta > 0
        AND reason IN ('signup','birthday','order_earned','admin_adjust','refund')
        AND created_at < now() - interval '12 months'
      GROUP BY user_id
    ),
    debits AS (
      SELECT user_id, COALESCE(SUM(-delta),0)::int AS total_debit
      FROM public.loyalty_points_ledger
      WHERE delta < 0
      GROUP BY user_id
    ),
    balances AS (
      SELECT user_id, COALESCE(SUM(delta),0)::int AS bal
      FROM public.loyalty_points_ledger
      GROUP BY user_id
    )
    SELECT
      o.user_id,
      LEAST(
        GREATEST(o.old_pos - COALESCE(d.total_debit, 0), 0),
        b.bal
      )::int AS expire_amount
    FROM old_credits o
    JOIN balances b ON b.user_id = o.user_id
    LEFT JOIN debits d ON d.user_id = o.user_id
    WHERE b.bal > 0
  LOOP
    to_expire := rec.expire_amount;
    IF to_expire > 0 THEN
      INSERT INTO public.loyalty_points_ledger(user_id, delta, reason, description)
      VALUES (rec.user_id, -to_expire, 'expiration', 'Pontos expirados (12 meses)');
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  RETURN inserted_count;
END;
$$;
