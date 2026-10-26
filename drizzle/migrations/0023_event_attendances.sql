CREATE TABLE public.event_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text,
  email text,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, DELETE ON public.event_attendances TO authenticated;
GRANT ALL ON public.event_attendances TO service_role;
ALTER TABLE public.event_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own attendance" ON public.event_attendances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read attendances" ON public.event_attendances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners cancel own attendance" ON public.event_attendances FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.confirm_event_presence(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _p record; _email text; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Faça login para confirmar presença'; END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = _event_id AND active AND end_date >= (now() AT TIME ZONE 'America/Fortaleza')::date) THEN
    RAISE EXCEPTION 'Evento indisponível';
  END IF;
  SELECT full_name, whatsapp, phone INTO _p FROM profiles WHERE user_id = _uid LIMIT 1;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  INSERT INTO event_attendances(event_id, user_id, full_name, email, whatsapp)
  VALUES (_event_id, _uid, _p.full_name, _email, coalesce(_p.whatsapp, _p.phone))
  ON CONFLICT (event_id, user_id) DO NOTHING RETURNING id INTO _id;
  RETURN jsonb_build_object('ok', true, 'already', _id IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.confirm_event_presence(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_event_presence(uuid) TO authenticated;