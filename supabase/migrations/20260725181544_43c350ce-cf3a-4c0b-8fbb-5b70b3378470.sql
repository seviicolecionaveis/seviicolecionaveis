ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS liga_subcategory text;

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_liga_subcategory_check;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_liga_subcategory_check
  CHECK (
    liga_subcategory IS NULL
    OR liga_subcategory = ANY (ARRAY['Double Rare'::text, 'Foil'::text, 'Normal'::text])
  );