create or replace function public.catalog_last_stock_additions()
returns table(card_name text, collection text, card_number text, last_added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.card_name, s.collection, s.card_number, max(s.changed_at)::timestamptz as last_added_at
  from public.card_stock_changes s
  where s.delta > 0
  group by s.card_name, s.collection, s.card_number
$$;

grant execute on function public.catalog_last_stock_additions() to anon, authenticated;