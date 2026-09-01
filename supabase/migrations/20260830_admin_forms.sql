create extension if not exists "pgcrypto";

create table if not exists public.admin_form_entries (
  id text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  module_name text not null,
  title text,
  subtitle text,
  description text,
  image_url text,
  name text,
  value text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_bookings (
  id text primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_name text not null,
  room text not null,
  check_in date not null,
  check_out date not null,
  status text not null default 'upcoming' check (status in ('active', 'upcoming', 'past')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_form_entries_hotel_module
on public.admin_form_entries(hotel_id, module_name, sort_order);

create index if not exists idx_guest_bookings_hotel_dates
on public.guest_bookings(hotel_id, check_in, check_out);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_form_entries_updated_at on public.admin_form_entries;
drop trigger if exists trg_guest_bookings_updated_at on public.guest_bookings;

create trigger trg_admin_form_entries_updated_at
before update on public.admin_form_entries
for each row execute procedure public.set_updated_at();

create trigger trg_guest_bookings_updated_at
before update on public.guest_bookings
for each row execute procedure public.set_updated_at();
