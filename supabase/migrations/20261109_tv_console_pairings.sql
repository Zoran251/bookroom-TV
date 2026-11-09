create table if not exists public.tv_console_pairings (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_number text not null check (length(trim(room_number)) between 1 and 32),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_tv_console_pairings_hotel_created
on public.tv_console_pairings (hotel_id, created_at desc);

alter table public.tv_console_pairings enable row level security;

revoke all on table public.tv_console_pairings from anon;
grant select, insert, update, delete on table public.tv_console_pairings to authenticated;

drop policy if exists "Admins can manage their TV pairings" on public.tv_console_pairings;
create policy "Admins can manage their TV pairings"
on public.tv_console_pairings for all to authenticated
using (hotel_id = public.current_admin_hotel_id())
with check (hotel_id = public.current_admin_hotel_id());

create or replace function public.get_tv_console_data(pairing_code_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  pairing public.tv_console_pairings%rowtype;
begin
  if pairing_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid TV pairing code';
  end if;

  select *
  into pairing
  from public.tv_console_pairings
  where code_hash = pairing_code_hash
    and revoked_at is null;

  if not found then
    raise exception 'Invalid or revoked TV pairing code';
  end if;

  return jsonb_build_object(
    'room', pairing.room_number,
    'hotel', (
      select jsonb_build_object(
        'id', id,
        'name', name,
        'city', city,
        'welcome_text', welcome_text,
        'phone', phone,
        'email', email
      )
      from public.hotels
      where id = pairing.hotel_id
    ),
    'entries', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'module_name', module_name,
            'title', title,
            'subtitle', subtitle,
            'description', description,
            'image_url', image_url,
            'images', images,
            'location', location,
            'links', links,
            'name', name,
            'value', value,
            'created_at', created_at
          )
          order by sort_order, created_at
        ),
        '[]'::jsonb
      )
      from public.admin_form_entries
      where hotel_id = pairing.hotel_id
        and module_name in ('hotelinfo', 'marketing', 'restorani', 'wellness', 'sport', 'okolica', 'tv', 'radio')
    ),
    'booking', (
      select jsonb_build_object(
        'id', id,
        'guest_name', guest_name,
        'room', room,
        'check_in', check_in,
        'check_out', check_out,
        'status', status
      )
      from public.guest_bookings
      where hotel_id = pairing.hotel_id
        and room = pairing.room_number
        and check_in <= current_date
        and check_out >= current_date
      order by check_in desc
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_tv_console_data(text) from public;
grant execute on function public.get_tv_console_data(text) to anon, authenticated;
