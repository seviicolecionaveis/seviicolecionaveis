-- 1) Restrict realtime.messages SELECT to topic ownership
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_read_realtime_messages" ON realtime.messages;

CREATE POLICY "Users read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Admin-only channels
  (
    (realtime.topic() IN ('admin-notifications-bell', 'admin-orders-list'))
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  OR
  -- User's own orders list channel
  (realtime.topic() = ('orders-list-' || auth.uid()::text))
  OR
  -- Per-order channel: topic looks like order-<uuid>, user must own the order
  (
    realtime.topic() LIKE 'order-%'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = substring(realtime.topic() FROM 7)
        AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  )
);

-- 2) Enforce NOT NULL on stock_alerts.user_id (now that policy requires it)
DELETE FROM public.stock_alerts WHERE user_id IS NULL;
ALTER TABLE public.stock_alerts ALTER COLUMN user_id SET NOT NULL;