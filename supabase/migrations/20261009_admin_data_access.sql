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

revoke all on function public.current_admin_hotel_id() from public, anon;
grant execute on function public.current_admin_hotel_id() to authenticated;

alter table public.hotels enable row level security;
alter table public.admin_hotel_accounts enable row level security;
alter table public.admin_form_entries enable row level security;
alter table public.guest_bookings enable row level security;
alter table public.app_settings enable row level security;

revoke all on table public.hotels from anon;
revoke all on table public.admin_hotel_accounts from anon;
revoke all on table public.admin_form_entries from anon;
revoke all on table public.guest_bookings from anon;
revoke all on table public.app_settings from anon;

grant select, update on table public.hotels to authenticated;
grant select, update on table public.admin_hotel_accounts to authenticated;
grant select, insert, update, delete on table public.admin_form_entries to authenticated;
grant select, insert, update, delete on table public.guest_bookings to authenticated;
grant select, insert, update, delete on table public.app_settings to authenticated;

create index if not exists idx_admin_form_entries_hotel_module
on public.admin_form_entries (hotel_id, module_name, sort_order);

create index if not exists idx_guest_bookings_hotel_dates
on public.guest_bookings (hotel_id, check_in, check_out);

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
with check (
  user_id = auth.uid()
  and hotel_id = public.current_admin_hotel_id()
);

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

drop policy if exists "Admins can manage their app settings" on public.app_settings;
create policy "Admins can manage their app settings"
on public.app_settings for all to authenticated
using (hotel_id = public.current_admin_hotel_id())
with check (hotel_id = public.current_admin_hotel_id());
