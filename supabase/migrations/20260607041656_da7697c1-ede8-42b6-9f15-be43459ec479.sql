ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS created_by_email text;
NOTIFY pgrst, 'reload schema';