CREATE OR REPLACE FUNCTION public.fulfillment_group_action(p_order uuid,p_action text,p_value jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; gid uuid; uid uuid; ids uuid[]; n timestamptz:=now(); BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT user_id INTO uid FROM orders WHERE id=p_order; IF uid IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,6913));
 PERFORM 1 FROM orders WHERE user_id=uid ORDER BY id FOR UPDATE;
 SELECT * INTO o FROM orders WHERE id=p_order; gid:=o.fulfillment_group_id;
 IF gid IS NULL THEN RETURN jsonb_build_object('group_id',NULL,'order_ids',ARRAY[p_order]); END IF;
 SELECT array_agg(id) INTO ids FROM orders WHERE fulfillment_group_id=gid AND status NOT IN ('delivered','cancelled','shipped','refunded','cancellation_requested');
 IF p_action='fee' THEN
 IF o.fulfillment_data->>'schedule_kind'<>'delivery' THEN RAISE EXCEPTION 'Não é entrega em mãos'; END IF;
 UPDATE orders SET fulfillment_data=fulfillment_data||jsonb_build_object('hand_delivery_fee_status',CASE WHEN (p_value->>'confirmed')::boolean THEN 'confirmed' ELSE 'pending' END),fulfillment_history=fulfillment_history||jsonb_build_array(jsonb_build_object('at',n,'action','Taxa confirmada em grupo','actor',p_value->>'actor','confirmed',p_value->'confirmed','note',p_value->>'note')) WHERE id=ANY(ids);
 IF o.fulfillment_service_order_id IS NOT NULL THEN UPDATE service_orders SET fee_status=CASE WHEN (p_value->>'confirmed')::boolean THEN 'confirmed' ELSE 'pending' END WHERE id=o.fulfillment_service_order_id; END IF;
 ELSIF p_action='reopen' THEN
 UPDATE orders SET fulfillment_data=fulfillment_data||jsonb_build_object('reschedule_required',true),reschedule_required=true,schedule_reopened_at=n,fulfillment_history=fulfillment_history||jsonb_build_array(jsonb_build_object('at',n,'action','Não compareceu / não concluído','group_id',gid,'previous',fulfillment_data)) WHERE id=ANY(ids) AND NOT coalesce((fulfillment_data->>'reschedule_required')::boolean,false);
 ELSIF p_action='detach' THEN
 UPDATE orders SET fulfillment_group_id=NULL,fulfillment_group_code=NULL,fulfillment_service_order_id=NULL,is_group_primary=false,fulfillment_history=fulfillment_history||jsonb_build_array(jsonb_build_object('at',n,'action','Pedido saiu do grupo','group_id',gid)) WHERE id=p_order;
 PERFORM public.fulfillment_rebalance(gid);
 ELSIF p_action='rebalance' THEN PERFORM public.fulfillment_rebalance(gid);
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 RETURN jsonb_build_object('group_id',gid,'order_ids',ids);
END $$;
REVOKE ALL ON FUNCTION public.fulfillment_group_action(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfillment_group_action(uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.fulfillment_status_primary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.fulfillment_group_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('delivered','cancelled','shipped','refunded') THEN PERFORM public.fulfillment_rebalance(NEW.fulfillment_group_id); END IF; RETURN NEW;
END $$;
CREATE TRIGGER orders_fulfillment_status_primary AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.fulfillment_status_primary();