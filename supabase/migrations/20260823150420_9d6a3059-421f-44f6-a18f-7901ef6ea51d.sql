CREATE TABLE public.raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  product_type text NOT NULL DEFAULT 'custom',
  product_id text,
  product_name text NOT NULL,
  product_image text,
  product_price_cents integer NOT NULL DEFAULT 0,
  units integer NOT NULL DEFAULT 1 CHECK (units > 0),
  entry_limit_per_user integer NOT NULL DEFAULT 1 CHECK (entry_limit_per_user > 0),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  draw_at timestamptz,
  payment_deadline_hours integer NOT NULL DEFAULT 48 CHECK (payment_deadline_hours > 0),
  rules text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','drawn','payment','finished')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.raffles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raffles TO authenticated;
GRANT ALL ON public.raffles TO service_role;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffles_public_read" ON public.raffles FOR SELECT USING (status <> 'draft');
CREATE POLICY "raffles_admin_all" ON public.raffles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER raffles_updated_at BEFORE UPDATE ON public.raffles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.raffle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entry_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raffle_entries_raffle_idx ON public.raffle_entries(raffle_id);
CREATE INDEX raffle_entries_user_idx ON public.raffle_entries(user_id);
GRANT SELECT ON public.raffle_entries TO authenticated;
GRANT ALL ON public.raffle_entries TO service_role;
ALTER TABLE public.raffle_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_entries_own_read" ON public.raffle_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.raffle_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.raffle_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','expired','cancelled')),
  reserved_until timestamptz,
  order_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, user_id)
);
CREATE INDEX raffle_winners_raffle_idx ON public.raffle_winners(raffle_id);
GRANT SELECT ON public.raffle_winners TO authenticated;
GRANT ALL ON public.raffle_winners TO service_role;
ALTER TABLE public.raffle_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_winners_own_read" ON public.raffle_winners FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER raffle_winners_updated_at BEFORE UPDATE ON public.raffle_winners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.raffle_admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid REFERENCES public.raffles(id) ON DELETE CASCADE,
  admin_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raffle_admin_logs_raffle_idx ON public.raffle_admin_logs(raffle_id);
GRANT SELECT ON public.raffle_admin_logs TO authenticated;
GRANT ALL ON public.raffle_admin_logs TO service_role;
ALTER TABLE public.raffle_admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raffle_logs_admin_read" ON public.raffle_admin_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Participação: valida tudo no banco (status, janela, limite, vencedor prévio)
CREATE OR REPLACE FUNCTION public.raffle_join(_raffle_id uuid)
RETURNS TABLE(entry_id uuid, entry_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.raffles%ROWTYPE;
  uid uuid := auth.uid();
  used integer;
  code text;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_raffle_id::text, 7));
  SELECT * INTO r FROM public.raffles WHERE id = _raffle_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
  IF r.status <> 'open' OR now() < r.opens_at OR now() > r.closes_at THEN
    RAISE EXCEPTION 'raffle_closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.raffle_winners w WHERE w.raffle_id = _raffle_id AND w.user_id = uid) THEN
    RAISE EXCEPTION 'already_winner';
  END IF;
  SELECT count(*) INTO used FROM public.raffle_entries e WHERE e.raffle_id = _raffle_id AND e.user_id = uid;
  IF used >= r.entry_limit_per_user THEN RAISE EXCEPTION 'entry_limit_reached'; END IF;
  LOOP
    code := 'SRT-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.raffle_entries WHERE public.raffle_entries.entry_code = code);
  END LOOP;
  INSERT INTO public.raffle_entries(raffle_id, user_id, entry_code)
  VALUES (_raffle_id, uid, code) RETURNING id INTO new_id;
  RETURN QUERY SELECT new_id, code;
END;
$$;

-- Expira reservas vencidas (libera unidades para novo sorteio)
CREATE OR REPLACE FUNCTION public.raffle_expire_reservations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.raffle_winners
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending_payment' AND reserved_until IS NOT NULL AND reserved_until < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Sorteio atômico no servidor
CREATE OR REPLACE FUNCTION public.raffle_run_draw(_raffle_id uuid, _units integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.raffles%ROWTYPE;
  avail integer;
  picked integer := 0;
  rnd integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_raffle_id::text, 7));
  PERFORM public.raffle_expire_reservations();
  SELECT * INTO r FROM public.raffles WHERE id = _raffle_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'raffle_not_found'; END IF;
  IF r.status NOT IN ('closed','drawn','payment') THEN RAISE EXCEPTION 'entries_still_open'; END IF;

  SELECT r.units - count(*) INTO avail FROM public.raffle_winners w
    WHERE w.raffle_id = _raffle_id AND w.status IN ('pending_payment','paid');
  IF _units IS NOT NULL THEN avail := LEAST(avail, _units); END IF;
  IF avail <= 0 THEN RETURN 0; END IF;

  SELECT COALESCE(MAX(w.round), 0) + 1 INTO rnd FROM public.raffle_winners w WHERE w.raffle_id = _raffle_id;

  INSERT INTO public.raffle_winners(raffle_id, entry_id, user_id, round, status, reserved_until)
  SELECT _raffle_id, e.id, e.user_id, rnd, 'pending_payment', now() + make_interval(hours => r.payment_deadline_hours)
  FROM (
    SELECT DISTINCT ON (en.user_id) en.id, en.user_id
    FROM public.raffle_entries en
    WHERE en.raffle_id = _raffle_id
      AND NOT EXISTS (SELECT 1 FROM public.raffle_winners w2 WHERE w2.raffle_id = _raffle_id AND w2.user_id = en.user_id)
    ORDER BY en.user_id, random()
  ) e
  ORDER BY random()
  LIMIT avail;
  GET DIAGNOSTICS picked = ROW_COUNT;

  UPDATE public.raffles SET status = CASE WHEN picked > 0 THEN 'payment' ELSE 'drawn' END, updated_at = now()
    WHERE id = _raffle_id;

  INSERT INTO public.raffle_admin_logs(raffle_id, admin_id, action, details)
  VALUES (_raffle_id, auth.uid(), 'draw', jsonb_build_object('round', rnd, 'winners', picked, 'requested_units', _units));

  RETURN picked;
END;
$$;

REVOKE ALL ON FUNCTION public.raffle_join(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.raffle_join(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.raffle_run_draw(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.raffle_run_draw(uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.raffle_expire_reservations() FROM public;
GRANT EXECUTE ON FUNCTION public.raffle_expire_reservations() TO service_role;