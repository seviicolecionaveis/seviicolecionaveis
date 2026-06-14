ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bundle_discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pix_discount_cents integer NOT NULL DEFAULT 0;