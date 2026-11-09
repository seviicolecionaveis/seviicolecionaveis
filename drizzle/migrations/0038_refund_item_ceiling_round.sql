DO $mig$ DECLARE d text; BEGIN
d := pg_get_functiondef('public.finance_create_refund(uuid,uuid,uuid,bigint,text,text,text)'::regprocedure);
d := replace(d, 'SELECT floor(unit_price_cents::numeric*quantity*', 'SELECT round(unit_price_cents::numeric*quantity*');
IF position('SELECT round(unit_price_cents' in d)=0 THEN RAISE EXCEPTION 'pattern not found'; END IF;
EXECUTE d;
END $mig$;