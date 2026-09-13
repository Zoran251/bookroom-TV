create table if not exists public.admin_hotel_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null unique references public.hotels(id) on delete cascade,
  username text,
  hotel_name text,
  city text,
  created_at timestamptz not null default now()
);

alter table public.admin_hotel_accounts add column if not exists username text;
alter table public.admin_hotel_accounts add column if not exists hotel_name text;
alter table public.admin_hotel_accounts add column if not exists city text;

create unique index if not exists admin_hotel_accounts_username_key
on public.admin_hotel_accounts (lower(username))
where username is not null;

alter table public.hotels enable row level security;
alter table public.admin_hotel_accounts enable row level security;
alter table public.admin_form_entries enable row level security;
alter table public.guest_bookings enable row level security;

create or replace function public.current_admin_hotel_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select hotel_id
  from public.admin_hotel_accounts
  where user_id = auth.uid()
$$;

revoke all on function public.current_admin_hotel_id() from public;
grant execute on function public.current_admin_hotel_id() to authenticated;

create or replace function public.create_admin_hotel(hotel_name text, hotel_city text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hotel_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Admin must be authenticated';
  end if;

  if exists (select 1 from public.admin_hotel_accounts where user_id = auth.uid()) then
    raise exception 'Admin already has a hotel';
  end if;

  insert into public.hotels (name, city)
  values (hotel_name, hotel_city)
  returning id into new_hotel_id;

  insert into public.admin_hotel_accounts (user_id, hotel_id, username, hotel_name, city)
  values (auth.uid(), new_hotel_id, null, hotel_name, hotel_city);

  return new_hotel_id;
end;
$$;

revoke all on function public.create_admin_hotel(text, text) from public;
grant execute on function public.create_admin_hotel(text, text) to authenticated;

create or replace function public.create_hotel_for_new_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hotel_id uuid;
begin
  if new.raw_user_meta_data ? 'hotel_name' then
    insert into public.hotels (name, city)
    values (
      new.raw_user_meta_data ->> 'hotel_name',
      new.raw_user_meta_data ->> 'hotel_city'
    )
    returning id into new_hotel_id;

    insert into public.admin_hotel_accounts (user_id, hotel_id, username, hotel_name, city)
    values (
      new.id,
      new_hotel_id,
      lower(new.raw_user_meta_data ->> 'admin_username'),
      new.raw_user_meta_data ->> 'hotel_name',
      new.raw_user_meta_data ->> 'hotel_city'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_hotel_for_new_admin on auth.users;
create trigger trg_create_hotel_for_new_admin
after insert on auth.users
for each row execute procedure public.create_hotel_for_new_admin();

drop policy if exists "Admins can read their hotel" on public.hotels;
create policy "Admins can read their hotel"
on public.hotels for select to authenticated
using (id = public.current_admin_hotel_id());

drop policy if exists "Admins can update their hotel header" on public.hotels;
create policy "Admins can update their hotel header"
on public.hotels for update to authenticated
using (id = public.current_admin_hotel_id())
with check (id = public.current_admin_hotel_id());

drop policy if exists "Admins can read their account" on public.admin_hotel_accounts;
create policy "Admins can read their account"
on public.admin_hotel_accounts for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can update their account details" on public.admin_hotel_accounts;
create policy "Admins can update their account details"
on public.admin_hotel_accounts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can manage their content" on public.admin_form_entries;
create policy "Admins can manage their content"
on public.admin_form_entries for all to authenticated
using (hotel_id = public.current_admin_hotel_id())
with check (hotel_id = public.current_admin_hotel_id());

drop policy if exists "Admins can manage their bookings" on public.guest_bookings;
create policy "Admins can manage their bookings"
on public.guest_bookings for all to authenticated
using (hotel_id = public.current_admin_hotel_id())
with check (hotel_id = public.current_admin_hotel_id());