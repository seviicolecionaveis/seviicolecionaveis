
CREATE TABLE public.card_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('view','cart')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id, source)
);

CREATE INDEX card_interest_card_idx ON public.card_interest(card_id);
CREATE INDEX card_interest_user_idx ON public.card_interest(user_id);
CREATE INDEX card_interest_last_seen_idx ON public.card_interest(last_seen_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_interest TO authenticated;
GRANT ALL ON public.card_interest TO service_role;

ALTER TABLE public.card_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own interest"
  ON public.card_interest FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
