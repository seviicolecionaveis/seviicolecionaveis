SELECT set_config('request.jwt.claim.role','service_role',false);
INSERT INTO orders(id,user_id,status,origin,created_at,total_cents,shipping_cost_cents,shipping_method) VALUES
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','paid','site','2026-10-01',10000,2500,'card_stack'),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','paid','auction','2026-10-02',5000,0,'card_stack'),
('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','shipped','site','2026-10-03',5000,0,'fixed');
SELECT fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[], '{"shipping_method":"arrange","schedule_kind":"delivery","scheduled_at":"2030-01-03T22:00:00Z","city":"Aracaju","state":"SE","group_shipping_cents":1500,"hand_delivery_fee_status":"pending"}','test-group-001');
DO $$ DECLARE d jsonb; BEGIN
 IF (SELECT sum((fulfillment_data->>'shipping_cost_cents')::integer) FROM orders)<>1500 THEN RAISE EXCEPTION 'Fee must be 1500 once'; END IF;
 IF (SELECT total_cents FROM orders WHERE origin='auction')<>5000 OR (SELECT shipping_cost_cents FROM orders WHERE id='10000000-0000-0000-0000-000000000001')<>2500 THEN RAISE EXCEPTION 'Financial fields changed'; END IF;
 IF (SELECT shipping_method FROM orders WHERE origin='auction')<>'card_stack' THEN RAISE EXCEPTION 'Auction altered'; END IF;
 d:=fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[], '{"shipping_method":"arrange","schedule_kind":"delivery","scheduled_at":"2030-01-03T22:00:00Z","city":"Aracaju","state":"SE","group_shipping_cents":1500}','test-group-001');
 IF NOT (d->>'duplicate')::boolean THEN RAISE EXCEPTION 'Not idempotent'; END IF;
 BEGIN PERFORM fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000003']::uuid[],'{"shipping_method":"fixed"}','test-shipped-001'); RAISE EXCEPTION 'Shipped allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Shipped allowed' THEN RAISE; END IF; END;
 BEGIN PERFORM fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000002']::uuid[],'{"shipping_method":"arrange","schedule_kind":"pickup","scheduled_at":"2020-01-01T17:00:00Z"}','test-expired-001'); RAISE EXCEPTION 'Expired allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Expired allowed' THEN RAISE; END IF; END;
 BEGIN PERFORM fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000002']::uuid[],'{"shipping_method":"arrange","schedule_kind":"delivery","scheduled_at":"2030-01-03T22:00:00Z","city":"Salvador","state":"BA","group_shipping_cents":1500}','test-outside-001'); RAISE EXCEPTION 'Outside allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Outside allowed' THEN RAISE; END IF; END;
END $$;
SELECT fulfillment_group_action('10000000-0000-0000-0000-000000000001','fee','{"confirmed":true}');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM orders WHERE fulfillment_group_id IS NOT NULL AND fulfillment_data->>'hand_delivery_fee_status'<>'confirmed') THEN RAISE EXCEPTION 'Fee not propagated'; END IF; END $$;
SELECT fulfillment_deliver('10000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 IF (SELECT fulfillment_group_id FROM orders WHERE id='10000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Delivered member not detached'; END IF;
 IF (SELECT (fulfillment_data->>'shipping_cost_cents')::integer FROM orders WHERE origin='auction')<>1500 THEN RAISE EXCEPTION 'Primary fee not transferred'; END IF;
END $$;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
 BEGIN PERFORM fulfillment_apply(ARRAY['10000000-0000-0000-0000-000000000002']::uuid[],'{"shipping_method":"fixed"}','unauthorized-001'); RAISE EXCEPTION 'Unauthorized allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN OTHERS THEN IF SQLERRM='Unauthorized allowed' THEN RAISE; END IF; END;
END $$;
