DROP POLICY IF EXISTS "Users insert own survey" ON public.post_purchase_surveys;

CREATE POLICY "Users insert own survey"
ON public.post_purchase_surveys
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = post_purchase_surveys.order_id
      AND o.user_id = auth.uid()
  )
);