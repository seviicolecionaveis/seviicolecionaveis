ALTER TABLE public.site_popups
  ADD COLUMN IF NOT EXISTS icon_key text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS button_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS button_label text,
  ADD COLUMN IF NOT EXISTS button_action text NOT NULL DEFAULT 'close',
  ADD COLUMN IF NOT EXISTS button_target text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;