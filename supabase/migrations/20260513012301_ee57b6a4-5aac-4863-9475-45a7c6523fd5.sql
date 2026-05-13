
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_reservation_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_card ON public.stock_reservations(card_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires ON public.stock_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON public.stock_reservations(order_id);

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reservations"
  ON public.stock_reservations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all reservations"
  ON public.stock_reservations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- helper: available stock
CREATE OR REPLACE FUNCTION public.available_stock(_card_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE((SELECT stock FROM public.cards WHERE id = _card_id), 0)
    - COALESCE((
        SELECT SUM(quantity)::int
        FROM public.stock_reservations
        WHERE card_id = _card_id AND expires_at > now()
      ), 0)
  );
$$;

-- helper: did user already complete a paid order?
CREATE OR REPLACE FUNCTION public.has_user_purchased(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE user_id = _user_id AND status = 'paid'
  );
$$;
