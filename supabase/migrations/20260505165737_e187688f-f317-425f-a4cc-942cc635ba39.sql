-- Enum para finish e language (compatível com os tipos do front)
DO $$ BEGIN
  CREATE TYPE public.card_finish AS ENUM ('Normal','Foil','Reverse Foil','Pokebola','Energia','Promo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_language AS ENUM ('Português','Inglês','Italiano','Espanhol');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  card_number text NOT NULL,
  collection text NOT NULL,
  language public.card_language NOT NULL,
  finish public.card_finish NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  base_price_cents integer,
  image text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, collection, card_number, finish, language)
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cards"
  ON public.cards FOR SELECT
  USING (true);

CREATE POLICY "Admins insert cards"
  ON public.cards FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update cards"
  ON public.cards FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete cards"
  ON public.cards FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_cards_collection ON public.cards (collection);
CREATE INDEX idx_cards_name ON public.cards (name);