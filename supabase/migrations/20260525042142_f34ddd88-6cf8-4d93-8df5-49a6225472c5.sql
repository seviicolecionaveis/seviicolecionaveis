SELECT cron.unschedule('auto-cancel-unpaid-orders');

DO $$
DECLARE
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret email_queue_service_role_key not found; cannot schedule authenticated cron';
  END IF;

  PERFORM cron.schedule(
    'auto-cancel-unpaid-orders',
    '*/2 * * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://project--392637a4-5b2d-43f0-a643-ac0dba0c2366.lovable.app/api/public/hooks/auto-cancel-unpaid',
        headers := %L::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
    $cron$, json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::text)
  );
END $$;