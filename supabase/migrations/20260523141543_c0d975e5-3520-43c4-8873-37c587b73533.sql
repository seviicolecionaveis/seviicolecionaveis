
-- 1. stock_alerts: require auth + email match
DROP POLICY IF EXISTS "Anyone can subscribe to stock alerts" ON public.stock_alerts;
CREATE POLICY "Authenticated users subscribe with own email"
  ON public.stock_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND lower(email) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
  );

-- 2. realtime.messages: require authenticated to subscribe to any channel
-- (postgres_changes still gated by table RLS on orders)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Lock down SECURITY DEFINER functions not meant for direct client calls
REVOKE EXECUTE ON FUNCTION public.has_user_purchased(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.available_stock(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;

-- 4. Fix mutable search_path on remaining functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq_internal, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq_internal, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq_internal, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq_internal, pgmq;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- 5. Storage: prevent listing the public card-images bucket while keeping object reads public
-- The existing "Card images publicly readable" SELECT policy allows listing via storage.objects.
-- Replace with a policy that still allows direct object access but is filtered by name pattern lookup only.
-- Note: Supabase serves files via /object/public/<bucket>/<path> which bypasses listing; the SELECT policy
-- is only needed for the storage API. We keep SELECT but require an explicit name filter via owner anon read.
-- Simpler: keep public read (needed for signed URLs / list-by-prefix from admin), no change to direct file access.
-- We instead toggle the bucket to disallow listing through bucket flags would require dashboard; skip if can't.
