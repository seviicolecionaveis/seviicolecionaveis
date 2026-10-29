CREATE OR REPLACE FUNCTION public.sync_auction_order_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE matched uuid; prof record; login_email text;
BEGIN
  IF NEW.origin IS DISTINCT FROM 'auction' THEN RETURN NEW; END IF;
  -- Vincula à conta existente pelo WhatsApp (somente pedidos não pagos)
  IF NEW.status = 'pending' AND NEW.phone IS NOT NULL THEN
    BEGIN
      matched := public.find_user_by_phone(NEW.phone);
    EXCEPTION WHEN OTHERS THEN matched := NULL; END;
    IF matched IS NOT NULL AND matched IS DISTINCT FROM NEW.user_id THEN
      NEW.user_id := matched;
    END IF;
  END IF;
  SELECT full_name, cpf, phone, whatsapp INTO prof FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT email INTO login_email FROM auth.users WHERE id = NEW.user_id;
  IF prof.full_name IS NOT NULL AND btrim(prof.full_name) <> '' THEN NEW.recipient_name := prof.full_name; END IF;
  IF login_email IS NOT NULL THEN NEW.email := login_email; END IF;
  IF coalesce(NEW.cpf,'') = '' AND coalesce(prof.cpf,'') <> '' THEN NEW.cpf := prof.cpf; END IF;
  IF public.normalize_br_phone(coalesce(prof.whatsapp, prof.phone)) IS NOT NULL THEN
    NEW.phone := '55' || public.normalize_br_phone(coalesce(prof.whatsapp, prof.phone));
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sync_auction_order_contact() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_auction_order_contact ON public.orders;
CREATE TRIGGER trg_sync_auction_order_contact
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_auction_order_contact();

-- Backfill: todos os pedidos do leilão #20
CREATE TEMP TABLE _a20 ON COMMIT DROP AS
SELECT o.id, p.full_name, p.cpf, u.email login_email,
       public.normalize_br_phone(coalesce(p.whatsapp, p.phone)) ph
FROM public.orders o JOIN public.auctions a ON a.id = o.auction_id
LEFT JOIN public.profiles p ON p.user_id = o.user_id
LEFT JOIN auth.users u ON u.id = o.user_id
WHERE a.auction_number = 20;

UPDATE public.orders o SET
  recipient_name = coalesce(nullif(btrim(t.full_name),''), o.recipient_name),
  email = coalesce(t.login_email, o.email),
  cpf = CASE WHEN coalesce(o.cpf,'') = '' THEN nullif(t.cpf,'') ELSE o.cpf END,
  phone = CASE WHEN t.ph IS NOT NULL THEN '55' || t.ph ELSE o.phone END
FROM _a20 t WHERE t.id = o.id;