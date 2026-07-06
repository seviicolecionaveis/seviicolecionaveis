DROP POLICY IF EXISTS "Public can read price watch" ON public.card_price_watch;
REVOKE SELECT ON public.card_price_watch FROM anon;
CREATE POLICY "Authenticated can read price watch" ON public.card_price_watch FOR SELECT TO authenticated USING (true);