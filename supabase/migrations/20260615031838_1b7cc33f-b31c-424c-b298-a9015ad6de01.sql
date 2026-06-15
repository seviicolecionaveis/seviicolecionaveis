
-- =========================================================
-- 1. FLASH_OFFERS (Ofertas Relâmpago)
-- =========================================================
CREATE TABLE public.flash_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  discount_percent integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.flash_offers_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.discount_percent < 1 OR NEW.discount_percent > 90 THEN
    RAISE EXCEPTION 'discount_percent must be between 1 and 90';
  END IF;
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'ends_at must be after starts_at';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER flash_offers_validate_trg
BEFORE INSERT OR UPDATE ON public.flash_offers
FOR EACH ROW EXECUTE FUNCTION public.flash_offers_validate();

CREATE INDEX idx_flash_offers_active ON public.flash_offers(active, ends_at) WHERE active = true;
CREATE INDEX idx_flash_offers_card ON public.flash_offers(card_id) WHERE active = true;

GRANT SELECT ON public.flash_offers TO anon, authenticated;
GRANT ALL ON public.flash_offers TO service_role;

ALTER TABLE public.flash_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active flash offers"
  ON public.flash_offers FOR SELECT
  USING (active = true AND now() BETWEEN starts_at AND ends_at);

CREATE POLICY "Admins manage flash offers"
  ON public.flash_offers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 2. PUSH_SUBSCRIPTIONS (Web Push)
-- =========================================================
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
