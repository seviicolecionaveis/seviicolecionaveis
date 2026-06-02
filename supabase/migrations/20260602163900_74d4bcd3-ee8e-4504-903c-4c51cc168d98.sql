
-- Pilha de Cartas
CREATE TABLE public.card_stacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active | closed | expired
  reminder_7d_sent_at timestamptz,
  reminder_48h_sent_at timestamptz,
  reminder_24h_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_stack_per_user ON public.card_stacks(user_id) WHERE status = 'active';
CREATE INDEX card_stacks_user_idx ON public.card_stacks(user_id);
CREATE INDEX card_stacks_status_expires_idx ON public.card_stacks(status, expires_at);

GRANT SELECT ON public.card_stacks TO authenticated;
GRANT ALL ON public.card_stacks TO service_role;
ALTER TABLE public.card_stacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own stacks" ON public.card_stacks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Itens da pilha
CREATE TABLE public.card_stack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack_id uuid NOT NULL REFERENCES public.card_stacks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid,
  card_id text NOT NULL,
  card_name text NOT NULL,
  card_image text,
  collection text,
  card_number text,
  finish text,
  language text,
  condition text,
  quantity integer NOT NULL,
  unit_price_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'stored', -- stored | requested | dispatched | cancelled
  service_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_stack_items_stack_idx ON public.card_stack_items(stack_id);
CREATE INDEX card_stack_items_user_idx ON public.card_stack_items(user_id);
CREATE INDEX card_stack_items_status_idx ON public.card_stack_items(status);
CREATE INDEX card_stack_items_order_idx ON public.card_stack_items(order_id);

GRANT SELECT ON public.card_stack_items TO authenticated;
GRANT ALL ON public.card_stack_items TO service_role;
ALTER TABLE public.card_stack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own stack items" ON public.card_stack_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Ordens de Serviço (solicitação de envio/retirada da pilha)
CREATE SEQUENCE IF NOT EXISTS public.service_orders_code_seq START 1000;

CREATE TABLE public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code integer NOT NULL DEFAULT nextval('public.service_orders_code_seq') UNIQUE,
  user_id uuid NOT NULL,
  stack_id uuid NOT NULL REFERENCES public.card_stacks(id) ON DELETE RESTRICT,
  method text NOT NULL, -- correios | app | arte_em_cards
  status text NOT NULL DEFAULT 'awaiting_payment',
  -- awaiting_payment | paid | picking | ready | shipped | delivered | cancelled
  amount_cents integer NOT NULL DEFAULT 0,
  shipping_cost_cents integer NOT NULL DEFAULT 0,
  payment_order_id uuid, -- referencia orders.id quando há pagamento
  recipient_name text,
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  phone text,
  notes text,
  arte_em_cards_code text,
  tracking_code text,
  tracking_url text,
  carrier text,
  whatsapp_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_orders_user_idx ON public.service_orders(user_id);
CREATE INDEX service_orders_stack_idx ON public.service_orders(stack_id);
CREATE INDEX service_orders_status_idx ON public.service_orders(status);

GRANT SELECT ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own service orders" ON public.service_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update service orders" ON public.service_orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FK do item para a ordem de serviço (após criar a tabela)
ALTER TABLE public.card_stack_items
  ADD CONSTRAINT card_stack_items_service_order_fk
  FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE SET NULL;

-- Trigger genérico para updated_at
CREATE TRIGGER trg_card_stacks_updated BEFORE UPDATE ON public.card_stacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_card_stack_items_updated BEFORE UPDATE ON public.card_stack_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_service_orders_updated BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
