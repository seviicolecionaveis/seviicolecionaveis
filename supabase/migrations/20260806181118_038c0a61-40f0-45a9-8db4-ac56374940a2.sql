ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS is_promo_code boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_code text;