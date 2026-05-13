-- Card view stats
CREATE TABLE public.card_stats (
  card_key text PRIMARY KEY,
  views integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.card_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read card stats"
ON public.card_stats FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.increment_card_view(_card_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.card_stats (card_key, views, last_viewed_at)
  VALUES (_card_key, 1, now())
  ON CONFLICT (card_key) DO UPDATE
    SET views = card_stats.views + 1,
        last_viewed_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_card_view(text) TO anon, authenticated;

-- Wishlist
CREATE TABLE public.wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_key)
);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wishlist"
ON public.wishlist FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own wishlist"
ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own wishlist"
ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX wishlist_user_id_idx ON public.wishlist(user_id);
CREATE INDEX card_stats_views_idx ON public.card_stats(views DESC);