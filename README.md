# BOOKINGROOM-TV

This repository contains the initial MVP structure for a single-hotel guest TV system.

## Current status

- Admin dashboard prototype is in the `admin/` folder.
- The dashboard reflects the hotel TV home screen concept and admin controls for hotel content, rooms, guests, and TV devices.
- Power TV remains a separate system and is intentionally not merged into the booking logic.

## Project structure

- `admin/` — React + Vite admin dashboard prototype
- `POWER_TV (1).apk` — reference APK for the power TV app
- `WhatsApp Image ...` — design reference screenshots

## Business logic in this MVP

- admin manages hotel content
- admin manages rooms, reservations, guests, and TV devices
- guest does not self-register bookings in the app
- each TV is bound to a room through a unique `device_id`
- TV content is served from hotel and room context, not from a shared guest self-service flow

## Pairing the Hotel TV console

The admin panel and TV console share hotel content through Supabase. To pair a TV:

1. Apply `supabase/migrations/20261109_tv_console_pairings.sql` in the Supabase SQL Editor.
2. Deploy the updated admin panel and `hotel-tv-panel.html` to Vercel.
3. Open `/admin/`, sign in, and select **Uparivanje TV-a**. Create a code for the TV's room.
4. Open the updated Hotel TV APK and enter that code on the TV. The code is shown only once; revoke it in the admin panel if it is lost.

Each pairing can read only the hotel's public TV content and the active booking for its assigned room. It cannot change data. Revoke a code in the admin panel to remove that TV's access.

## Next phases

1. Supabase schema
2. Admin auth
3. Hotel content management
4. Room + TV pairing
5. Reservation and check-in flow
6. Realtime guest sync
7. Power TV launcher abstraction
8. Offline and reconnect behavior
