ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS icon_bg_color text,
  ADD COLUMN IF NOT EXISTS icon_color text,
  ADD COLUMN IF NOT EXISTS promo_bg_color text,
  ADD COLUMN IF NOT EXISTS promo_text_color text;