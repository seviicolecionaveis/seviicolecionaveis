
CREATE TABLE public.decks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  format text,
  is_public boolean NOT NULL DEFAULT false,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decks_user ON public.decks(user_id);
CREATE INDEX idx_decks_share_token ON public.decks(share_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;
GRANT SELECT ON public.decks TO anon;
GRANT ALL ON public.decks TO service_role;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own decks" ON public.decks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public decks readable" ON public.decks
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

CREATE TABLE public.deck_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 60),
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deck_id, card_id)
);

CREATE INDEX idx_deck_cards_deck ON public.deck_cards(deck_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_cards TO authenticated;
GRANT SELECT ON public.deck_cards TO anon;
GRANT ALL ON public.deck_cards TO service_role;

ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own deck cards" ON public.deck_cards
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = auth.uid()));

CREATE POLICY "Public deck cards readable" ON public.deck_cards
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.is_public = true));

CREATE TRIGGER trg_decks_updated
  BEFORE UPDATE ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
