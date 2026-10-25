BEGIN;
DO $$ DECLARE u uuid:='00000000-0000-0000-0000-000000000004'; o uuid:='10000000-0000-0000-0000-000000000004'; t uuid; b bigint; rejected boolean; r jsonb; BEGIN
SELECT id INTO t FROM customer_payment_attempts WHERE user_id=u AND status='reserved';
UPDATE customer_payment_attempts SET provider_id='fake-terminal' WHERE id=t;
PERFORM finance_release_payment(t,'fake-terminal');PERFORM finance_release_payment(t,'fake-terminal');
SELECT reserved_cents INTO b FROM customer_credit_accounts WHERE user_id=u;IF b<>0 THEN RAISE EXCEPTION 'release duplicated or failed';END IF;
rejected:=false;BEGIN PERFORM finance_settle_payment(t,'fake-terminal',2000,'BRL');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'late settlement passed';END IF;
UPDATE orders SET status='paid' WHERE id=o;
r:=finance_create_refund(o,NULL,'00000000-0000-0000-0000-000000000001',1000,'Link expirado fictício',repeat('a',64),'terminal-refund-expired');UPDATE customer_refunds SET token_expires_at=now()-interval '1 day' WHERE id=(r->>'id')::uuid;
rejected:=false;BEGIN PERFORM finance_choose_refund((r->>'id')::uuid,repeat('a',64),'credit');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'expired token passed';END IF;
PERFORM finance_refund_action((r->>'id')::uuid,'00000000-0000-0000-0000-000000000001','revoke','Revogado em teste');
rejected:=false;BEGIN PERFORM finance_choose_refund((r->>'id')::uuid,repeat('a',64),'credit');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'revoked token passed';END IF;
rejected:=false;BEGIN UPDATE customer_credit_entries SET description='editado';EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'ledger mutable';END IF;
RAISE NOTICE 'PASS: terminal release once, late settlement blocked, expired/revoked capability blocked, immutable history';END $$;
ROLLBACK;
