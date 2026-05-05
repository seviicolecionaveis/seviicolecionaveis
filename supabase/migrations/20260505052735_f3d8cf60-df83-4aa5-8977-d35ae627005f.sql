
-- Roles enum
create type public.app_role as enum ('admin', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  cpf text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = user_id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin'));

-- Addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.addresses enable row level security;
create policy "Users view own addresses" on public.addresses for select using (auth.uid() = user_id);
create policy "Users insert own addresses" on public.addresses for insert with check (auth.uid() = user_id);
create policy "Users update own addresses" on public.addresses for update using (auth.uid() = user_id);
create policy "Users delete own addresses" on public.addresses for delete using (auth.uid() = user_id);

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending', -- pending, paid, shipped, delivered, cancelled
  shipping_method text not null, -- 'fixed' or 'arrange'
  shipping_cost_cents integer not null default 0,
  subtotal_cents integer not null,
  total_cents integer not null,
  -- snapshot of address
  recipient_name text not null,
  cpf text,
  phone text,
  email text not null,
  cep text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  notes text,
  stripe_session_id text unique,
  stripe_payment_intent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "Users view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Admins view all orders" on public.orders for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update orders" on public.orders for update using (public.has_role(auth.uid(), 'admin'));
-- inserts come from server (service role) only

-- Order items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  card_id text not null,
  card_name text not null,
  card_image text,
  collection text,
  card_number text,
  finish text,
  language text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
create policy "Users view own order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "Admins view all order items" on public.order_items for select using (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.update_updated_at();

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
