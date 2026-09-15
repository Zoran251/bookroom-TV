-- BOOKINGROOM-TV database schema
-- Single-hotel MVP: admin manages all data; guest does not self-book.

create extension if not exists "pgcrypto";

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  welcome_text text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_number text not null,
  room_name text not null,
  status text not null default 'available' check (status in ('available', 'occupied', 'maintenance', 'reserved')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, room_number)
);

create table if not exists public.tv_devices (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  device_id text not null unique,
  device_name text,
  status text not null default 'paired' check (status in ('paired', 'active', 'offline')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  room_id uuid references public.rooms(id) on delete set null,
  status text not null default 'checked_in' check (status in ('checked_in', 'checked_out')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid not null references public.rooms(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved', 'checked_in', 'checked_out')),
  check_in date not null,
  check_out date not null,
  guest_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out >= check_in)
);

create table if not exists public.guest_tv_sessions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  tv_device_id uuid references public.tv_devices(id) on delete set null,
  session_started_at timestamptz not null default now(),
  session_ended_at timestamptz,
  last_screen text,
  created_at timestamptz not null default now()
);

create table if not exists public.tv_commands (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  tv_device_id uuid references public.tv_devices(id) on delete set null,
  command_type text not null,
  payload jsonb default '{}',
  sent_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_content (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  module_name text not null,
  slug text,
  status text not null default 'published' check (status in ('published', 'draft')),
  content jsonb default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (hotel_id, slug)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_name text,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, key)
);

create index if not exists idx_rooms_hotel_id on public.rooms(hotel_id);
create index if not exists idx_tv_devices_hotel_id on public.tv_devices(hotel_id);
create index if not exists idx_guests_hotel_id on public.guests(hotel_id);
create index if not exists idx_reservations_hotel_id on public.reservations(hotel_id);
create index if not exists idx_guest_tv_sessions_hotel_id on public.guest_tv_sessions(hotel_id);
create index if not exists idx_hotel_content_hotel_id on public.hotel_content(hotel_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_hotels_updated_at
before update on public.hotels
for each row execute procedure public.set_updated_at();

create trigger trg_rooms_updated_at
before update on public.rooms
for each row execute procedure public.set_updated_at();

create trigger trg_tv_devices_updated_at
before update on public.tv_devices
for each row execute procedure public.set_updated_at();

create trigger trg_guests_updated_at
before update on public.guests
for each row execute procedure public.set_updated_at();

create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute procedure public.set_updated_at();

create trigger trg_hotel_content_updated_at
before update on public.hotel_content
for each row execute procedure public.set_updated_at();

create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute procedure public.set_updated_at();

-- Example seed data
insert into public.hotels (name, city, welcome_text, phone, email)
values ('Hotel Bellevue', 'Banja Luka', 'Dobrodošli, goste', '+387 51 222 333', 'info@hotelbellevue.ba')
on conflict do nothing;

-- Optional view for dashboard metrics
create or replace view public.dashboard_summary as
select
  h.id as hotel_id,
  h.name,
  count(distinct r.id) as total_rooms,
  count(distinct case when r.status = 'occupied' then r.id end) as occupied_rooms,
  count(distinct case when r.status = 'available' then r.id end) as available_rooms,
  count(distinct d.id) as total_devices,
  count(distinct g.id) as total_guests,
  count(distinct case when g.status = 'checked_in' then g.id end) as active_guests,
  count(distinct case when res.status = 'checked_in' then res.id end) as active_reservations,
  count(distinct case when c.status = 'published' then c.id end) as published_content
from public.hotels h
left join public.rooms r on r.hotel_id = h.id
left join public.tv_devices d on d.hotel_id = h.id
left join public.guests g on g.hotel_id = h.id
left join public.reservations res on res.hotel_id = h.id
left join public.hotel_content c on c.hotel_id = h.id
group by h.id, h.name;
