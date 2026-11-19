CREATE TABLE public.checkout_fulfillment_intents (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 user_id uuid NOT NULL,
 selected_ids uuid[] NOT NULL,
 choice jsonb NOT NULL,
 existing_group_id uuid,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','applied','needs_review')),
 group_id uuid,
 previous_schedules text,
 failure_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);
GRANT ALL ON public.checkout_fulfillment_intents TO service_role;
ALTER TABLE public.checkout_fulfillment_intents ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.save_checkout_fulfillment_intent(p_order uuid,p_user uuid,p_ids uuid[],p_choice jsonb,p_existing uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=p_order AND user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'Pedido indisponível'; END IF;
 IF coalesce(array_length(p_ids,1),0)=0 OR array_length(p_ids,1)>499 OR EXISTS(SELECT 1 FROM unnest(p_ids) x WHERE x IS NULL) THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
 IF (SELECT count(*) FROM orders WHERE id=ANY(p_ids) AND user_id=p_user AND status NOT IN ('delivered','cancelled','shipped','refunded','cancellation_requested') AND (origin IS DISTINCT FROM 'auction' OR status IN ('paid','preparing','separated','awaiting_pickup','cards_pending_delivery')))<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN RAISE EXCEPTION 'Pedidos selecionados indisponíveis'; END IF;
 INSERT INTO checkout_fulfillment_intents(order_id,user_id,selected_ids,choice,existing_group_id) VALUES(p_order,p_user,p_ids,p_choice,p_existing);
END $$;
REVOKE ALL ON FUNCTION public.save_checkout_fulfillment_intent(uuid,uuid,uuid[],jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_checkout_fulfillment_intent(uuid,uuid,uuid[],jsonb,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.process_checkout_fulfillment_intent(p_order uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i checkout_fulfillment_intents; uid uuid; result jsonb; ids uuid[]; prior text;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT user_id INTO uid FROM checkout_fulfillment_intents WHERE order_id=p_order;
 IF uid IS NULL THEN RETURN jsonb_build_object('state','none'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,6913));
 SELECT * INTO i FROM checkout_fulfillment_intents WHERE order_id=p_order FOR UPDATE;
 IF i.state<>'pending' THEN RETURN to_jsonb(i); END IF;
 IF NOT EXISTS(SELECT 1 FROM orders WHERE id=p_order AND user_id=i.user_id AND status IN ('paid','preparing','separated','awaiting_pickup','cards_pending_delivery')) THEN RETURN jsonb_build_object('state','unpaid'); END IF;
 SELECT array_agg(DISTINCT x) INTO ids FROM unnest(array_prepend(p_order,i.selected_ids)) x;
 SELECT string_agg('#'||left(id::text,8)||': '||coalesce(fulfillment_data->>'schedule_kind',schedule_kind,'')||' '||coalesce(fulfillment_data->>'scheduled_at',scheduled_at::text,''),'; ' ORDER BY id) INTO prior FROM orders WHERE id=ANY(i.selected_ids) AND coalesce(fulfillment_data->>'scheduled_at',scheduled_at::text) IS NOT NULL;
 BEGIN
 IF EXISTS(SELECT 1 FROM orders WHERE id=ANY(ids) AND user_id IS DISTINCT FROM i.user_id) THEN RAISE EXCEPTION 'Pedidos não pertencem ao mesmo cliente'; END IF;
 result:=public.fulfillment_apply(ids,i.choice,'checkout:'||p_order::text,NULL,i.existing_group_id,false);
 UPDATE checkout_fulfillment_intents SET state='applied',group_id=(result->>'group_id')::uuid,previous_schedules=prior,processed_at=now() WHERE order_id=p_order RETURNING * INTO i;
 EXCEPTION WHEN SQLSTATE 'P0001' OR data_exception THEN
 UPDATE checkout_fulfillment_intents SET state='needs_review',failure_reason='Não foi possível incluir os pedidos no agendamento escolhido. Os agendamentos anteriores foram preservados. Entre em contato com a loja para revisar a inclusão.',previous_schedules=prior,processed_at=now() WHERE order_id=p_order RETURNING * INTO i;
 END;
 RETURN to_jsonb(i);
END $$;
REVOKE ALL ON FUNCTION public.process_checkout_fulfillment_intent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_fulfillment_intent(uuid) TO service_role;