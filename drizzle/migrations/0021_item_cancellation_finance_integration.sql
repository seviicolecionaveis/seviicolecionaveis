ALTER TABLE public.customer_refunds ADD COLUMN cancellation_quantity integer;
ALTER TABLE public.customer_refunds ADD CONSTRAINT refund_cancellation_quantity_positive CHECK (cancellation_quantity IS NULL OR (cancellation_quantity > 0 AND item_id IS NOT NULL));
CREATE FUNCTION public.finance_cancel_item_refund(p_order uuid,p_item uuid,p_quantity integer,p_reason text,p_hash text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid := auth.uid(); o public.orders; i public.order_items; r public.customer_refunds; amount bigint; result jsonb;
BEGIN
PERFORM public.finance_assert_admin(actor);
IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 OR p_key IS NULL OR length(p_key)<8 OR p_reason IS NULL OR length(trim(p_reason))<5 OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid cancellation'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_key,0));
SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Order missing'; END IF;
SELECT * INTO r FROM public.customer_refunds WHERE operation_key=p_key;
IF FOUND THEN
IF r.order_id IS DISTINCT FROM p_order OR r.item_id IS DISTINCT FROM p_item OR r.cancellation_quantity IS DISTINCT FROM p_quantity OR r.created_by IS DISTINCT FROM actor OR r.reason IS DISTINCT FROM p_reason THEN RAISE EXCEPTION 'Idempotency conflict'; END IF;
RETURN to_jsonb(r)-'token_hash'; END IF;
IF o.status NOT IN ('paid','preparing','separated','shipped','awaiting_pickup','cards_pending_delivery','delivered') THEN RAISE EXCEPTION 'Paid order required'; END IF;
SELECT * INTO i FROM public.order_items WHERE id=p_item AND order_id=p_order FOR UPDATE;
IF NOT FOUND OR p_quantity > i.quantity-coalesce(i.cancelled_quantity,0) THEN RAISE EXCEPTION 'Invalid remaining quantity'; END IF;
amount := round(i.unit_price_cents::numeric*p_quantity*greatest(0,least(1,1-coalesce(o.discount_cents,0)::numeric/coalesce(nullif(o.subtotal_cents,0),1))));
result := public.finance_create_refund(p_order,p_item,actor,amount,p_reason,p_hash,p_key);
UPDATE public.customer_refunds SET cancellation_quantity=p_quantity WHERE id=(result->>'id')::uuid RETURNING * INTO r;
UPDATE public.order_items SET cancelled_quantity=coalesce(cancelled_quantity,0)+p_quantity, cancelled_at=CASE WHEN coalesce(cancelled_quantity,0)+p_quantity>=quantity THEN now() ELSE NULL END, refund_method='customer_choice', refund_notes=p_reason WHERE id=p_item;
INSERT INTO public.customer_finance_audit(refund_id,order_id,user_id,actor_id,action,amount_cents,reason) VALUES(r.id,o.id,o.user_id,actor,'item_cancelled',amount,p_reason);
RETURN to_jsonb(r)-'token_hash';
END $$;
REVOKE ALL ON FUNCTION public.finance_cancel_item_refund(uuid,uuid,integer,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finance_cancel_item_refund(uuid,uuid,integer,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.finance_cancel_item_refund(uuid,uuid,integer,text,text,text) IS 'Authenticated active-admin item cancellation and refund invitation in one transaction. Does not restore stock or apply credit/refunds; completion uses existing finance choice workflow.';