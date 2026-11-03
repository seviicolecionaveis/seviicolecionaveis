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
  _email text;
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
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  IF FOUND THEN
    UPDATE public.event_registrations
      SET status = 'confirmed', confirmed_at = now(), cancelled_at = NULL,
          full_name = COALESCE(NULLIF(trim(_profile.full_name), ''), 'Cliente'),
          email = _email, phone = COALESCE(_profile.whatsapp, _profile.phone)
      WHERE id = _reg.id
      RETURNING * INTO _reg;
  ELSE
    INSERT INTO public.event_registrations (event_id, user_id, full_name, email, phone)
      VALUES (
        _event_id, _uid,
        COALESCE(NULLIF(trim(_profile.full_name), ''), 'Cliente'),
        _email,
        COALESCE(_profile.whatsapp, _profile.phone)
      )
      RETURNING * INTO _reg;
  END IF;

  RETURN jsonb_build_object('status', 'confirmed', 'id', _reg.id);
END;
$$;