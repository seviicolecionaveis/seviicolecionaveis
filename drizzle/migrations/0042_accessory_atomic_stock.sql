CREATE TABLE public.accessory_stock_reservations (order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, accessory_id uuid NOT NULL REFERENCES public.accessories(id) ON DELETE CASCADE, variant_id text NOT NULL DEFAULT '', quantity integer NOT NULL CHECK(quantity>0), expires_at timestamptz NOT NULL, PRIMARY KEY(order_id,accessory_id,variant_id));
GRANT ALL ON public.accessory_stock_reservations TO service_role;
ALTER TABLE public.accessory_stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.accessory_stock_movements (order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, accessory_id uuid NOT NULL REFERENCES public.accessories(id), variant_id text NOT NULL DEFAULT '', quantity integer NOT NULL CHECK(quantity>0), restored boolean NOT NULL DEFAULT false, PRIMARY KEY(order_id,accessory_id,variant_id));
GRANT ALL ON public.accessory_stock_movements TO service_role;
ALTER TABLE public.accessory_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.accessory_reserve_order(p_order uuid,p_expires timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it record; a public.accessories; available integer; reserved integer; vid text;
BEGIN
 PERFORM pg_advisory_xact_lock(84723412);
 FOR it IN SELECT split_part(card_id,':',2)::uuid aid,coalesce(split_part(card_id,':',3),'') vid,sum(quantity)::integer qty FROM public.order_items WHERE order_id=p_order AND card_id LIKE 'accessory:%' GROUP BY 1,2 ORDER BY 1,2 LOOP
 SELECT * INTO a FROM public.accessories WHERE id=it.aid FOR UPDATE;
 IF NOT FOUND OR NOT a.active THEN RAISE EXCEPTION 'Acessório indisponível'; END IF;
 IF it.vid='' THEN IF jsonb_array_length(a.variants)>0 THEN RAISE EXCEPTION 'Selecione uma variação'; END IF; available:=a.stock;
 ELSE SELECT (v->>'stock')::integer INTO available FROM jsonb_array_elements(a.variants) v WHERE v->>'id'=it.vid; END IF;
 SELECT coalesce(sum(quantity),0) INTO reserved FROM public.accessory_stock_reservations WHERE accessory_id=it.aid AND variant_id=it.vid AND order_id<>p_order AND expires_at>now();
 IF available IS NULL OR available-reserved<it.qty THEN RAISE EXCEPTION 'Estoque insuficiente para %',a.title; END IF;
 INSERT INTO public.accessory_stock_reservations VALUES(p_order,it.aid,it.vid,it.qty,p_expires) ON CONFLICT(order_id,accessory_id,variant_id) DO UPDATE SET quantity=EXCLUDED.quantity,expires_at=EXCLUDED.expires_at;
 END LOOP;
END $$;
CREATE FUNCTION public.accessory_decrement_order(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it record; a public.accessories; available integer; reserved integer;
BEGIN
 PERFORM pg_advisory_xact_lock(84723412);
 FOR it IN SELECT split_part(card_id,':',2)::uuid aid,coalesce(split_part(card_id,':',3),'') vid,sum(quantity)::integer qty FROM public.order_items WHERE order_id=p_order AND card_id LIKE 'accessory:%' GROUP BY 1,2 ORDER BY 1,2 LOOP
 IF EXISTS(SELECT 1 FROM public.accessory_stock_movements WHERE order_id=p_order AND accessory_id=it.aid AND variant_id=it.vid) THEN CONTINUE; END IF;
 SELECT * INTO a FROM public.accessories WHERE id=it.aid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Acessório não encontrado'; END IF;
 IF it.vid='' THEN available:=a.stock; ELSE SELECT (v->>'stock')::integer INTO available FROM jsonb_array_elements(a.variants) v WHERE v->>'id'=it.vid; END IF;
 SELECT coalesce(sum(quantity),0) INTO reserved FROM public.accessory_stock_reservations WHERE accessory_id=it.aid AND variant_id=it.vid AND order_id<>p_order AND expires_at>now();
 IF available IS NULL OR available-reserved<it.qty THEN RAISE EXCEPTION 'Estoque insuficiente para %',a.title; END IF;
 IF it.vid='' THEN UPDATE public.accessories SET stock=stock-it.qty WHERE id=it.aid;
 ELSE UPDATE public.accessories SET variants=(SELECT jsonb_agg(CASE WHEN v->>'id'=it.vid THEN jsonb_set(v,'{stock}',to_jsonb(available-it.qty)) ELSE v END) FROM jsonb_array_elements(variants) v) WHERE id=it.aid; END IF;
 INSERT INTO public.accessory_stock_movements VALUES(p_order,it.aid,it.vid,it.qty,false);
 END LOOP;
 DELETE FROM public.accessory_stock_reservations WHERE order_id=p_order;
END $$;
CREATE FUNCTION public.accessory_restore_order(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it record; a public.accessories; available integer;
BEGIN
 PERFORM pg_advisory_xact_lock(84723412);
 FOR it IN SELECT split_part(card_id,':',2)::uuid aid,coalesce(split_part(card_id,':',3),'') vid,sum(greatest(quantity-coalesce(cancelled_quantity,0),0))::integer qty FROM public.order_items WHERE order_id=p_order AND card_id LIKE 'accessory:%' GROUP BY 1,2 ORDER BY 1,2 LOOP
 IF it.qty<=0 OR EXISTS(SELECT 1 FROM public.accessory_stock_movements WHERE order_id=p_order AND accessory_id=it.aid AND variant_id=it.vid AND restored) THEN CONTINUE; END IF;
 SELECT * INTO a FROM public.accessories WHERE id=it.aid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Acessório não encontrado'; END IF;
 IF it.vid='' THEN UPDATE public.accessories SET stock=stock+it.qty WHERE id=it.aid;
 ELSE SELECT (v->>'stock')::integer INTO available FROM jsonb_array_elements(a.variants) v WHERE v->>'id'=it.vid;
 IF available IS NULL THEN RAISE EXCEPTION 'Variação não encontrada'; END IF;
 UPDATE public.accessories SET variants=(SELECT jsonb_agg(CASE WHEN v->>'id'=it.vid THEN jsonb_set(v,'{stock}',to_jsonb(available+it.qty)) ELSE v END) FROM jsonb_array_elements(variants) v) WHERE id=it.aid; END IF;
 INSERT INTO public.accessory_stock_movements VALUES(p_order,it.aid,it.vid,it.qty,true) ON CONFLICT(order_id,accessory_id,variant_id) DO UPDATE SET restored=true;
 END LOOP;
 DELETE FROM public.accessory_stock_reservations WHERE order_id=p_order;
END $$;
REVOKE ALL ON FUNCTION public.accessory_reserve_order(uuid,timestamptz),public.accessory_decrement_order(uuid),public.accessory_restore_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accessory_reserve_order(uuid,timestamptz),public.accessory_decrement_order(uuid),public.accessory_restore_order(uuid) TO service_role;