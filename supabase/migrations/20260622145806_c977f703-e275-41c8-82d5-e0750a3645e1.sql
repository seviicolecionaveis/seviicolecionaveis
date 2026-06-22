ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS pokemon_type text NULL;
CREATE INDEX IF NOT EXISTS idx_cards_pokemon_type ON public.cards (pokemon_type) WHERE pokemon_type IS NOT NULL;