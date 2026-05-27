
CREATE TABLE public.accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('Sleeves/Shields','Dados','Marcadores de dano','Moedas','Playmats','Binders','Top Loader','Deck box','Kit jogável')),
  price_cents integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accessories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accessories TO authenticated;
GRANT ALL ON public.accessories TO service_role;

ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active accessories"
  ON public.accessories FOR SELECT
  USING ((active = true) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage accessories"
  ON public.accessories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER accessories_set_updated_at
  BEFORE UPDATE ON public.accessories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
