-- Arte em Cards weekly pickup codes
CREATE TABLE public.arte_em_cards_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX arte_em_cards_codes_user_cycle_uk
  ON public.arte_em_cards_codes (user_id, cycle_start);
CREATE INDEX arte_em_cards_codes_user_end_idx
  ON public.arte_em_cards_codes (user_id, cycle_end);

GRANT SELECT ON public.arte_em_cards_codes TO authenticated;
GRANT ALL ON public.arte_em_cards_codes TO service_role;

ALTER TABLE public.arte_em_cards_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own arte em cards codes"
  ON public.arte_em_cards_codes FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER arte_em_cards_codes_updated_at
  BEFORE UPDATE ON public.arte_em_cards_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Track which code (if any) was used in an order to waive the fee
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS arte_em_cards_code text;