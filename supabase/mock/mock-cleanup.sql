-- Removes everything created by mock-data.sql (Roi Chak Sam test data). Safe to run more than once.
-- Run in Supabase -> SQL Editor.

do $$
declare r uuid;
begin
  select id into r from public.restaurants where slug = 'roi-chak-sam';
  if r is null then return; end if;

  delete from public.booking_requests where restaurant_id = r and customer_name like 'MOCK %';
  delete from public.reservations where restaurant_id = r and reference like 'MOCK-%';   -- tables + history go with them
  if to_regclass('public.daily_capacity') is not null then
    delete from public.daily_capacity where restaurant_id = r and note like 'MOCK%';
  end if;
  if to_regclass('public.daily_zone_capacity') is not null then
    delete from public.daily_zone_capacity where restaurant_id = r and day in ('2026-11-15', '2026-11-16');
  end if;
  delete from public.operating_hours where restaurant_id = r and service_name = 'MOCK holiday';
end $$;

select
  (select count(*) from public.reservations where reference like 'MOCK-%') as mock_reservations_left,
  (select count(*) from public.booking_requests where customer_name like 'MOCK %') as mock_requests_left;
