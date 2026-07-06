CREATE TABLE public.videogames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  platform text NOT NULL DEFAULT 'Nintendo Switch',
  condition text NOT NULL DEFAULT 'Novo',
  region text,
  includes_box boolean NOT NULL DEFAULT true,
  price_cents integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.videogames TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videogames TO authenticated;
GRANT ALL ON public.videogames TO service_role;

ALTER TABLE public.videogames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active videogames"
  ON public.videogames FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert videogames"
  ON public.videogames FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update videogames"
  ON public.videogames FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete videogames"
  ON public.videogames FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER videogames_updated_at
  BEFORE UPDATE ON public.videogames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX videogames_active_sort_idx ON public.videogames (active, sort_order, created_at DESC);
CREATE INDEX videogames_platform_idx ON public.videogames (platform);