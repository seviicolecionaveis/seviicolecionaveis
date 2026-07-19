
CREATE TABLE public.card_stock_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID,
  card_name TEXT NOT NULL,
  collection TEXT NOT NULL,
  card_number TEXT NOT NULL,
  finish TEXT,
  language TEXT,
  condition TEXT,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX card_stock_changes_changed_at_idx ON public.card_stock_changes (changed_at DESC);
CREATE INDEX card_stock_changes_card_idx ON public.card_stock_changes (card_name, collection, card_number);

GRANT SELECT ON public.card_stock_changes TO authenticated;
GRANT ALL ON public.card_stock_changes TO service_role;

ALTER TABLE public.card_stock_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stock changes"
  ON public.card_stock_changes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_card_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev INTEGER;
  curr INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    prev := 0;
    curr := COALESCE(NEW.stock, 0);
    IF curr = 0 THEN RETURN NEW; END IF;
  ELSE
    prev := COALESCE(OLD.stock, 0);
    curr := COALESCE(NEW.stock, 0);
    IF prev = curr THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.card_stock_changes (
    card_id, card_name, collection, card_number, finish, language, condition,
    previous_stock, new_stock, delta, changed_by
  ) VALUES (
    NEW.id, NEW.name, NEW.collection, NEW.card_number, NEW.finish, NEW.language, NEW.condition,
    prev, curr, curr - prev, auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_card_stock_change ON public.cards;
CREATE TRIGGER trg_log_card_stock_change
AFTER INSERT OR UPDATE OF stock ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.log_card_stock_change();
