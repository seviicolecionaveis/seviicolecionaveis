CREATE OR REPLACE FUNCTION public.user_tier(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.user_lifetime_earned(_user_id) >= 2000 THEN 'gold'
    WHEN public.user_lifetime_earned(_user_id) >= 500  THEN 'silver'
    ELSE 'bronze'
  END;
$function$;