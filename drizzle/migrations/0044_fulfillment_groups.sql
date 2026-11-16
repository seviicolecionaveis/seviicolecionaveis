ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_group_id uuid, ADD COLUMN IF NOT EXISTS fulfillment_service_order_id uuid REFERENCES public.service_orders(id), ADD COLUMN IF NOT EXISTS fulfillment_group_code bigint, ADD COLUMN IF NOT EXISTS is_group_primary boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS fulfillment_data jsonb, ADD COLUMN IF NOT EXISTS fulfillment_history jsonb NOT NULL DEFAULT '[]', ADD COLUMN IF NOT EXISTS fulfillment_operation_key text;
CREATE SEQUENCE IF NOT EXISTS public.fulfillment_group_code_seq;
CREATE INDEX IF NOT EXISTS orders_fulfillment_group_idx ON public.orders(fulfillment_group_id);
CREATE INDEX IF NOT EXISTS orders_fulfillment_operation_idx ON public.orders(fulfillment_operation_key);
CREATE OR REPLACE FUNCTION public.fulfillment_rebalance(p_group uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE primary_id uuid; d jsonb; BEGIN
 IF p_group IS NULL THEN RETURN; END IF;
 PERFORM 1 FROM orders WHERE fulfillment_group_id=p_group ORDER BY id FOR UPDATE;
 SELECT fulfillment_data INTO d FROM orders WHERE fulfillment_group_id=p_group AND fulfillment_data IS NOT NULL ORDER BY is_group_primary DESC,created_at,id LIMIT 1;
 SELECT id INTO primary_id FROM orders WHERE fulfillment_group_id=p_group AND status NOT IN ('delivered','cancelled','shipped','refunded','cancellation_requested') ORDER BY created_at,id LIMIT 1;
 UPDATE orders SET is_group_primary=coalesce(id=primary_id,false),fulfillment_data=CASE WHEN fulfillment_data IS NULL THEN NULL ELSE fulfillment_data||jsonb_build_object('shipping_cost_cents',CASE WHEN id=primary_id THEN coalesce((d->>'group_shipping_cents')::integer,0) ELSE 0 END,'group_primary_order_id',primary_id) END WHERE fulfillment_group_id=p_group;
END $$;
REVOKE ALL ON FUNCTION public.fulfillment_rebalance(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.fulfillment_apply(p_ids uuid[],p_data jsonb,p_key text,p_service uuid DEFAULT NULL,p_existing uuid DEFAULT NULL,p_historical boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; gid uuid; gcode bigint; old_groups uuid[]; old_group uuid; o record; mode text; at_time timestamptz; local_at timestamp; prev jsonb; safe jsonb; ev record; day_start time; day_end time;
BEGIN
 IF coalesce(array_length(p_ids,1),0)=0 OR array_length(p_ids,1)>500 OR length(coalesce(p_key,''))<8 THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT user_id INTO uid FROM orders WHERE id=p_ids[1];
 IF uid IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,6913));
 IF (SELECT count(*) FROM orders WHERE id=ANY(p_ids) AND user_id=uid)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN RAISE EXCEPTION 'Pedidos não pertencem ao mesmo cliente'; END IF;
 SELECT fulfillment_group_id,fulfillment_group_code INTO gid,gcode FROM orders WHERE fulfillment_operation_key=p_key LIMIT 1;
 IF gid IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM orders WHERE fulfillment_operation_key=p_key AND (NOT id=ANY(p_ids) OR fulfillment_data->>'shipping_method' IS DISTINCT FROM p_data->>'shipping_method' OR fulfillment_data->>'scheduled_at' IS DISTINCT FROM p_data->>'scheduled_at')) OR EXISTS(SELECT 1 FROM orders WHERE id=ANY(p_ids) AND fulfillment_operation_key IS DISTINCT FROM p_key) THEN RAISE EXCEPTION 'A confirmação já foi usada para outra escolha'; END IF;
 RETURN jsonb_build_object('group_id',gid,'group_code',gcode,'duplicate',true,'order_ids',p_ids); END IF;
 PERFORM 1 FROM orders WHERE user_id=uid ORDER BY id FOR UPDATE;
 IF NOT p_historical AND EXISTS(SELECT 1 FROM orders WHERE id=ANY(p_ids) AND (status IN ('delivered','cancelled','shipped','refunded','cancellation_requested') OR (origin='auction' AND status NOT IN ('paid','preparing','separated','awaiting_pickup','cards_pending_delivery')))) THEN RAISE EXCEPTION 'Há pedidos que não podem ser incluídos'; END IF;
 IF p_service IS NOT NULL AND NOT EXISTS(SELECT 1 FROM service_orders WHERE id=p_service AND user_id=uid) THEN RAISE EXCEPTION 'OS não pertence ao cliente'; END IF;
 mode:=p_data->>'schedule_kind'; at_time:=nullif(p_data->>'scheduled_at','')::timestamptz;
 IF NOT p_historical THEN
 IF coalesce(p_data->>'shipping_method','') NOT IN ('arrange','fixed','card_stack','arte_em_cards') THEN RAISE EXCEPTION 'Modalidade inválida'; END IF;
 IF mode IS NOT NULL THEN
 IF mode NOT IN ('pickup','delivery','event') OR at_time IS NULL OR at_time<now()+interval '24 hours' THEN RAISE EXCEPTION 'Agendamentos exigem 24h de antecedência'; END IF;
 local_at:=at_time AT TIME ZONE 'America/Fortaleza';
 IF mode='pickup' AND (extract(isodow from local_at) NOT BETWEEN 1 AND 5 OR local_at::time<'14:00' OR local_at::time>='19:00' OR extract(minute from local_at)::integer%30<>0 OR extract(second from local_at)<>0) THEN RAISE EXCEPTION 'Horário de retirada indisponível'; END IF;
 IF mode='delivery' AND (extract(isodow from local_at)<>4 OR local_at::time<>'19:00') THEN RAISE EXCEPTION 'Entrega em mãos: quintas às 19h'; END IF;
 IF mode='event' THEN
 SELECT * INTO ev FROM events WHERE id=(p_data->>'event_id')::uuid AND active;
 IF NOT FOUND OR local_at::date NOT BETWEEN ev.start_date AND ev.end_date THEN RAISE EXCEPTION 'Evento indisponível'; END IF;
 day_start:=coalesce((ev.per_day_times->to_char(local_at,'YYYY-MM-DD')->>'start')::time,ev.start_time);
 day_end:=coalesce((ev.per_day_times->to_char(local_at,'YYYY-MM-DD')->>'end')::time,ev.end_time);
 IF now()>((local_at::date+day_start) AT TIME ZONE 'America/Fortaleza')-interval '24 hours' OR local_at::time<day_start OR local_at::time>=day_end OR extract(epoch from (local_at::time-day_start))::integer%3600<>0 THEN RAISE EXCEPTION 'Horário do evento indisponível'; END IF;
 END IF;
 END IF;
 IF mode='delivery' AND (coalesce(lower(trim(p_data->>'city')),'')<>'aracaju' OR coalesce(upper(trim(p_data->>'state')),'') NOT IN ('SE','SERGIPE') OR (regexp_replace(coalesce(p_data->>'cep',''),'\D','','g')<>'' AND regexp_replace(p_data->>'cep','\D','','g') !~ '^490[0-9]{5}$')) THEN RAISE EXCEPTION 'Entrega em mãos somente Aracaju/SE'; END IF;
 IF p_data->>'shipping_method'='fixed' AND regexp_replace(coalesce(p_data->>'cep',''),'\D','','g') ~ '^490[0-9]{5}$' THEN RAISE EXCEPTION 'Correios não disponível em Aracaju'; END IF;
 IF mode='delivery' AND coalesce((p_data->>'group_shipping_cents')::integer,0)<>1500 THEN RAISE EXCEPTION 'Taxa de entrega deve ser R$15'; END IF;
 END IF;
 IF coalesce((p_data->>'group_shipping_cents')::integer,0)<0 THEN RAISE EXCEPTION 'Frete inválido'; END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe FROM jsonb_each(p_data) WHERE key IN ('shipping_method','schedule_kind','scheduled_at','event_id','notes','cep','street','number','complement','neighborhood','city','state','recipient_name','phone','hand_delivery_fee_status','group_shipping_cents','reschedule_required','service_code');
 gid:=coalesce(p_existing,gen_random_uuid());
 IF p_existing IS NOT NULL THEN
 SELECT fulfillment_group_code INTO gcode FROM orders WHERE fulfillment_group_id=gid AND user_id=uid LIMIT 1;
 IF gcode IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM orders WHERE fulfillment_group_id=gid AND NOT id=ANY(p_ids) AND status NOT IN ('delivered','cancelled','shipped','refunded') AND fulfillment_data IS DISTINCT FROM safe AND (fulfillment_data->>'scheduled_at' IS DISTINCT FROM safe->>'scheduled_at' OR fulfillment_data->>'schedule_kind' IS DISTINCT FROM safe->>'schedule_kind')) THEN RAISE EXCEPTION 'Inclua todos os pedidos do grupo para alterar o agendamento'; END IF;
 ELSE gcode:=nextval('public.fulfillment_group_code_seq'); END IF;
 SELECT array_agg(DISTINCT fulfillment_group_id) INTO old_groups FROM orders WHERE id=ANY(p_ids) AND fulfillment_group_id IS NOT NULL AND fulfillment_group_id<>gid;
 FOR o IN SELECT * FROM orders WHERE id=ANY(p_ids) ORDER BY id LOOP
 prev:=coalesce(o.fulfillment_data,jsonb_build_object('shipping_method',o.shipping_method,'schedule_kind',o.schedule_kind,'scheduled_at',o.scheduled_at,'event_id',o.event_id));
 UPDATE orders SET fulfillment_group_id=gid,fulfillment_group_code=gcode,fulfillment_service_order_id=p_service,is_group_primary=false,fulfillment_operation_key=p_key,
 fulfillment_data=CASE WHEN p_historical AND o.status IN ('delivered','cancelled','shipped','refunded') THEN fulfillment_data ELSE safe||jsonb_build_object('shipping_cost_cents',0,'reschedule_required',coalesce((safe->>'reschedule_required')::boolean,false)) END,
 fulfillment_history=fulfillment_history||jsonb_build_array(jsonb_build_object('at',now(),'actor',auth.uid(),'group_id',gid,'orders',p_ids,'previous',prev,'next',safe,'action','Modalidade definida em grupo'))
 WHERE id=o.id;
 END LOOP;
 FOREACH old_group IN ARRAY coalesce(old_groups,'{}') LOOP PERFORM public.fulfillment_rebalance(old_group); END LOOP;
 PERFORM public.fulfillment_rebalance(gid);
 RETURN jsonb_build_object('group_id',gid,'group_code',gcode,'order_ids',p_ids,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.fulfillment_apply(uuid[],jsonb,text,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfillment_apply(uuid[],jsonb,text,uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.fulfillment_create_service(p_items uuid[],p_so jsonb,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s service_orders; uid uuid; sid uuid; ids uuid[]; d jsonb; result jsonb; BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 uid:=(p_so->>'user_id')::uuid; PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,6913));
 SELECT fulfillment_service_order_id INTO sid FROM orders WHERE fulfillment_operation_key=p_key LIMIT 1;
 IF sid IS NOT NULL THEN SELECT * INTO s FROM service_orders WHERE id=sid AND user_id=uid; IF NOT FOUND THEN RAISE EXCEPTION 'Confirmação inválida'; END IF; RETURN to_jsonb(s); END IF;
 PERFORM 1 FROM card_stack_items WHERE id=ANY(p_items) ORDER BY id FOR UPDATE;
 IF coalesce(array_length(p_items,1),0)=0 OR (SELECT count(*) FROM card_stack_items WHERE id=ANY(p_items) AND user_id=uid AND status='stored' AND service_order_id IS NULL AND stack_id=(p_so->>'stack_id')::uuid)<>(SELECT count(DISTINCT x) FROM unnest(p_items) x) THEN RAISE EXCEPTION 'Itens indisponíveis'; END IF;
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.service_orders,p_so);
 INSERT INTO service_orders(user_id,stack_id,method,status,amount_cents,shipping_cost_cents,recipient_name,cep,street,number,complement,neighborhood,city,state,phone,event_id,scheduled_at,schedule_kind,fee_status,notes,arte_em_cards_code)
 VALUES(uid,s.stack_id,s.method,s.status,coalesce(s.amount_cents,0),coalesce(s.shipping_cost_cents,0),s.recipient_name,s.cep,s.street,s.number,s.complement,s.neighborhood,s.city,s.state,s.phone,s.event_id,s.scheduled_at,s.schedule_kind,s.fee_status,s.notes,s.arte_em_cards_code) RETURNING * INTO s;
 UPDATE card_stack_items SET status=CASE WHEN s.status='delivered' THEN 'delivered' WHEN s.status='dispatched' THEN 'dispatched' ELSE 'requested' END,service_order_id=s.id,updated_at=now() WHERE id=ANY(p_items);
 SELECT array_agg(DISTINCT order_id) FILTER(WHERE order_id IS NOT NULL) INTO ids FROM card_stack_items WHERE id=ANY(p_items);
 IF ids IS NOT NULL THEN
 d:=jsonb_build_object('shipping_method',CASE WHEN s.method='correios' THEN 'fixed' WHEN s.method='arte_em_cards' THEN 'arte_em_cards' ELSE 'arrange' END,'schedule_kind',s.schedule_kind,'scheduled_at',s.scheduled_at,'event_id',s.event_id,'notes',s.notes,'cep',s.cep,'street',s.street,'number',s.number,'complement',s.complement,'neighborhood',s.neighborhood,'city',s.city,'state',s.state,'hand_delivery_fee_status',s.fee_status,'group_shipping_cents',CASE WHEN s.method='app' THEN 1500 ELSE s.shipping_cost_cents END,'service_code',s.code);
 result:=public.fulfillment_apply(ids,d,p_key,s.id,NULL,false);
 END IF;
 RETURN to_jsonb(s);
END $$;
REVOKE ALL ON FUNCTION public.fulfillment_create_service(uuid[],jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfillment_create_service(uuid[],jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.fulfillment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF coalesce(auth.role(),'')<>'service_role' AND current_user NOT IN ('postgres','supabase_admin') AND (NEW.fulfillment_group_id IS DISTINCT FROM OLD.fulfillment_group_id OR NEW.fulfillment_data IS DISTINCT FROM OLD.fulfillment_data OR NEW.is_group_primary IS DISTINCT FROM OLD.is_group_primary OR NEW.fulfillment_service_order_id IS DISTINCT FROM OLD.fulfillment_service_order_id OR NEW.fulfillment_group_code IS DISTINCT FROM OLD.fulfillment_group_code OR NEW.fulfillment_operation_key IS DISTINCT FROM OLD.fulfillment_operation_key OR NEW.fulfillment_history IS DISTINCT FROM OLD.fulfillment_history) THEN RAISE EXCEPTION 'Use a confirmação segura do grupo'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER orders_fulfillment_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION public.fulfillment_guard();