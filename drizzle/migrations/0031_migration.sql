-- Admin customer search now also matches the account ID (UUID) and the login e-mail.
CREATE OR REPLACE FUNCTION public.admin_search_customers(_search text, _limit integer, _offset integer)
 RETURNS TABLE(user_id uuid, full_name text, cpf text, phone text, whatsapp text, birth_date date, email text, created_at timestamp with time zone, orders_count bigint, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT NULLIF(btrim(_search), '') AS s),
  matched AS (
    SELECT p.user_id
    FROM public.profiles p, q
    WHERE q.s IS NULL
       OR p.full_name ILIKE '%' || q.s || '%'
       OR p.cpf ILIKE '%' || q.s || '%'
       OR COALESCE(p.phone, '') ILIKE '%' || q.s || '%'
       OR COALESCE(p.whatsapp, '') ILIKE '%' || q.s || '%'
       OR (q.s ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.user_id::text = lower(q.s))
    UNION
    SELECT u.id
    FROM auth.users u, q
    WHERE q.s IS NOT NULL AND u.email ILIKE '%' || q.s || '%'
    UNION
    SELECT o.user_id
    FROM public.orders o, q
    WHERE q.s IS NOT NULL AND o.email ILIKE '%' || q.s || '%'
  ),
  scored AS (
    SELECT m.user_id, COUNT(*) OVER () AS total
    FROM (SELECT DISTINCT user_id FROM matched) m
  )
  SELECT
    s.user_id,
    p.full_name,
    p.cpf,
    p.phone,
    p.whatsapp,
    p.birth_date,
    u.email,
    p.created_at,
    (SELECT COUNT(*) FROM public.orders o WHERE o.user_id = s.user_id),
    s.total
  FROM scored s
  JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 50)))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
$function$;