
CREATE TABLE public.saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mp_customer_id text NOT NULL,
  mp_card_id text NOT NULL,
  last_four text NOT NULL,
  brand text,
  payment_method_id text,
  exp_month int,
  exp_year int,
  cardholder_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mp_card_id)
);

CREATE INDEX saved_cards_user_id_idx ON public.saved_cards(user_id);

GRANT SELECT, DELETE ON public.saved_cards TO authenticated;
GRANT ALL ON public.saved_cards TO service_role;

ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own saved cards" ON public.saved_cards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users delete own saved cards" ON public.saved_cards
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER saved_cards_set_updated_at
  BEFORE UPDATE ON public.saved_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mp_customer_id text;
