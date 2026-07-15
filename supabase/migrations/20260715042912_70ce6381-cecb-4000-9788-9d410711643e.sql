-- Feature 4: Public price history
-- 1. History table for base price changes
CREATE TABLE public.card_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  price_cents integer NOT NULL,
  source text NOT NULL DEFAULT 'base', -- 'base' | 'liga'
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_price_history_card_time ON public.card_price_history(card_id, recorded_at DESC);

GRANT SELECT ON public.card_price_history TO anon;
GRANT SELECT ON public.card_price_history TO authenticated;
GRANT ALL ON public.card_price_history TO service_role;

ALTER TABLE public.card_price_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read history (public data — non-sensitive)
CREATE POLICY "Public read price history"
  ON public.card_price_history FOR SELECT
  USING (true);

-- 2. Trigger: append to history whenever base_price_cents changes
CREATE OR REPLACE FUNCTION public.log_card_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.base_price_cents IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.base_price_cents IS DISTINCT FROM NEW.base_price_cents) THEN
    INSERT INTO public.card_price_history (card_id, price_cents, source)
    VALUES (NEW.id, NEW.base_price_cents, 'base');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_card_price_change
  AFTER INSERT OR UPDATE OF base_price_cents ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.log_card_price_change();

-- 3. Backfill: one initial snapshot per card with a current base_price_cents
INSERT INTO public.card_price_history (card_id, price_cents, source, recorded_at)
SELECT id, base_price_cents, 'base', COALESCE(updated_at, now())
FROM public.cards
WHERE base_price_cents IS NOT NULL;