create table public.card_prices (
  id uuid primary key default gen_random_uuid(),
  card_name text not null,
  collection text not null,
  card_number text not null,
  finish text not null,
  language text not null,
  price_cents integer,
  source_url text,
  last_error text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (card_name, collection, card_number, finish, language)
);

create index idx_card_prices_lookup on public.card_prices (card_name, collection, card_number);

alter table public.card_prices enable row level security;

create policy "Anyone can view card prices"
  on public.card_prices for select
  using (true);

create policy "Admins manage card prices"
  on public.card_prices for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create trigger card_prices_updated_at
  before update on public.card_prices
  for each row execute function public.update_updated_at();