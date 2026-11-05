CREATE OR REPLACE FUNCTION public.merge_whatsapp_into_internal(_real uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE moved integer := 0; n text; r_email text; r_name text; r_cpf text; r_phone text;
BEGIN
  IF _real IS NULL THEN RETURN 0; END IF;
  SELECT u.email, nullif(trim(p.full_name),''), nullif(p.cpf,''), coalesce(nullif(p.whatsapp,''), nullif(p.phone,''))
    INTO r_email, r_name, r_cpf, r_phone
    FROM auth.users u JOIN public.profiles p ON p.user_id=u.id
   WHERE u.id=_real AND u.email NOT ILIKE '%@whatsapp.seviicolecionaveis.com.br';
  IF r_email IS NULL THEN RETURN 0; END IF;
  n := public.normalize_br_phone(r_phone);
  IF n IS NULL THEN RETURN 0; END IF;
  -- only when this is the single real account with that phone
  IF (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.user_id
       WHERE u.email NOT ILIKE '%@whatsapp.seviicolecionaveis.com.br'
         AND (public.normalize_br_phone(p.phone)=n OR public.normalize_br_phone(p.whatsapp)=n)) <> 1 THEN
    RETURN 0;
  END IF;

  UPDATE public.orders o SET user_id=_real, email=r_email,
         recipient_name=coalesce(r_name,o.recipient_name),
         cpf=coalesce(nullif(o.cpf,''), r_cpf),
         phone=coalesce(r_phone,o.phone)
   WHERE o.origin='auction' AND o.status='pending' AND o.payment_paid_at IS NULL AND NOT o.stock_decremented
     AND o.user_id<>_real
     AND EXISTS (SELECT 1 FROM auth.users sh JOIN public.profiles sp ON sp.user_id=sh.id
                  WHERE sh.id=o.user_id AND sh.email ILIKE '%@whatsapp.seviicolecionaveis.com.br'
                    AND (public.normalize_br_phone(sp.phone)=n OR public.normalize_br_phone(sp.whatsapp)=n OR public.normalize_br_phone(o.phone)=n));
  GET DIAGNOSTICS moved = ROW_COUNT;

  -- neutralize the bot-created profiles with the same phone
  UPDATE public.profiles sp SET phone=NULL, whatsapp=NULL,
         full_name=coalesce(nullif(trim(sp.full_name),''),'Cadastro WhatsApp')||' (vinculado a '||r_email||')'
    FROM auth.users sh
   WHERE sh.id=sp.user_id AND sh.email ILIKE '%@whatsapp.seviicolecionaveis.com.br'
     AND (public.normalize_br_phone(sp.phone)=n OR public.normalize_br_phone(sp.whatsapp)=n);
  RETURN moved;
END $$;
REVOKE ALL ON FUNCTION public.merge_whatsapp_into_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_whatsapp_into_internal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.profiles_merge_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- signup, or first time a phone is filled in
  IF TG_OP='INSERT' OR (coalesce(OLD.phone,'')='' AND coalesce(OLD.whatsapp,'')='') THEN
    BEGIN
      PERFORM public.merge_whatsapp_into_internal(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END $$;