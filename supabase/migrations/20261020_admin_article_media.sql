alter table public.admin_form_entries
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists location text,
  add column if not exists links jsonb not null default '[]'::jsonb;

update public.admin_form_entries
set images = jsonb_build_array(image_url)
where image_url is not null
  and images = '[]'::jsonb;
