
-- 1) Apaga duplicatas mantendo o registro mais antigo por order_item_id
DELETE FROM public.card_stack_items a
USING public.card_stack_items b
WHERE a.order_item_id IS NOT NULL
  AND a.order_item_id = b.order_item_id
  AND a.created_at > b.created_at;

-- Em caso de empate exato no created_at, mantém o menor id
DELETE FROM public.card_stack_items a
USING public.card_stack_items b
WHERE a.order_item_id IS NOT NULL
  AND a.order_item_id = b.order_item_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- 2) Índice único parcial para impedir duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS card_stack_items_order_item_id_uniq
  ON public.card_stack_items(order_item_id)
  WHERE order_item_id IS NOT NULL;
