SELECT set_config('request.jwt.claim.role','service_role',false);
DO $$
DECLARE uid uuid:=gen_random_uuid(); old_id uuid:=gen_random_uuid(); untouched uuid:=gen_random_uuid(); n uuid; r jsonb; snapshot jsonb; m text; scenario text;
BEGIN
 INSERT INTO orders(id,user_id,status,origin,total_cents,shipping_method,scheduled_at,schedule_kind) VALUES(old_id,uid,'paid','auction',2849,'card_stack','2030-01-02T17:00:00Z','pickup'),(untouched,uid,'paid','site',1000,'card_stack','2030-01-02T18:00:00Z','pickup');
 SELECT to_jsonb(o) INTO snapshot FROM orders o WHERE id=old_id;
 FOREACH scenario IN ARRAY ARRAY['abandoned','cancelled','rejected'] LOOP
 n:=gen_random_uuid(); INSERT INTO orders(id,user_id,status,origin) VALUES(n,uid,'pending','site');
 PERFORM save_checkout_fulfillment_intent(n,uid,ARRAY[old_id],'{"shipping_method":"arrange","schedule_kind":"pickup","scheduled_at":"2030-01-03T17:00:00Z"}');
 IF scenario<>'abandoned' THEN UPDATE orders SET status='cancelled' WHERE id=n; END IF;
 r:=process_checkout_fulfillment_intent(n);
 IF r->>'state'<>'unpaid' OR (SELECT to_jsonb(o) FROM orders o WHERE id=old_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Unpaid checkout changed prior order: %',scenario; END IF;
 END LOOP;
 FOREACH m IN ARRAY ARRAY['pickup','event','delivery'] LOOP
 n:=gen_random_uuid(); INSERT INTO orders(id,user_id,status,origin) VALUES(n,uid,'pending','site');
 PERFORM save_checkout_fulfillment_intent(n,uid,ARRAY[old_id],jsonb_build_object('shipping_method','arrange','schedule_kind',m,'scheduled_at','2030-01-03T17:00:00Z'));
 IF (SELECT to_jsonb(o) FROM orders o WHERE id=old_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Creation altered prior %',m; END IF;
 END LOOP;
 -- Confirmed payment applies once and only to selected members.
 n:=gen_random_uuid(); INSERT INTO orders(id,user_id,status,origin,total_cents) VALUES(n,uid,'pending','site',500);
 PERFORM save_checkout_fulfillment_intent(n,uid,ARRAY[old_id],'{"shipping_method":"arrange","schedule_kind":"pickup","scheduled_at":"2030-01-03T17:00:00Z"}');
 UPDATE orders SET status='paid' WHERE id=n;
 r:=process_checkout_fulfillment_intent(n);
 IF r->>'state'<>'applied' THEN RAISE EXCEPTION 'Paid did not apply: %',r; END IF;
 IF (SELECT fulfillment_data->>'scheduled_at' FROM orders WHERE id=old_id)<>'2030-01-03T17:00:00Z' THEN RAISE EXCEPTION 'Selected not moved'; END IF;
 IF (SELECT fulfillment_group_id FROM orders WHERE id=untouched) IS NOT NULL THEN RAISE EXCEPTION 'Unselected changed'; END IF;
 SELECT to_jsonb(o) INTO snapshot FROM orders o WHERE id=old_id;
 PERFORM process_checkout_fulfillment_intent(n);
 IF (SELECT to_jsonb(o) FROM orders o WHERE id=old_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Retry reapplied'; END IF;
 IF (SELECT total_cents FROM orders WHERE id=old_id)<>2849 OR (SELECT origin FROM orders WHERE id=old_id)<>'auction' THEN RAISE EXCEPTION 'Financial or auction data altered'; END IF;
 -- Unavailable times preserve all previous data even after payment.
 n:=gen_random_uuid(); INSERT INTO orders(id,user_id,status,origin) VALUES(n,uid,'pending','site');
 PERFORM save_checkout_fulfillment_intent(n,uid,ARRAY[old_id],'{"shipping_method":"arrange","schedule_kind":"pickup","scheduled_at":"2020-01-03T17:00:00Z"}');
 UPDATE orders SET status='paid' WHERE id=n;
 r:=process_checkout_fulfillment_intent(n);
 IF r->>'state'<>'needs_review' OR (SELECT to_jsonb(o) FROM orders o WHERE id=old_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Expired choice changed previous'; END IF;
 -- Member status changed since checkout: preserve prior schedule/group.
 n:=gen_random_uuid(); INSERT INTO orders(id,user_id,status,origin) VALUES(n,uid,'pending','site');
 PERFORM save_checkout_fulfillment_intent(n,uid,ARRAY[old_id],'{"shipping_method":"arrange","schedule_kind":"pickup","scheduled_at":"2030-01-04T17:00:00Z"}');
 UPDATE orders SET status='shipped' WHERE id=old_id;
 SELECT to_jsonb(o) INTO snapshot FROM orders o WHERE id=old_id;
 UPDATE orders SET status='paid' WHERE id=n;
 r:=process_checkout_fulfillment_intent(n);
 IF r->>'state'<>'needs_review' OR (SELECT to_jsonb(o) FROM orders o WHERE id=old_id) IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Unavailable member changed'; END IF;
 -- Service-only RPC checks callers even with execute rights accidentally granted.
 PERFORM set_config('request.jwt.claim.role','authenticated',false);
 BEGIN PERFORM process_checkout_fulfillment_intent(n); RAISE EXCEPTION 'Unauthorized allowed'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM='Unauthorized allowed' THEN RAISE; END IF; END;
END $$;