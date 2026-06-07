CREATE INDEX IF NOT EXISTS idx_email_send_log_idem
  ON public.email_send_log (
    template_name,
    recipient_email,
    ((metadata ->> 'idempotency_key'))
  )
  WHERE metadata ? 'idempotency_key';