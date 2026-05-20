CREATE TABLE IF NOT EXISTS public.card_price_watch (
  card_id uuid PRIMARY KEY,
  last_min_price_cents integer NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.card_price_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view price watch"
ON public.card_price_watch
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));