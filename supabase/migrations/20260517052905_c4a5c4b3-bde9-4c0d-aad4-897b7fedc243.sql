ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS superfrete_service_id text,
  ADD COLUMN IF NOT EXISTS superfrete_service_name text,
  ADD COLUMN IF NOT EXISTS superfrete_order_id text,
  ADD COLUMN IF NOT EXISTS superfrete_label_url text,
  ADD COLUMN IF NOT EXISTS superfrete_status text,
  ADD COLUMN IF NOT EXISTS superfrete_error text;