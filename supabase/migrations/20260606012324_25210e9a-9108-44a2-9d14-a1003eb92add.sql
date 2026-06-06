ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS balance_cents integer;

UPDATE public.coupons
SET balance_cents = CASE WHEN used_count > 0 THEN 0 ELSE amount_cents END
WHERE user_id IS NOT NULL
  AND amount_cents IS NOT NULL
  AND amount_cents > 0
  AND balance_cents IS NULL;