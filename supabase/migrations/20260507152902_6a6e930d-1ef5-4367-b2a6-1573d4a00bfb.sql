
-- Create condition enum
CREATE TYPE public.card_condition AS ENUM ('M', 'NM', 'SP', 'MP', 'HP', 'D');

-- Add condition column to cards (default NM for existing rows)
ALTER TABLE public.cards
  ADD COLUMN condition public.card_condition NOT NULL DEFAULT 'NM';

-- Replace unique constraint to include condition
ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_name_collection_card_number_finish_language_key;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_name_collection_card_number_finish_language_condition_key
  UNIQUE (name, collection, card_number, finish, language, condition);
