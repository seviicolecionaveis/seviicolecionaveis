-- Adiciona flag para rastrear se o estoque foi decrementado, para restaurá-lo
-- de forma confiável em qualquer cancelamento, independente do status atual.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_decremented boolean NOT NULL DEFAULT false;

-- Backfill: pedidos que já passaram por status pós-pagamento tiveram estoque decrementado.
UPDATE public.orders
   SET stock_decremented = true
 WHERE status IN ('paid','preparing','shipped','awaiting_pickup','delivered');
