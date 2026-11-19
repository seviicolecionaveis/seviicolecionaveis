CREATE FUNCTION pg_temp.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.fixture() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 DELETE FROM auction_winner_changes; DELETE FROM card_stack_items; DELETE FROM customer_payment_attempts; DELETE FROM order_items; DELETE FROM orders; DELETE FROM auction_bids; DELETE FROM auction_items; DELETE FROM auctions; DELETE FROM profiles; DELETE FROM auth.users; DELETE FROM user_roles;
 INSERT INTO auth.users(id,email) VALUES('00000000-0000-0000-0000-000000000001','admin@test.invalid'),('00000000-0000-0000-0000-000000000002','old@test.invalid'),('00000000-0000-0000-0000-000000000003','new@test.invalid'),('00000000-0000-0000-0000-000000000004','other@test.invalid');
 INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000002','Old','79911111111',NULL),('00000000-0000-0000-0000-000000000003','New','79922222222',NULL),('00000000-0000-0000-0000-000000000004','Other','79933333333',NULL);
 INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000001','admin');
 INSERT INTO auctions VALUES('10000000-0000-0000-0000-000000000001','finished');
 INSERT INTO auction_items VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'Ho-Oh',1,5,'5579911111111','Old','sold');
 INSERT INTO orders(id,user_id,status,origin,auction_id,subtotal_cents,total_cents,recipient_name) VALUES('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','pending','auction','10000000-0000-0000-0000-000000000001',1500,1500,'Old'),('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','pending','auction','10000000-0000-0000-0000-000000000001',700,700,'New');
 INSERT INTO order_items(id,order_id,card_id,card_name,quantity,unit_price_cents) VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','auction:20000000-0000-0000-0000-000000000001','Ho-Oh',1,500),('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','other','Other card',1,1000),('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','other2','Destination card',1,700);
 INSERT INTO auction_bids(id,auction_id,item_id,sequence,item_name,phone,bidder_name,amount,status,order_id,created_at) VALUES
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Ho-Oh','5579911111111','Old',5,'order_created','30000000-0000-0000-0000-000000000001','2026-11-18 23:00:00Z'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Ho-Oh','5579922222222','New',3,'pending',NULL,'2026-11-18 22:00:00Z'),
 ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Ho-Oh','5579933333333','Other',4,'retracted',NULL,'2026-11-18 21:00:00Z'),
 ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Ho-Oh','79911111111','Old alternate',4,'pending',NULL,'2026-11-18 21:00:00Z');
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
END $$;
CREATE FUNCTION pg_temp.change_it() RETURNS jsonb LANGUAGE sql AS $$ SELECT admin_change_auction_winner('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',300,'Clique sem querer','60000000-0000-0000-0000-000000000001') $$;
CREATE FUNCTION pg_temp.expect_error(query text,pattern text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%'||pattern||'%' THEN RETURN; ELSE RAISE; END IF; END;
 RAISE EXCEPTION 'Expected error: %',pattern;
END $$;
SELECT pg_temp.fixture();
SELECT pg_temp.assert_true((admin_preview_auction_winner_change('20000000-0000-0000-0000-000000000001')->>'amountCents')::integer=300,'previous valid other bidder is R$3; excludes retracted and same-account bids');
SELECT pg_temp.change_it();
SELECT pg_temp.assert_true((SELECT subtotal_cents=1000 AND total_cents=1000 AND status='pending' FROM orders WHERE id='30000000-0000-0000-0000-000000000001'),'source keeps R$10');
SELECT pg_temp.assert_true((SELECT subtotal_cents=1000 AND total_cents=1000 FROM orders WHERE id='30000000-0000-0000-0000-000000000002'),'destination adds R$3');
SELECT pg_temp.assert_true((SELECT order_id='30000000-0000-0000-0000-000000000002' AND unit_price_cents=300 FROM order_items WHERE id='40000000-0000-0000-0000-000000000001'),'only chosen item moves');
SELECT pg_temp.assert_true((SELECT unit_price_cents=1000 AND order_id='30000000-0000-0000-0000-000000000001' FROM order_items WHERE id='40000000-0000-0000-0000-000000000002'),'other item unchanged');
SELECT pg_temp.assert_true((SELECT final_bid=3 AND winner_name='New' FROM auction_items),'tracking reflects new winner');
SELECT pg_temp.assert_true((pg_temp.change_it()->>'alreadyApplied')::boolean,'repeat confirmation returns original operation');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM auction_winner_changes),'single audit');
SELECT pg_temp.expect_error($q$SELECT admin_change_auction_winner('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',300,'Different reason','60000000-0000-0000-0000-000000000001')$q$,'Confirmação já usada');
SELECT pg_temp.fixture(); UPDATE orders SET status='paid' WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','Troca bloqueada');
SELECT pg_temp.fixture(); UPDATE orders SET mercadopago_payment_id='123' WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','Troca bloqueada');
SELECT pg_temp.fixture(); INSERT INTO customer_payment_attempts VALUES('30000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','Troca bloqueada');
SELECT pg_temp.fixture(); SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','Active administrator required');
SELECT pg_temp.fixture(); UPDATE auctions SET status='live';
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','encerrados');
SELECT pg_temp.fixture(); UPDATE auction_bids SET amount=3.01 WHERE id='50000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','arremate mudou');
SELECT pg_temp.fixture(); UPDATE orders SET total_cents=1501 WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_error('SELECT pg_temp.change_it()','total do pedido original');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM auction_winner_changes),'failed change has no audit');
SELECT pg_temp.assert_true((SELECT order_id='30000000-0000-0000-0000-000000000001' FROM order_items WHERE id='40000000-0000-0000-0000-000000000001'),'failed change rolled back');
SELECT pg_temp.fixture(); UPDATE orders SET status='paid' WHERE id='30000000-0000-0000-0000-000000000002';
SELECT pg_temp.change_it();
SELECT pg_temp.assert_true((SELECT total_cents=700 AND status='paid' FROM orders WHERE id='30000000-0000-0000-0000-000000000002'),'paid destination preserved');
SELECT pg_temp.assert_true((SELECT total_cents=300 AND status='pending' FROM orders WHERE id=(SELECT target_order_id FROM auction_winner_changes)),'separate new pending order');
SELECT pg_temp.fixture(); DELETE FROM order_items WHERE id='40000000-0000-0000-0000-000000000002'; UPDATE orders SET subtotal_cents=500,total_cents=500 WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.change_it();
SELECT pg_temp.assert_true((SELECT status='cancelled' AND subtotal_cents=0 FROM orders WHERE id='30000000-0000-0000-0000-000000000001'),'empty source cancelled');
SELECT pg_temp.fixture(); UPDATE auction_bids SET phone='123456789012345' WHERE id='50000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((admin_preview_auction_winner_change('20000000-0000-0000-0000-000000000001')->>'needsIdentification')::boolean,'internal code needs explicit customer identification');
SELECT pg_temp.change_it();
SELECT pg_temp.assert_true((SELECT new_user_id='00000000-0000-0000-0000-000000000003' FROM auction_winner_changes),'explicit internal-code account accepted');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','admin_change_auction_winner(uuid,uuid,uuid,uuid,integer,text,uuid)','EXECUTE'),'anonymous cannot change winners');
SELECT 'All auction winner reassignment checks passed' AS result;
