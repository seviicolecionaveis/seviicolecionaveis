ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS amount_cents integer;
ALTER TABLE public.coupons ALTER COLUMN percent DROP NOT NULL;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_percent_or_amount CHECK (
  (percent IS NOT NULL AND percent BETWEEN 0 AND 100) OR (amount_cents IS NOT NULL AND amount_cents > 0)
);