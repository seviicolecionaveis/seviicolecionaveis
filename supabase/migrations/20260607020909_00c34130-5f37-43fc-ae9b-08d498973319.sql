ALTER TABLE public.card_stack_items
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS auction_name TEXT,
  ADD COLUMN IF NOT EXISTS auction_date DATE;