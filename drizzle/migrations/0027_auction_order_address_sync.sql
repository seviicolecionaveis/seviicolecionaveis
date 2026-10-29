CREATE OR REPLACE FUNCTION public.sync_auction_order_contact()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE matched uuid; prof record; login_email text; addr record;
BEGIN
  IF NEW.origin IS DISTINCT FROM 'auction' THEN RETURN NEW; END IF;
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
  -- Endereço: substitui o placeholder "A combinar" pelo endereço padrão (ou mais recente) da conta
  IF coalesce(NEW.cep,'') IN ('', '00000000') OR NEW.street = 'A combinar' THEN
    SELECT * INTO addr FROM public.addresses WHERE user_id = NEW.user_id
      ORDER BY is_default DESC, created_at DESC LIMIT 1;
    IF FOUND THEN
      NEW.cep := addr.cep; NEW.street := addr.street; NEW.number := addr.number;
      NEW.complement := addr.complement; NEW.neighborhood := addr.neighborhood;
      NEW.city := addr.city; NEW.state := addr.state;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.orders o SET cep=a.cep, street=a.street, number=a.number, complement=a.complement,
  neighborhood=a.neighborhood, city=a.city, state=a.state
FROM (SELECT DISTINCT ON (user_id) * FROM public.addresses ORDER BY user_id, is_default DESC, created_at DESC) a
WHERE o.origin='auction' AND a.user_id=o.user_id
  AND (coalesce(o.cep,'') IN ('','00000000') OR o.street='A combinar');