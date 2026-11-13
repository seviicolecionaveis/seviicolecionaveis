DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
CREATE POLICY "app_settings public read" ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('event_mode', 'custom_collections'));