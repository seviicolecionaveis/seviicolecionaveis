ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS button_bg_color text,
  ADD COLUMN IF NOT EXISTS button_text_color text;