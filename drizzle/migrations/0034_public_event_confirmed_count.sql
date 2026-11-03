CREATE OR REPLACE FUNCTION public.public_event_confirmed_count(_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.event_registrations
  WHERE event_id = _event_id AND status = 'confirmed';
$$;

GRANT EXECUTE ON FUNCTION public.public_event_confirmed_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_event_confirmed_count(uuid) TO authenticated;