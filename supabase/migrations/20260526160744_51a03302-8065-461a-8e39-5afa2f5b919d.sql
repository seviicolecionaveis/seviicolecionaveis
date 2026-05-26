
CREATE TABLE public.sealed_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sealed_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sealed_products TO authenticated;
GRANT ALL ON public.sealed_products TO service_role;

ALTER TABLE public.sealed_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sealed products"
ON public.sealed_products FOR SELECT
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage sealed products"
ON public.sealed_products FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sealed_products_updated_at
BEFORE UPDATE ON public.sealed_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
