create table public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  link_url text,
  alt text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.banners enable row level security;

create policy "Anyone can view active banners"
  on public.banners for select
  using (true);

create policy "Admins manage banners"
  on public.banners for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create trigger banners_updated_at
  before update on public.banners
  for each row execute function public.update_updated_at();