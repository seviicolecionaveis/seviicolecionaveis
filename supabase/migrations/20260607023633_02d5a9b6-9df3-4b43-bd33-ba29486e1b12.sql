DROP POLICY IF EXISTS "Admins manage melhorenvio tokens" ON public.melhorenvio_tokens;
DROP POLICY IF EXISTS "Admins read melhorenvio tokens" ON public.melhorenvio_tokens;
REVOKE ALL ON public.melhorenvio_tokens FROM anon, authenticated;
GRANT ALL ON public.melhorenvio_tokens TO service_role;