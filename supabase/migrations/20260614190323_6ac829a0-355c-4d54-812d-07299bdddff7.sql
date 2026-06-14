ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS trainer_subcategory TEXT
  CHECK (trainer_subcategory IS NULL OR trainer_subcategory IN ('Apoiador','Item','Ferramenta Pokémon','Estádio'));

CREATE INDEX IF NOT EXISTS cards_trainer_subcategory_idx ON public.cards (trainer_subcategory) WHERE trainer_subcategory IS NOT NULL;