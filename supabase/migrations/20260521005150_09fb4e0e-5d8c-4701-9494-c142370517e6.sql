SELECT cron.unschedule('auto-cancel-unpaid-orders');

SELECT cron.schedule(
  'auto-cancel-unpaid-orders',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--392637a4-5b2d-43f0-a643-ac0dba0c2366.lovable.app/api/public/hooks/auto-cancel-unpaid',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);