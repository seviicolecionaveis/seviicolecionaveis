
CREATE TABLE public.wishlist_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX wishlist_share_tokens_user_id_idx ON public.wishlist_share_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_share_tokens TO authenticated;
GRANT ALL ON public.wishlist_share_tokens TO service_role;

ALTER TABLE public.wishlist_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own share tokens"
  ON public.wishlist_share_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
