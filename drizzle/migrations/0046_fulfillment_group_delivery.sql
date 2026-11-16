CREATE OR REPLACE FUNCTION public.fulfillment_deliver(p_order uuid,p_all boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; uid uuid; ids uuid[]; gid uuid; BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT user_id INTO uid FROM orders WHERE id=p_order; PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,6913));
 PERFORM 1 FROM orders WHERE user_id=uid ORDER BY id FOR UPDATE;
 SELECT * INTO o FROM orders WHERE id=p_order; gid:=o.fulfillment_group_id;
 IF gid IS NULL OR o.status NOT IN ('paid','preparing','separated','awaiting_pickup','cards_pending_delivery') THEN RAISE EXCEPTION 'Pedido não elegível'; END IF;
 SELECT array_agg(id) INTO ids FROM orders WHERE (CASE WHEN p_all THEN fulfillment_group_id=gid ELSE id=p_order END) AND status IN ('paid','preparing','separated','awaiting_pickup','cards_pending_delivery');
 UPDATE orders SET status='delivered',fulfillment_history=fulfillment_history||jsonb_build_array(jsonb_build_object('at',now(),'action','Entrega confirmada','group_id',gid,'orders',ids)) WHERE id=ANY(ids);
 IF NOT p_all THEN PERFORM public.fulfillment_group_action(p_order,'detach'); END IF;
 RETURN jsonb_build_object('group_id',gid,'order_ids',ids);
END $$;
REVOKE ALL ON FUNCTION public.fulfillment_deliver(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfillment_deliver(uuid,boolean) TO service_role;