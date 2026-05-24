
CREATE TABLE public.panels (
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

ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active panels"
  ON public.panels FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage panels"
  ON public.panels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER panels_set_updated_at
  BEFORE UPDATE ON public.panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_panels_active_sort ON public.panels (active, sort_order);
