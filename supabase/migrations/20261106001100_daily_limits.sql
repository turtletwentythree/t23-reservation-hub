-- Optional caps on online bookings per day (empty = no cap). Staff can still book over them.
alter table public.booking_policies
  add column if not exists max_online_bookings_per_day int check (max_online_bookings_per_day is null or max_online_bookings_per_day >= 1),
  add column if not exists max_online_covers_per_day int check (max_online_covers_per_day is null or max_online_covers_per_day >= 1);
