
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS picked_by text,
  ADD COLUMN IF NOT EXISTS picked_at timestamptz;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_picked_by_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_picked_by_check
  CHECK (picked_by IS NULL OR picked_by IN ('Luca', 'Julia'));

DROP POLICY IF EXISTS "Admins update order items" ON public.order_items;
CREATE POLICY "Admins update order items"
  ON public.order_items
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
