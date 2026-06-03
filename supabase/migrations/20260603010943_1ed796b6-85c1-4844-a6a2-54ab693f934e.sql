
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cancelled_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_method text,
  ADD COLUMN IF NOT EXISTS refund_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_coupon_code text,
  ADD COLUMN IF NOT EXISTS refund_notes text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0;
