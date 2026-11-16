ALTER TABLE public.accessories ADD COLUMN IF NOT EXISTS slug text, ADD COLUMN IF NOT EXISTS sku text, ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE TABLE public.accessory_slug_history (slug text PRIMARY KEY, accessory_id uuid NOT NULL REFERENCES public.accessories(id) ON DELETE CASCADE);
GRANT SELECT ON public.accessory_slug_history TO anon, authenticated;
GRANT ALL ON public.accessory_slug_history TO service_role;
ALTER TABLE public.accessory_slug_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY accessory_slug_public ON public.accessory_slug_history FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.accessories a WHERE a.id=accessory_id AND a.active));
CREATE FUNCTION public.accessory_assign_slug() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE base text; candidate text; suffix integer:=1;
BEGIN
 PERFORM pg_advisory_xact_lock(84723411);
 base:=trim(both '-' from regexp_replace(translate(lower(NEW.title),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+','-','g'));
 IF base='' THEN base:='acessorio'; END IF;
 IF TG_OP='UPDATE' AND NEW.title=OLD.title AND NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
 candidate:=base;
 WHILE EXISTS(SELECT 1 FROM public.accessories WHERE slug=candidate AND id<>NEW.id) OR EXISTS(SELECT 1 FROM public.accessory_slug_history WHERE slug=candidate AND accessory_id<>NEW.id) LOOP suffix:=suffix+1; candidate:=base||'-'||suffix; END LOOP;
 IF TG_OP='UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug<>candidate THEN INSERT INTO public.accessory_slug_history(slug,accessory_id) VALUES(OLD.slug,NEW.id) ON CONFLICT(slug) DO NOTHING; END IF;
 NEW.slug:=candidate; RETURN NEW;
END $$;
CREATE TRIGGER accessory_slug_identity BEFORE INSERT OR UPDATE OF title,slug ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.accessory_assign_slug();
UPDATE public.accessories SET slug=NULL WHERE slug IS NULL;
CREATE UNIQUE INDEX accessories_slug_unique ON public.accessories(slug);
REVOKE ALL ON FUNCTION public.accessory_assign_slug() FROM PUBLIC;