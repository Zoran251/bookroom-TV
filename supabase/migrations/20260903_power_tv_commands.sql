alter table public.tv_commands
  add column if not exists status text not null default 'pending',
  add column if not exists error_message text,
  add column if not exists processed_at timestamptz;

alter table public.tv_commands
  drop constraint if exists tv_commands_status_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tv_commands_status_check'
      and conrelid = 'public.tv_commands'::regclass
  ) then
    alter table public.tv_commands
      add constraint tv_commands_status_check
      check (status in ('pending', 'processing', 'completed', 'failed'));
  end if;
end;
$$;

alter table public.tv_devices
  add column if not exists app_version text;

insert into public.app_settings (hotel_id, key, value)
select id, 'power_tv_package', to_jsonb('com.flextv.livestore'::text)
from public.hotels
on conflict (hotel_id, key) do update
set value = excluded.value,
    updated_at = now();

create index if not exists idx_tv_commands_device_status
on public.tv_commands(tv_device_id, status, created_at);

alter table public.tv_commands replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tv_commands'
  ) then
    alter publication supabase_realtime add table public.tv_commands;
  end if;
end;
$$;

create or replace function public.set_tv_command_status(
  command_id uuid,
  next_status text,
  next_error_message text default null
)
returns public.tv_commands
language plpgsql
security invoker
as $$
declare
  updated_command public.tv_commands;
begin
  if next_status not in ('processing', 'completed', 'failed') then
    raise exception 'Invalid TV command status: %', next_status;
  end if;

  update public.tv_commands
  set status = next_status,
      error_message = next_error_message,
      processed_at = case when next_status in ('completed', 'failed') then now() else processed_at end
  where id = command_id
  returning * into updated_command;

  return updated_command;
end;
$$;
