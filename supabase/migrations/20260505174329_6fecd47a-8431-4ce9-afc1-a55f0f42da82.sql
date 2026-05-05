CREATE TABLE public.price_update_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running',
  total_variants INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL DEFAULT 'cron',
  notes TEXT
);

ALTER TABLE public.price_update_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view price update runs"
ON public.price_update_runs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;