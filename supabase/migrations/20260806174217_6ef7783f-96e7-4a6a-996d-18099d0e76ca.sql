CREATE TABLE public.site_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_html text not null default '',
  image_url text,
  link_url text,
  active boolean not null default true,
  show_on_notices boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.site_popups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_popups TO authenticated;
GRANT ALL ON public.site_popups TO service_role;
ALTER TABLE public.site_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active popups" ON public.site_popups FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage popups" ON public.site_popups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER site_popups_updated_at BEFORE UPDATE ON public.site_popups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();