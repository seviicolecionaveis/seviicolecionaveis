-- Auto-cancela pedidos não pagos após 30 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job antigo se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-cancel-unpaid-orders');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-unpaid-orders',
  '*/2 * * * *', -- a cada 2 minutos
  $$
  WITH expired AS (
    UPDATE public.orders
    SET status = 'cancelled',
        pre_cancel_status = status,
        updated_at = now()
    WHERE status = 'pending'
      AND created_at < now() - interval '30 minutes'
    RETURNING id
  )
  DELETE FROM public.stock_reservations
  WHERE order_id IN (SELECT id FROM expired);
  $$
);