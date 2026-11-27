-- Supervisor account isolation & admin account blocking
-- Strictly restricts supervisor access to zorandostica2@gmail.com via verified Supabase Auth identity.

alter table public.admin_hotel_accounts
  add column if not exists is_blocked boolean not null default false,
  add column if not exists block_reason text,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references auth.users(id) on delete set null;

create index if not exists idx_admin_hotel_accounts_is_blocked
  on public.admin_hotel_accounts (is_blocked, created_at desc);

create or replace function public.is_supervisor()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, auth
as $$
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        where u.id = auth.uid()
          and lower(u.email) = 'zorandostica2@gmail.com'
          and u.email_confirmed_at is not null
          and u.deleted_at is null
          and (u.banned_until is null or u.banned_until <= now())
      )
    ),
    false
  );
$$;

revoke all on function public.is_supervisor() from public, anon;
grant execute on function public.is_supervisor() to authenticated;

create or replace function public.supervisor_check_access()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select public.is_supervisor();
$$;

revoke all on function public.supervisor_check_access() from public, anon;
grant execute on function public.supervisor_check_access() to authenticated;

create or replace function public.current_admin_hotel_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select hotel_id
  from public.admin_hotel_accounts
  where user_id = auth.uid()
    and coalesce(is_blocked, false) = false
$$;

revoke all on function public.current_admin_hotel_id() from public, anon;
grant execute on function public.current_admin_hotel_id() to authenticated;

create or replace function public.protect_admin_block_columns()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and not public.is_supervisor() then
    if new.is_blocked is distinct from old.is_blocked
      or new.block_reason is distinct from old.block_reason
      or new.blocked_at is distinct from old.blocked_at
      or new.blocked_by is distinct from old.blocked_by
      or new.user_id is distinct from old.user_id
      or new.hotel_id is distinct from old.hotel_id then
      raise exception 'Only supervisor can modify admin block status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_admin_block_columns on public.admin_hotel_accounts;
create trigger trg_protect_admin_block_columns
before update on public.admin_hotel_accounts
for each row execute procedure public.protect_admin_block_columns();

drop policy if exists "Admins can update their account details" on public.admin_hotel_accounts;
create policy "Admins can update their account details"
on public.admin_hotel_accounts for update to authenticated
using (user_id = auth.uid() and coalesce(is_blocked, false) = false)
with check (
  user_id = auth.uid()
  and coalesce(is_blocked, false) = false
  and hotel_id = public.current_admin_hotel_id()
);

create or replace function public.create_admin_hotel(hotel_name text, hotel_city text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_hotel_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Admin must be authenticated';
  end if;

  if public.is_supervisor() then
    raise exception 'Supervisor account cannot register as a hotel admin';
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

revoke all on function public.create_admin_hotel(text, text) from public, anon;
grant execute on function public.create_admin_hotel(text, text) to authenticated;

create or replace function public.create_hotel_for_new_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_hotel_id uuid;
begin
  if lower(coalesce(new.email, '')) = 'zorandostica2@gmail.com' then
    return new;
  end if;

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

create or replace function public.supervisor_list_admins()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.is_supervisor() then
    raise exception 'Unauthorized: supervisor access only';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', a.user_id,
          'username', coalesce(a.username, u.raw_user_meta_data ->> 'admin_username', split_part(coalesce(u.email, ''), '@', 1)),
          'email', u.email,
          'hotel_id', a.hotel_id,
          'hotel_name', coalesce(h.name, a.hotel_name, ''),
          'city', coalesce(h.city, a.city, ''),
          'phone', h.phone,
          'contact_email', h.email,
          'created_at', a.created_at,
          'is_blocked', coalesce(a.is_blocked, false),
          'block_reason', a.block_reason,
          'blocked_at', a.blocked_at,
          'tv_count', (select count(*) from public.tv_console_pairings p where p.hotel_id = a.hotel_id),
          'active_tv_count', (select count(*) from public.tv_console_pairings p where p.hotel_id = a.hotel_id and p.revoked_at is null),
          'entries_count', (select count(*) from public.admin_form_entries e where e.hotel_id = a.hotel_id),
          'bookings_count', (select count(*) from public.guest_bookings b where b.hotel_id = a.hotel_id)
        )
        order by a.is_blocked asc, a.created_at desc
      )
      from public.admin_hotel_accounts a
      left join public.hotels h on h.id = a.hotel_id
      left join auth.users u on u.id = a.user_id
      where lower(coalesce(u.email, '')) <> 'zorandostica2@gmail.com'
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.supervisor_list_admins() from public, anon;
grant execute on function public.supervisor_list_admins() to authenticated;

create or replace function public.supervisor_set_admin_block(
  target_user_id uuid,
  blocked boolean,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  clean_reason text;
  updated_row public.admin_hotel_accounts%rowtype;
begin
  if not public.is_supervisor() then
    raise exception 'Unauthorized: supervisor access only';
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'Invalid target admin account';
  end if;

  if exists (
    select 1
    from auth.users u
    where u.id = target_user_id
      and lower(coalesce(u.email, '')) = 'zorandostica2@gmail.com'
  ) then
    raise exception 'Supervisor account cannot be blocked';
  end if;

  clean_reason := case
    when blocked then coalesce(nullif(trim(coalesce(reason, '')), ''), 'Nalog je blokiran od strane supervizora.')
    else null
  end;

  update public.admin_hotel_accounts
  set is_blocked = blocked,
      block_reason = clean_reason,
      blocked_at = case when blocked then now() else null end,
      blocked_by = case when blocked then auth.uid() else null end
  where user_id = target_user_id
  returning * into updated_row;

  if not found then
    raise exception 'Admin nalog nije pronađen.';
  end if;

  return jsonb_build_object(
    'user_id', updated_row.user_id,
    'hotel_id', updated_row.hotel_id,
    'is_blocked', updated_row.is_blocked,
    'block_reason', updated_row.block_reason,
    'blocked_at', updated_row.blocked_at
  );
end;
$$;

revoke all on function public.supervisor_set_admin_block(uuid, boolean, text) from public, anon;
grant execute on function public.supervisor_set_admin_block(uuid, boolean, text) to authenticated;

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

  if exists (
    select 1
    from public.admin_hotel_accounts a
    where a.hotel_id = pairing.hotel_id
      and coalesce(a.is_blocked, false) = true
  ) then
    raise exception 'Admin account is blocked';
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
        'email', email,
        'translations', translations
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
            'translations', translations,
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
        and lower(trim(room)) = lower(trim(pairing.room_number))
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
