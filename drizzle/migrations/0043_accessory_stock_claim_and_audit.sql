CREATE FUNCTION public.accessory_claim_order_stock(p_order uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed boolean;
BEGIN
 SELECT stock_decremented INTO claimed FROM public.orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR claimed THEN RETURN false; END IF;
 PERFORM public.accessory_decrement_order(p_order);
 UPDATE public.orders SET stock_decremented=true WHERE id=p_order;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.accessory_claim_order_stock(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accessory_claim_order_stock(uuid) TO service_role;
CREATE FUNCTION public.accessory_validate_variants() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 IF NEW.stock<0 THEN RAISE EXCEPTION 'Estoque não pode ser negativo'; END IF;
 IF jsonb_typeof(NEW.variants)<>'array' THEN RAISE EXCEPTION 'Variações inválidas'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(NEW.variants) LOOP
 IF coalesce(v->>'id','')='' OR coalesce(v->>'name','')='' OR (v->>'stock') IS NULL OR (v->>'stock')::numeric<0 OR (v->>'stock')::numeric<>trunc((v->>'stock')::numeric) THEN RAISE EXCEPTION 'Nome e estoque da variação são obrigatórios'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(NEW.variants))<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.variants)) THEN RAISE EXCEPTION 'Variações duplicadas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accessory_validate_stock BEFORE INSERT OR UPDATE OF stock,variants ON public.accessories FOR EACH ROW EXECUTE FUNCTION public.accessory_validate_variants();
CREATE FUNCTION public.accessory_audit_variants() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_stock integer; after_stock integer;
BEGIN
 SELECT coalesce(sum((value->>'stock')::integer),0) INTO before_stock FROM jsonb_array_elements(OLD.variants);
 SELECT coalesce(sum((value->>'stock')::integer),0) INTO after_stock FROM jsonb_array_elements(NEW.variants);
 IF before_stock<>after_stock THEN INSERT INTO public.product_stock_changes(product_table,product_id,title,previous_stock,new_stock,delta,changed_by) VALUES('accessories',NEW.id,NEW.title,before_stock,after_stock,after_stock-before_stock,auth.uid()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accessory_variant_stock_history AFTER UPDATE OF variants ON public.accessories FOR EACH ROW WHEN (OLD.variants IS DISTINCT FROM NEW.variants) EXECUTE FUNCTION public.accessory_audit_variants();
REVOKE ALL ON FUNCTION public.accessory_validate_variants(),public.accessory_audit_variants() FROM PUBLIC;