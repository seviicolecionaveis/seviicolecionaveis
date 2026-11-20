CREATE TABLE public.hub_group_progress (
  group_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  schedule_state text NOT NULL DEFAULT 'pending' CHECK (schedule_state IN ('pending','scheduled','rescheduled','cancelled','completed')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hub_order_progress (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.hub_group_progress(group_id) ON DELETE CASCADE,
  operational_status text NOT NULL DEFAULT 'pending',
  tracking_code text,
  separated_at timestamptz,
  received_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hub_order_progress_group_idx ON public.hub_order_progress(group_id);
CREATE TABLE public.hub_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.hub_group_progress(group_id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reference text NOT NULL UNIQUE,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  mercadopago_id text UNIQUE,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, attempt_number)
);
CREATE TABLE public.hub_group_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hub_group_audit_group_idx ON public.hub_group_audit(group_id, created_at);
GRANT SELECT ON public.hub_group_progress, public.hub_order_progress, public.hub_fee_payments, public.hub_group_audit TO authenticated;
GRANT ALL ON public.hub_group_progress, public.hub_order_progress, public.hub_fee_payments, public.hub_group_audit TO service_role;
ALTER TABLE public.hub_group_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_order_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_group_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin reads group progress" ON public.hub_group_progress FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin reads order progress" ON public.hub_order_progress FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.hub_group_progress g WHERE g.group_id = hub_order_progress.group_id AND g.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin reads fee payments" ON public.hub_fee_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.hub_group_progress g WHERE g.group_id = hub_fee_payments.group_id AND g.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin reads audit" ON public.hub_group_audit FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.hub_group_progress g WHERE g.group_id = hub_group_audit.group_id AND g.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.hub_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Histórico do grupo não pode ser alterado'; END $$;
CREATE TRIGGER hub_group_audit_immutable BEFORE UPDATE OR DELETE ON public.hub_group_audit FOR EACH ROW EXECUTE FUNCTION public.hub_audit_immutable();