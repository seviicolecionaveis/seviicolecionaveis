BEGIN;
ALTER TABLE public.order_items ADD COLUMN cancelled_quantity integer DEFAULT 0, ADD COLUMN cancelled_at timestamptz, ADD COLUMN refund_method text, ADD COLUMN refund_notes text;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000011','admin');
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000012');
INSERT INTO public.orders(id,user_id,status,total_cents,subtotal_cents,discount_cents) VALUES
('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','paid',2700,3000,300);
INSERT INTO public.order_items(id,order_id,quantity,unit_price_cents) VALUES
('20000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011',3,1000);
-- The application migration is applied after the fixture columns by the local runner.
\i drizzle/migrations/0021_item_cancellation_finance_integration.sql
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
DO $$ DECLARE r jsonb; again jsonb; rejected boolean; BEGIN
r:=public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',1,'Carta indisponível fictícia',repeat('a',64),'cancel-test-0001');
IF (r->>'amount_cents')::bigint<>900 OR (r->>'cancellation_quantity')::integer<>1 OR r->>'status'<>'awaiting_choice' THEN RAISE EXCEPTION 'Incorrect refund invitation'; END IF;
IF (SELECT cancelled_quantity FROM public.order_items WHERE id=(r->>'item_id')::uuid)<>1 THEN RAISE EXCEPTION 'Quantity not cancelled'; END IF;
IF (SELECT status FROM public.orders WHERE id=(r->>'order_id')::uuid)<>'paid' THEN RAISE EXCEPTION 'Rest of order changed'; END IF;
IF (SELECT refunded_cents FROM public.orders WHERE id=(r->>'order_id')::uuid)<>0 OR EXISTS(SELECT 1 FROM public.customer_credit_entries) THEN RAISE EXCEPTION 'Funds moved before choice'; END IF;
again:=public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',1,'Carta indisponível fictícia',repeat('b',64),'cancel-test-0001');
IF again->>'id'<>r->>'id' OR (SELECT cancelled_quantity FROM public.order_items WHERE id=(r->>'item_id')::uuid)<>1 THEN RAISE EXCEPTION 'Retry duplicated cancellation'; END IF;
rejected:=false; BEGIN PERFORM public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',2,'Carta indisponível fictícia',repeat('b',64),'cancel-test-0001'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
IF NOT rejected THEN RAISE EXCEPTION 'Changed retry accepted'; END IF;
rejected:=false; BEGIN PERFORM public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',3,'Quantidade fictícia',repeat('b',64),'cancel-test-0002'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
IF NOT rejected THEN RAISE EXCEPTION 'Excess quantity accepted'; END IF;
rejected:=false; BEGIN PERFORM public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000012',1,'Outro pedido fictício',repeat('b',64),'cancel-test-0003'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
IF NOT rejected THEN RAISE EXCEPTION 'Wrong item accepted'; END IF;
PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
rejected:=false; BEGIN PERFORM public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',1,'Cliente não administrador',repeat('b',64),'cancel-test-0004'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
IF NOT rejected THEN RAISE EXCEPTION 'Customer cancelled item'; END IF;
PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-0000-0000-000000000011';
rejected:=false; BEGIN PERFORM public.finance_cancel_item_refund('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011',1,'Admin bloqueado fictício',repeat('b',64),'cancel-test-0005'); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
IF NOT rejected THEN RAISE EXCEPTION 'Banned admin accepted'; END IF;
PERFORM public.finance_choose_refund((r->>'id')::uuid,repeat('a',64),'credit');
IF (SELECT refunded_cents FROM public.orders WHERE id=(r->>'order_id')::uuid)<>900 OR (SELECT refund_cents FROM public.order_items WHERE id=(r->>'item_id')::uuid)<>900 THEN RAISE EXCEPTION 'Completed accounting duplicated or missing'; END IF;
IF (SELECT balance_cents FROM public.customer_credit_accounts WHERE user_id='00000000-0000-0000-0000-000000000012')<>900 THEN RAISE EXCEPTION 'Choice credit incorrect'; END IF;
END $$;
ROLLBACK;