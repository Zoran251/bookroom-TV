drop trigger if exists trg_hotels_updated_at on public.hotels;
drop trigger if exists trg_admin_form_entries_updated_at on public.admin_form_entries;
drop trigger if exists trg_guest_bookings_updated_at on public.guest_bookings;

create trigger trg_hotels_updated_at
before update on public.hotels
for each row execute procedure public.set_updated_at();

create trigger trg_admin_form_entries_updated_at
before update on public.admin_form_entries
for each row execute procedure public.set_updated_at();

create trigger trg_guest_bookings_updated_at
before update on public.guest_bookings
for each row execute procedure public.set_updated_at();
