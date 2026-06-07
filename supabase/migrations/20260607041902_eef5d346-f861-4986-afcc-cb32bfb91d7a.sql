ALTER TABLE public.cards DROP COLUMN IF EXISTS created_by_email;

CREATE POLICY "Deny all access to melhorenvio_tokens"
ON public.melhorenvio_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

NOTIFY pgrst, 'reload schema';