
CREATE TABLE public.loyalty_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('signup','birthday','order_earned','order_redeemed','admin_adjust','refund')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  year_bucket integer,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX loyalty_ledger_unique_order_reason
  ON public.loyalty_points_ledger(order_id, reason)
  WHERE order_id IS NOT NULL AND reason IN ('order_earned','order_redeemed');

CREATE UNIQUE INDEX loyalty_ledger_unique_birthday_year
  ON public.loyalty_points_ledger(user_id, year_bucket)
  WHERE reason = 'birthday';

CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_points_ledger(user_id, created_at DESC);

GRANT SELECT ON public.loyalty_points_ledger TO authenticated;
GRANT ALL ON public.loyalty_points_ledger TO service_role;

ALTER TABLE public.loyalty_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.loyalty_points_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage ledger" ON public.loyalty_points_ledger
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.user_points_balance(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(delta), 0)::int FROM public.loyalty_points_ledger WHERE user_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.user_points_balance(uuid) TO authenticated, anon;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount_cents integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.award_signup_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.loyalty_points_ledger(user_id, delta, reason, description)
  VALUES (NEW.user_id, 50, 'signup', 'Bônus de boas-vindas');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_signup_points
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.award_signup_points();

INSERT INTO public.loyalty_points_ledger(user_id, delta, reason, description)
SELECT p.user_id, 50, 'signup', 'Bônus de boas-vindas (retroativo)'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.loyalty_points_ledger l
  WHERE l.user_id = p.user_id AND l.reason = 'signup'
);

CREATE OR REPLACE FUNCTION public.award_birthday_points_today()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer := 0; cur_year integer;
BEGIN
  cur_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  WITH ins AS (
    INSERT INTO public.loyalty_points_ledger(user_id, delta, reason, year_bucket, description)
    SELECT p.user_id, 100, 'birthday', cur_year, 'Feliz aniversário! 🎂'
    FROM public.profiles p
    WHERE p.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM p.birth_date)   = EXTRACT(DAY FROM CURRENT_DATE)
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_birthday_points_today() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('loyalty-birthday-points');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'loyalty-birthday-points',
  '0 12 * * *',
  $$ SELECT public.award_birthday_points_today(); $$
);
