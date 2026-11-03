CREATE TABLE public.public_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  cover_image text,
  short_description text,
  description text,
  event_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  location_name text,
  address text,
  capacity integer,
  registration_status text NOT NULL DEFAULT 'open',
  publication_status text NOT NULL DEFAULT 'draft',
  additional_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_events TO authenticated;
GRANT ALL ON public.public_events TO service_role;

ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published events"
  ON public.public_events FOR SELECT TO anon, authenticated
  USING (publication_status = 'published');

CREATE POLICY "Admins manage events"
  ON public.public_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.public_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'confirmed',
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  cancelled_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_registrations_event_user_key ON public.event_registrations(event_id, user_id);
CREATE INDEX event_registrations_event_status_idx ON public.event_registrations(event_id, status);

GRANT SELECT, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own registrations, admins read all"
  ON public.event_registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete registrations"
  ON public.event_registrations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER public_events_updated_at BEFORE UPDATE ON public.public_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER event_registrations_updated_at BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.register_for_public_event(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.public_events%ROWTYPE;
  _profile public.profiles%ROWTYPE;
  _reg public.event_registrations%ROWTYPE;
  _confirmed integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO _event FROM public.public_events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0404';
  END IF;
  IF _event.publication_status <> 'published' THEN
    RAISE EXCEPTION 'event_not_available' USING ERRCODE = 'P0403';
  END IF;
  IF _event.registration_status <> 'open' THEN
    RAISE EXCEPTION 'registrations_closed' USING ERRCODE = 'P0409';
  END IF;
  IF _event.event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'event_finished' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO _reg FROM public.event_registrations WHERE event_id = _event_id AND user_id = _uid;
  IF FOUND AND _reg.status = 'confirmed' THEN
    RETURN jsonb_build_object('status', 'already_confirmed', 'id', _reg.id);
  END IF;

  SELECT count(*) INTO _confirmed FROM public.event_registrations
    WHERE event_id = _event_id AND status = 'confirmed';
  IF _event.capacity IS NOT NULL AND _confirmed >= _event.capacity THEN
    RAISE EXCEPTION 'event_full' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _uid;

  IF FOUND THEN
    UPDATE public.event_registrations
      SET status = 'confirmed', confirmed_at = now(), cancelled_at = NULL,
          full_name = COALESCE(NULLIF(trim(_profile.full_name), ''), 'Cliente'),
          email = _profile.email, phone = COALESCE(_profile.whatsapp, _profile.phone)
      WHERE id = _reg.id
      RETURNING * INTO _reg;
  ELSE
    INSERT INTO public.event_registrations (event_id, user_id, full_name, email, phone)
      VALUES (
        _event_id, _uid,
        COALESCE(NULLIF(trim(_profile.full_name), ''), 'Cliente'),
        _profile.email,
        COALESCE(_profile.whatsapp, _profile.phone)
      )
      RETURNING * INTO _reg;
  END IF;

  RETURN jsonb_build_object('status', 'confirmed', 'id', _reg.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_public_event_registration(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _event public.public_events%ROWTYPE;
  _reg public.event_registrations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401';
  END IF;

  SELECT * INTO _event FROM public.public_events WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0404';
  END IF;
  IF _event.registration_status <> 'open' OR _event.event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'registrations_closed' USING ERRCODE = 'P0409';
  END IF;

  SELECT * INTO _reg FROM public.event_registrations
    WHERE event_id = _event_id AND user_id = _uid AND status = 'confirmed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0404';
  END IF;

  UPDATE public.event_registrations
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = _reg.id;

  RETURN jsonb_build_object('status', 'cancelled', 'id', _reg.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_event_registration(_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reg public.event_registrations%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0403';
  END IF;

  UPDATE public.event_registrations
    SET checked_in_at = now(), checked_in_by = auth.uid()
    WHERE id = _registration_id AND status = 'confirmed' AND checked_in_at IS NULL
    RETURNING * INTO _reg;

  IF NOT FOUND THEN
    SELECT * INTO _reg FROM public.event_registrations WHERE id = _registration_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_found' USING ERRCODE = 'P0404';
    END IF;
    IF _reg.checked_in_at IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'already_checked_in', 'checked_in_at', _reg.checked_in_at);
    END IF;
    RAISE EXCEPTION 'registration_not_confirmed' USING ERRCODE = 'P0409';
  END IF;

  RETURN jsonb_build_object('status', 'checked_in', 'checked_in_at', _reg.checked_in_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_event_checkin(_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0403';
  END IF;

  UPDATE public.event_registrations
    SET checked_in_at = NULL, checked_in_by = NULL
    WHERE id = _registration_id;

  RETURN jsonb_build_object('status', 'undone');
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_public_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_public_event_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_event_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_event_checkin(uuid) TO authenticated;