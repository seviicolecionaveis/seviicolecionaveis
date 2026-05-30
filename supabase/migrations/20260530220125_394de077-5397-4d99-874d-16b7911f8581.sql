ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE INDEX IF NOT EXISTS idx_cards_created_at_desc ON public.cards (created_at DESC);