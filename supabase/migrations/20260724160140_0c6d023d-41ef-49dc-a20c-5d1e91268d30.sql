
-- Presale system
CREATE TABLE public.presale_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.presale_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.presale_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  release_year INTEGER,
  available_from DATE,
  whatsapp_button_text TEXT NOT NULL DEFAULT 'Quero reservar o meu!',
  whatsapp_message_template TEXT NOT NULL DEFAULT 'Olá! Vim do site e gostaria de reservar o meu "[nome do produto]".',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presale_products_page ON public.presale_products(page_id, sort_order);
CREATE INDEX idx_presale_pages_active ON public.presale_pages(is_active, starts_at, ends_at);

-- Grants
GRANT SELECT ON public.presale_pages TO anon, authenticated;
GRANT ALL ON public.presale_pages TO service_role;
GRANT SELECT ON public.presale_products TO anon, authenticated;
GRANT ALL ON public.presale_products TO service_role;

-- RLS
ALTER TABLE public.presale_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presale_products ENABLE ROW LEVEL SECURITY;

-- Public: only pages within active window
CREATE POLICY "Public can read active presale pages"
  ON public.presale_pages FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Public can read products of active presale pages"
  ON public.presale_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.presale_pages p
      WHERE p.id = presale_products.page_id
        AND p.is_active = true
        AND (p.starts_at IS NULL OR p.starts_at <= now())
        AND (p.ends_at IS NULL OR p.ends_at > now())
    )
  );

-- Admin full access
CREATE POLICY "Admins manage presale pages"
  ON public.presale_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage presale products"
  ON public.presale_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_presale_pages_updated
  BEFORE UPDATE ON public.presale_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_presale_products_updated
  BEFORE UPDATE ON public.presale_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
