CREATE TYPE public.card_category AS ENUM ('Pokémon', 'Treinador', 'Energia');

ALTER TABLE public.cards
  ADD COLUMN category public.card_category NOT NULL DEFAULT 'Pokémon';