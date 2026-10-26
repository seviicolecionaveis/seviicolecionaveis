CREATE OR REPLACE FUNCTION public.admin_merge_customer_accounts(_target uuid, _source uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE moved integer; real_stack uuid; sh record; target_label text; s record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _target IS NULL OR _source IS NULL OR _target = _source THEN RAISE EXCEPTION 'Contas inválidas'; END IF;
  PERFORM 1 FROM public.profiles WHERE user_id IN (_target,_source) FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=_target) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT cpf, phone, whatsapp, birth_date, full_name INTO s FROM public.profiles WHERE user_id=_source;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_source AND role='admin') THEN
    RAISE EXCEPTION 'Não é possível mesclar uma conta de administrador'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_credit_entries WHERE user_id=_source)
     OR EXISTS (SELECT 1 FROM public.customer_payment_attempts WHERE user_id=_source)
     OR EXISTS (SELECT 1 FROM public.customer_refunds WHERE user_id=_source) THEN
    RAISE EXCEPTION 'A outra conta tem movimentação de saldo ou reembolso; mescle manualmente'; END IF;

  UPDATE public.orders SET user_id=_target WHERE user_id=_source;
  GET DIAGNOSTICS moved = ROW_COUNT;
  UPDATE public.service_orders SET user_id=_target WHERE user_id=_source;
  UPDATE public.loyalty_points_ledger SET user_id=_target WHERE user_id=_source AND reason<>'signup';
  UPDATE public.addresses SET user_id=_target, is_default=false WHERE user_id=_source;
  FOR sh IN SELECT id FROM public.card_stacks WHERE user_id=_source LOOP
    SELECT id INTO real_stack FROM public.card_stacks WHERE user_id=_target AND status='active' ORDER BY created_at DESC LIMIT 1;
    IF real_stack IS NULL THEN
      UPDATE public.card_stacks SET user_id=_target WHERE id=sh.id;
      UPDATE public.card_stack_items SET user_id=_target WHERE stack_id=sh.id;
    ELSE
      UPDATE public.card_stack_items SET user_id=_target, stack_id=real_stack WHERE stack_id=sh.id;
      UPDATE public.card_stacks SET status='completed' WHERE id=sh.id;
    END IF;
  END LOOP;
  UPDATE public.card_stack_items SET user_id=_target WHERE user_id=_source;

  SELECT coalesce(nullif(full_name,''), 'conta principal') INTO target_label FROM public.profiles WHERE user_id=_target;
  UPDATE public.profiles SET cpf=NULL, phone=NULL, whatsapp=NULL,
    full_name = left(coalesce(nullif(s.full_name,''),'Conta') || ' (vinculado a ' || target_label || ')', 160)
  WHERE user_id=_source;
  UPDATE public.profiles SET
    cpf = coalesce(nullif(cpf,''), nullif(s.cpf,'')),
    phone = coalesce(nullif(phone,''), nullif(s.phone,'')),
    whatsapp = coalesce(nullif(whatsapp,''), nullif(s.whatsapp,'')),
    birth_date = coalesce(birth_date, s.birth_date)
  WHERE user_id=_target;

  RETURN jsonb_build_object('orders_moved', moved);
END $$;
REVOKE ALL ON FUNCTION public.admin_merge_customer_accounts(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_merge_customer_accounts(uuid,uuid) TO authenticated;