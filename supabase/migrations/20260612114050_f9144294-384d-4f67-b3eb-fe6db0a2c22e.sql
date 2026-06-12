
ALTER TABLE public.sealed_products ADD COLUMN IF NOT EXISTS sku text;

CREATE SEQUENCE IF NOT EXISTS public.sealed_products_sku_seq START 1;

CREATE OR REPLACE FUNCTION public.sealed_products_assign_sku()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    LOOP
      n := nextval('public.sealed_products_sku_seq');
      NEW.sku := 'SEL-' || lpad(n::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sealed_products WHERE sku = NEW.sku);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sealed_products_assign_sku_trg ON public.sealed_products;
CREATE TRIGGER sealed_products_assign_sku_trg
  BEFORE INSERT ON public.sealed_products
  FOR EACH ROW EXECUTE FUNCTION public.sealed_products_assign_sku();

-- Preenche SKU para registros existentes sem SKU
DO $$
DECLARE
  r record;
  n bigint;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM public.sealed_products WHERE sku IS NULL OR btrim(sku) = '' ORDER BY created_at LOOP
    LOOP
      n := nextval('public.sealed_products_sku_seq');
      candidate := 'SEL-' || lpad(n::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sealed_products WHERE sku = candidate);
    END LOOP;
    UPDATE public.sealed_products SET sku = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sealed_products_sku_key ON public.sealed_products(sku);
