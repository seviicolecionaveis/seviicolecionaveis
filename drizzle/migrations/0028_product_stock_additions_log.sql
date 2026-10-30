CREATE TABLE public.product_stock_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_table text NOT NULL CHECK (product_table IN ('panels','sealed_products','accessories')),
  product_id uuid NOT NULL,
  title text NOT NULL,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  delta integer NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);

CREATE INDEX product_stock_changes_changed_at_idx ON public.product_stock_changes (changed_at DESC);
CREATE INDEX product_stock_changes_product_idx ON public.product_stock_changes (product_table, product_id);

GRANT SELECT ON public.product_stock_changes TO authenticated;
GRANT ALL ON public.product_stock_changes TO service_role;

ALTER TABLE public.product_stock_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view product stock changes"
  ON public.product_stock_changes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_product_stock_change()
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
  ELSE
    prev := COALESCE(OLD.stock, 0);
    curr := COALESCE(NEW.stock, 0);
  END IF;
  IF prev = curr THEN RETURN COALESCE(NEW, OLD); END IF;

  INSERT INTO public.product_stock_changes (
    product_table, product_id, title, previous_stock, new_stock, delta, changed_by
  ) VALUES (
    TG_TABLE_NAME, NEW.id, COALESCE(NEW.title, ''), prev, curr, curr - prev, auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_panels_stock ON public.panels;
CREATE TRIGGER trg_log_panels_stock
AFTER INSERT OR UPDATE OF stock ON public.panels
FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

DROP TRIGGER IF EXISTS trg_log_sealed_stock ON public.sealed_products;
CREATE TRIGGER trg_log_sealed_stock
AFTER INSERT OR UPDATE OF stock ON public.sealed_products
FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

DROP TRIGGER IF EXISTS trg_log_accessories_stock ON public.accessories;
CREATE TRIGGER trg_log_accessories_stock
AFTER INSERT OR UPDATE OF stock ON public.accessories
FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

CREATE OR REPLACE FUNCTION public.catalog_last_product_additions()
RETURNS TABLE (product_table text, product_id uuid, last_added_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.product_table, s.product_id, max(s.changed_at)::timestamptz AS last_added_at
  FROM public.product_stock_changes s
  WHERE s.delta > 0
  GROUP BY s.product_table, s.product_id
$$;

GRANT EXECUTE ON FUNCTION public.catalog_last_product_additions() TO anon, authenticated;