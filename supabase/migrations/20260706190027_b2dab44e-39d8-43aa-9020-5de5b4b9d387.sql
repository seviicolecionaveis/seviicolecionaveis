
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS batch_id text;
CREATE INDEX IF NOT EXISTS idx_email_send_log_batch ON public.email_send_log(batch_id, template_name);
CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
