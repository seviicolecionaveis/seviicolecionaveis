
-- Backfill loyalty points for past paid/preparing/delivered orders.
-- Idempotent: skips orders that already have an 'order_earned' ledger entry.
-- Excludes cancelled orders entirely; subtracts cancelled item quantities.

CREATE OR REPLACE FUNCTION public.backfill_loyalty_points_for_orders()
RETURNS TABLE(orders_processed integer, points_credited integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  effective_subtotal integer;
  base_after_discount integer;
  pts integer;
  total_orders integer := 0;
  total_pts integer := 0;
BEGIN
  FOR rec IN
    SELECT o.id, o.user_id, o.discount_cents, o.points_discount_cents
    FROM public.orders o
    WHERE o.status IN ('paid','preparing','delivered')
      AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_points_ledger l
        WHERE l.order_id = o.id AND l.reason = 'order_earned'
      )
    ORDER BY o.created_at ASC
  LOOP
    SELECT COALESCE(SUM(GREATEST(quantity - cancelled_quantity, 0) * unit_price_cents), 0)::int
      INTO effective_subtotal
      FROM public.order_items
      WHERE order_id = rec.id;

    base_after_discount := GREATEST(
      0,
      effective_subtotal - COALESCE(rec.discount_cents,0) - COALESCE(rec.points_discount_cents,0)
    );

    -- 10 pts por real (base, sem multiplicador de tier — backfill conservador)
    pts := FLOOR(base_after_discount / 10.0)::int;

    IF pts > 0 THEN
      INSERT INTO public.loyalty_points_ledger(user_id, delta, reason, order_id, description, metadata)
      VALUES (
        rec.user_id, pts, 'order_earned', rec.id,
        'Pontos retroativos do pedido',
        jsonb_build_object('backfill', true, 'base_cents', base_after_discount)
      );

      UPDATE public.orders SET points_earned = pts WHERE id = rec.id;

      total_pts := total_pts + pts;
    END IF;

    total_orders := total_orders + 1;
  END LOOP;

  RETURN QUERY SELECT total_orders, total_pts;
END;
$$;
