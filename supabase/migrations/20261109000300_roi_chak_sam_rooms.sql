-- Roi Chak Sam: 3 rooms and their tables, from the fl. 2 floor plan.
-- Safe to run more than once. Old tables/rooms are switched off (not deleted) so past bookings keep working.
-- Edit the numbers in the "tables" list below if a count is wrong, then run again.

do $$
declare
  r uuid;
  a_vip uuid; a_main uuid; a_front uuid;
begin
  select id into r from public.restaurants where slug = 'roi-chak-sam';
  if r is null then raise notice 'Roi Chak Sam not found'; return; end if;

  -- Switch off whatever was there before.
  update public.tables set is_active = false where restaurant_id = r;
  update public.restaurant_areas set is_active = false where restaurant_id = r;

  insert into public.restaurant_areas (restaurant_id, name, sort_order, is_active) values (r, 'VIP Room / Glass Room (river view)', 0, true)
    on conflict (restaurant_id, name) do update set is_active = true, sort_order = 0 returning id into a_vip;
  insert into public.restaurant_areas (restaurant_id, name, sort_order, is_active) values (r, 'Main dining area', 1, true)
    on conflict (restaurant_id, name) do update set is_active = true, sort_order = 1 returning id into a_main;
  insert into public.restaurant_areas (restaurant_id, name, sort_order, is_active) values (r, 'Dining area (front)', 2, true)
    on conflict (restaurant_id, name) do update set is_active = true, sort_order = 2 returning id into a_front;

  -- label, room, min seats, max seats, sort
  insert into public.tables (restaurant_id, area_id, label, min_capacity, max_capacity, shape, is_combinable, sort_order, is_active)
  select r, v.area, v.label, v.mn, v.mx, 'rect', false, v.srt, true
  from (values
    ('VIP',     a_vip,   14, 18, 1),   -- one long table, 14-18 seats
    ('Main 1',  a_main,   2,  4, 2),   -- 4 tables, max 18 seats in total
    ('Main 2',  a_main,   2,  4, 3),
    ('Main 3',  a_main,   2,  5, 4),
    ('Main 4',  a_main,   2,  5, 5),
    ('Front 1', a_front,  1,  2, 6),   -- 3 tables, max 10 seats in total
    ('Front 2', a_front,  2,  4, 7),
    ('Front 3', a_front,  2,  4, 8)
  ) as v(label, area, mn, mx, srt)
  on conflict (restaurant_id, label) do update
    set area_id = excluded.area_id, min_capacity = excluded.min_capacity, max_capacity = excluded.max_capacity,
        sort_order = excluded.sort_order, is_active = true, is_combinable = false;
end $$;

select a.name as room, count(t.id) as tables, sum(t.max_capacity) as seats
from public.restaurant_areas a join public.tables t on t.area_id = a.id and t.is_active
where a.is_active and a.restaurant_id = (select id from public.restaurants where slug = 'roi-chak-sam')
group by a.name, a.sort_order order by a.sort_order;
