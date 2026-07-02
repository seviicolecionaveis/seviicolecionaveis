
ALTER TABLE public.card_price_watch
  ADD COLUMN IF NOT EXISTS previous_min_price_cents integer,
  ADD COLUMN IF NOT EXISTS price_dropped_at timestamptz;

-- Allow anonymous read for public price-drop badges (no PII in this table)
GRANT SELECT ON public.card_price_watch TO anon;
GRANT SELECT ON public.card_price_watch TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='card_price_watch' AND policyname='Public can read price watch'
  ) THEN
    CREATE POLICY "Public can read price watch"
      ON public.card_price_watch FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
