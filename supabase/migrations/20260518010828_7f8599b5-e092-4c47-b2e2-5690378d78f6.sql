
CREATE TABLE public.melhorenvio_tokens (
  id integer PRIMARY KEY DEFAULT 1,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  scope text,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT melhorenvio_tokens_singleton CHECK (id = 1)
);

ALTER TABLE public.melhorenvio_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read melhorenvio tokens"
  ON public.melhorenvio_tokens FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage melhorenvio tokens"
  ON public.melhorenvio_tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER melhorenvio_tokens_updated_at
  BEFORE UPDATE ON public.melhorenvio_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
