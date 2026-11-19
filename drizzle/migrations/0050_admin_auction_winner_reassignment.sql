CREATE TABLE public.auction_winner_changes (
 id uuid PRIMARY KEY,
 auction_item_id uuid NOT NULL REFERENCES public.auction_items(id),
 source_order_id uuid NOT NULL REFERENCES public.orders(id),
 target_order_id uuid NOT NULL REFERENCES public.orders(id),
 previous_bid_id uuid NOT NULL REFERENCES public.auction_bids(id),
 new_bid_id uuid NOT NULL REFERENCES public.auction_bids(id),
 previous_user_id uuid NOT NULL,
 new_user_id uuid NOT NULL,
 previous_unit_price_cents integer NOT NULL,
 new_unit_price_cents integer NOT NULL,
 reason text NOT NULL,
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auction_winner_changes TO authenticated;
GRANT ALL ON public.auction_winner_changes TO service_role;
ALTER TABLE public.auction_winner_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY auction_winner_changes_admin_read ON public.auction_winner_changes FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.auction_order_reassignable(p_order public.orders) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT p_order.origin='auction' AND p_order.status='pending'
 AND p_order.stripe_session_id IS NULL AND p_order.stripe_payment_intent IS NULL
 AND p_order.mercadopago_payment_id IS NULL AND p_order.pix_qr_code IS NULL
 AND p_order.payment_paid_at IS NULL AND p_order.finance_settled_at IS NULL
 AND NOT coalesce(p_order.stock_decremented,false)
 AND p_order.fulfillment_group_id IS NULL
 AND coalesce(p_order.discount_cents,0)=0 AND coalesce(p_order.wallet_deduction_cents,0)=0
 AND coalesce(p_order.store_credit_cents,0)=0 AND coalesce(p_order.refunded_cents,0)=0
 AND NOT EXISTS(SELECT 1 FROM public.customer_payment_attempts a WHERE a.order_id=p_order.id)
 AND NOT EXISTS(SELECT 1 FROM public.order_items i WHERE i.order_id=p_order.id AND coalesce(i.cancelled_quantity,0)>0)
$$;
REVOKE ALL ON FUNCTION public.auction_order_reassignable(public.orders) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auction_order_reassignable(public.orders) TO service_role;
CREATE FUNCTION public.admin_preview_auction_winner_change(p_item_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it public.auction_items; src public.orders; oi public.order_items; oldbid public.auction_bids; nextbid public.auction_bids; matched uuid; n integer; name text;
BEGIN
 PERFORM public.finance_assert_admin(auth.uid());
 SELECT * INTO it FROM public.auction_items WHERE id=p_item_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.auctions WHERE id=it.auction_id AND status='finished') THEN RAISE EXCEPTION 'Só é possível trocar arrematantes de leilões encerrados.'; END IF;
 SELECT count(*) INTO n FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.auction_id=it.auction_id AND o.origin='auction' AND o.status<>'cancelled' AND i.card_id='auction:'||it.id::text;
 IF n<>1 THEN RAISE EXCEPTION 'Não foi possível identificar um único pedido para esta carta. Revise os pedidos.'; END IF;
 SELECT i.* INTO oi FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.auction_id=it.auction_id AND o.origin='auction' AND o.status<>'cancelled' AND i.card_id='auction:'||it.id::text;
 SELECT * INTO src FROM public.orders WHERE id=oi.order_id;
 IF NOT public.auction_order_reassignable(src) THEN RAISE EXCEPTION 'Troca bloqueada: pedido pago, pagamento iniciado, ajuste financeiro ou envio agrupado. Nenhuma carta foi alterada.'; END IF;
 IF oi.quantity<>it.quantity OR oi.unit_price_cents<>round(it.final_bid*100)::integer THEN RAISE EXCEPTION 'Os dados do arremate divergem do pedido. Revise antes de trocar.'; END IF;
 SELECT * INTO oldbid FROM public.auction_bids b WHERE b.auction_id=it.auction_id AND (b.item_id=it.id OR (b.item_id IS NULL AND b.sequence=it.sequence)) AND b.order_id=src.id AND b.status='order_created' AND b.amount=it.final_bid ORDER BY b.created_at,b.id LIMIT 1;
 IF oldbid.id IS NULL THEN RAISE EXCEPTION 'O lance vencedor não está vinculado ao pedido.'; END IF;
 SELECT * INTO nextbid FROM public.auction_bids b WHERE b.auction_id=it.auction_id AND (b.item_id=it.id OR (b.item_id IS NULL AND b.sequence=it.sequence))
 AND b.status IN ('pending','approved','order_created') AND b.amount>0 AND b.amount<it.final_bid
 AND b.phone<>oldbid.phone AND b.phone IS DISTINCT FROM it.winner_phone
 AND (public.normalize_br_phone(b.phone) IS NULL OR public.normalize_br_phone(b.phone) IS DISTINCT FROM public.normalize_br_phone(oldbid.phone))
 AND coalesce(public.find_user_by_phone(b.phone),'00000000-0000-0000-0000-000000000000'::uuid)<>src.user_id
 ORDER BY b.amount DESC,b.created_at ASC,b.id ASC LIMIT 1;
 IF nextbid.id IS NULL THEN RAISE EXCEPTION 'Não há lance válido anterior de outro arrematante.'; END IF;
 matched:=public.find_user_by_phone(nextbid.phone);
 SELECT full_name INTO name FROM public.profiles WHERE user_id=matched;
 RETURN jsonb_build_object('itemId',it.id,'itemName',it.name,'sourceOrderId',src.id,'sourceName',src.recipient_name,'previousBidId',oldbid.id,'candidateBidId',nextbid.id,'candidateName',nextbid.bidder_name,'amountCents',round(nextbid.amount*100)::integer,'quantity',oi.quantity,'matchedUserId',matched,'matchedName',name,'needsIdentification',matched IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_auction_winner_change(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_auction_winner_change(uuid) TO authenticated;
CREATE FUNCTION public.admin_change_auction_winner(p_item_id uuid,p_source_order_id uuid,p_candidate_bid_id uuid,p_target_user_id uuid,p_amount_cents integer,p_reason text,p_operation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prev jsonb; src public.orders; dst public.orders; oi public.order_items; bid public.auction_bids; prof public.profiles; audit public.auction_winner_changes; target uuid; phone text; cents integer; subtotal integer; login_email text;
BEGIN
 PERFORM public.finance_assert_admin(auth.uid());
 IF p_operation_id IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe o motivo da troca (3 a 500 caracteres).'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('auction-winner-operation:'||p_operation_id::text,0));
 SELECT * INTO audit FROM public.auction_winner_changes WHERE id=p_operation_id;
 IF FOUND THEN
  IF audit.auction_item_id<>p_item_id OR audit.source_order_id<>p_source_order_id OR audit.new_bid_id<>p_candidate_bid_id OR audit.new_user_id<>p_target_user_id OR audit.reason<>btrim(p_reason) OR audit.new_unit_price_cents<>p_amount_cents THEN RAISE EXCEPTION 'Confirmação já usada para outra troca.'; END IF;
  RETURN jsonb_build_object('targetOrderId',audit.target_order_id,'sourceOrderId',audit.source_order_id,'alreadyApplied',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('auction-winner:'||(SELECT auction_id::text FROM public.auction_items WHERE id=p_item_id),0));
 PERFORM 1 FROM public.auction_items WHERE id=p_item_id FOR UPDATE;
 PERFORM 1 FROM public.auction_bids WHERE auction_id=(SELECT auction_id FROM public.auction_items WHERE id=p_item_id) AND (item_id=p_item_id OR (item_id IS NULL AND sequence=(SELECT sequence FROM public.auction_items WHERE id=p_item_id))) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.orders WHERE id=p_source_order_id OR (auction_id=(SELECT auction_id FROM public.auction_items WHERE id=p_item_id) AND user_id=p_target_user_id AND origin='auction' AND status='pending') ORDER BY id FOR UPDATE;
 prev:=public.admin_preview_auction_winner_change(p_item_id);
 IF (prev->>'sourceOrderId')::uuid<>p_source_order_id OR (prev->>'candidateBidId')::uuid<>p_candidate_bid_id OR (prev->>'amountCents')::integer<>p_amount_cents THEN RAISE EXCEPTION 'O arremate mudou. Feche e abra a confirmação novamente.'; END IF;
 SELECT * INTO src FROM public.orders WHERE id=p_source_order_id;
 SELECT * INTO bid FROM public.auction_bids WHERE id=p_candidate_bid_id;
 target:=nullif(prev->>'matchedUserId','')::uuid;
 IF target IS NOT NULL AND target IS DISTINCT FROM p_target_user_id THEN RAISE EXCEPTION 'A conta deve ser a identificada pelo WhatsApp do lance.'; END IF;
 IF target IS NULL THEN
  IF public.normalize_br_phone(bid.phone) IS NOT NULL THEN RAISE EXCEPTION 'WhatsApp válido sem conta única. Corrija a identificação antes da troca.'; END IF;
  target:=p_target_user_id;
 END IF;
 IF target IS NULL OR target=src.user_id THEN RAISE EXCEPTION 'Selecione a conta de outro arrematante.'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=target;
 SELECT email INTO login_email FROM auth.users WHERE id=target AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<now());
 phone:=public.normalize_br_phone(coalesce(nullif(prof.whatsapp,''),prof.phone));
 IF prof.user_id IS NULL OR login_email IS NULL OR phone IS NULL OR public.find_user_by_phone('55'||phone) IS DISTINCT FROM target THEN RAISE EXCEPTION 'A conta escolhida precisa ter um WhatsApp válido e único.'; END IF;
 SELECT * INTO oi FROM public.order_items WHERE order_id=src.id AND card_id='auction:'||p_item_id::text FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.card_stack_items WHERE order_item_id=oi.id) THEN RAISE EXCEPTION 'Carta já vinculada à Pilha. Troca bloqueada.'; END IF;
 SELECT o.* INTO dst FROM public.orders o WHERE o.user_id=target AND o.auction_id=src.auction_id AND o.id<>src.id AND public.auction_order_reassignable(o) ORDER BY o.created_at,o.id LIMIT 1;
 cents:=(prev->>'amountCents')::integer;
 IF dst.id IS NULL THEN
  INSERT INTO public.orders(user_id,status,origin,auction_id,payment_method,shipping_method,shipping_cost_cents,subtotal_cents,total_cents,recipient_name,phone,email,cep,street,number,neighborhood,city,state,notes)
  VALUES(target,'pending','auction',src.auction_id,'pix','arrange',0,0,0,prof.full_name,'55'||phone,login_email,'00000000','A combinar','S/N','A combinar','A combinar','SP','Pedido de leilão criado por troca de arrematante.') RETURNING * INTO dst;
 END IF;
 IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id=dst.id AND card_id=oi.card_id) THEN RAISE EXCEPTION 'A carta já está no pedido de destino.'; END IF;
 IF src.subtotal_cents IS DISTINCT FROM (SELECT coalesce(sum(quantity*unit_price_cents),0)::integer FROM public.order_items WHERE order_id=src.id) OR src.total_cents IS DISTINCT FROM src.subtotal_cents+src.shipping_cost_cents THEN RAISE EXCEPTION 'O total do pedido original precisa ser revisado.'; END IF;
 IF dst.subtotal_cents IS DISTINCT FROM (SELECT coalesce(sum(quantity*unit_price_cents),0)::integer FROM public.order_items WHERE order_id=dst.id) OR dst.total_cents IS DISTINCT FROM dst.subtotal_cents+dst.shipping_cost_cents THEN RAISE EXCEPTION 'O total do pedido de destino precisa ser revisado.'; END IF;
 UPDATE public.order_items SET order_id=dst.id,unit_price_cents=cents WHERE id=oi.id;
 SELECT coalesce(sum(quantity*unit_price_cents),0)::integer INTO subtotal FROM public.order_items WHERE order_id=src.id;
 UPDATE public.orders SET subtotal_cents=subtotal,total_cents=subtotal+shipping_cost_cents,status=CASE WHEN NOT EXISTS(SELECT 1 FROM public.order_items WHERE order_id=src.id) THEN 'cancelled' ELSE 'pending' END,updated_at=now() WHERE id=src.id;
 SELECT coalesce(sum(quantity*unit_price_cents),0)::integer INTO subtotal FROM public.order_items WHERE order_id=dst.id;
 UPDATE public.orders SET subtotal_cents=subtotal,total_cents=subtotal+shipping_cost_cents,updated_at=now() WHERE id=dst.id;
 UPDATE public.auction_bids SET status='retracted' WHERE auction_id=src.auction_id AND (item_id=p_item_id OR (item_id IS NULL AND sequence=(SELECT sequence FROM public.auction_items WHERE id=p_item_id))) AND phone=(SELECT phone FROM public.auction_bids WHERE id=(prev->>'previousBidId')::uuid) AND status IN ('pending','approved','order_created');
 UPDATE public.auction_bids SET status='order_created',order_id=dst.id WHERE id=bid.id;
 UPDATE public.auction_items SET winner_phone=bid.phone,winner_name=prof.full_name,final_bid=bid.amount,status='sold' WHERE id=p_item_id;
 INSERT INTO public.auction_winner_changes(id,auction_item_id,source_order_id,target_order_id,previous_bid_id,new_bid_id,previous_user_id,new_user_id,previous_unit_price_cents,new_unit_price_cents,reason,actor_id)
 VALUES(p_operation_id,p_item_id,src.id,dst.id,(prev->>'previousBidId')::uuid,bid.id,src.user_id,target,oi.unit_price_cents,cents,btrim(p_reason),auth.uid());
 RETURN jsonb_build_object('targetOrderId',dst.id,'sourceOrderId',src.id,'alreadyApplied',false);
END $$;
REVOKE ALL ON FUNCTION public.admin_change_auction_winner(uuid,uuid,uuid,uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_change_auction_winner(uuid,uuid,uuid,uuid,integer,text,uuid) TO authenticated;