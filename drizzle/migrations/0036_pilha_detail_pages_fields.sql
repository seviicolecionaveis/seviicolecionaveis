ALTER TABLE public.card_stack_items
  ADD COLUMN picked_by text,
  ADD COLUMN picked_at timestamptz;

ALTER TABLE public.service_orders
  ADD COLUMN schedule_kind text,
  ADD COLUMN fee_status text,
  ADD COLUMN edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.card_stack_items.picked_by IS 'Quem separou o item (Luca/Julia), igual aos pedidos';
COMMENT ON COLUMN public.service_orders.schedule_kind IS 'pickup (retirada em mãos) ou delivery (entrega em mãos), quando agendada';
COMMENT ON COLUMN public.service_orders.fee_status IS 'Taxa de entrega em mãos: pending/confirmed (confirmada só por admin)';
COMMENT ON COLUMN public.service_orders.edit_history IS 'Histórico de alterações de envio/retirada feitas pelo admin';