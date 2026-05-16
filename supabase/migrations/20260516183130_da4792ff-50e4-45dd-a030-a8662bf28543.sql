
-- Stock alerts: subscribers to be notified when a card key (name/collection/number) is back in stock
CREATE TABLE public.stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_key text NOT NULL,
  card_name text NOT NULL,
  card_collection text NOT NULL,
  card_number text NOT NULL,
  email text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (card_key, email)
);

CREATE INDEX idx_stock_alerts_card_key ON public.stock_alerts(card_key) WHERE notified_at IS NULL;

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone (logged-in or not) can subscribe via the server function (which uses service role).
-- For client-side inserts we still allow public insert with simple validation in the server fn.
CREATE POLICY "Anyone can subscribe to stock alerts"
ON public.stock_alerts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users view own alerts"
ON public.stock_alerts FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own alerts"
ON public.stock_alerts FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update alerts"
ON public.stock_alerts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
