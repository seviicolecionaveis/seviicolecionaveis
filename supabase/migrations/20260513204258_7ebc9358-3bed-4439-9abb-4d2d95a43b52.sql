-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS favorite_pokemons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_categories text[] NOT NULL DEFAULT '{}';

-- Update handle_new_user to capture whatsapp + birth_date
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  bd date;
begin
  begin
    bd := nullif(new.raw_user_meta_data ->> 'birth_date','')::date;
  exception when others then
    bd := null;
  end;

  insert into public.profiles (user_id, full_name, whatsapp, birth_date)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp',''),
    bd
  );

  if lower(new.email) = 'seviicolecionaveis@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$function$;

-- Post-purchase surveys
CREATE TABLE IF NOT EXISTS public.post_purchase_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  how_found_us text,
  satisfaction integer CHECK (satisfaction IS NULL OR (satisfaction BETWEEN 1 AND 5)),
  comment text,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_purchase_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own survey"
  ON public.post_purchase_surveys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own survey"
  ON public.post_purchase_surveys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all surveys"
  ON public.post_purchase_surveys FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
