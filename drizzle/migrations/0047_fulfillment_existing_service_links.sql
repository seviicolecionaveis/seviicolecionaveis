DO $$ DECLARE s record; ids uuid[]; d jsonb; BEGIN
 IF (SELECT count(*) FROM service_orders)<>43 OR (SELECT count(DISTINCT order_id) FROM card_stack_items WHERE service_order_id IS NOT NULL)<>90 THEN RAISE EXCEPTION 'Dados mudaram: conferir backup novamente'; END IF;
 IF EXISTS(SELECT 1 FROM card_stack_items WHERE service_order_id IS NOT NULL AND order_id IS NOT NULL GROUP BY order_id HAVING count(DISTINCT service_order_id)>1) THEN RAISE EXCEPTION 'Pedido em várias OS: revisar antes de migrar'; END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 FOR s IN SELECT * FROM service_orders ORDER BY created_at,id LOOP
 SELECT array_agg(DISTINCT order_id) FILTER(WHERE order_id IS NOT NULL) INTO ids FROM card_stack_items WHERE service_order_id=s.id;
 IF ids IS NULL THEN CONTINUE; END IF;
 d:=jsonb_build_object('shipping_method',CASE WHEN s.method='correios' THEN 'fixed' WHEN s.method='arte_em_cards' THEN 'arte_em_cards' ELSE 'arrange' END,'schedule_kind',s.schedule_kind,'scheduled_at',s.scheduled_at,'event_id',s.event_id,'notes',s.notes,'cep',s.cep,'street',s.street,'number',s.number,'complement',s.complement,'neighborhood',s.neighborhood,'city',s.city,'state',s.state,'hand_delivery_fee_status',s.fee_status,'group_shipping_cents',CASE WHEN s.method='app' THEN 1500 ELSE s.shipping_cost_cents END,'service_code',s.code);
 PERFORM public.fulfillment_apply(ids,d,'legacy-service:'||s.id,s.id,NULL,true);
 END LOOP;
END $$;