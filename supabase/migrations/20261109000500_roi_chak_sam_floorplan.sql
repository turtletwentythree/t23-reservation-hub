-- Roi Chak Sam: place each table on the Floor 2 picture (public/floorplans/roi-chak-sam.webp, 1448 x 1086 px).
-- pos_x / pos_y = top-left corner and width / height = size, all in picture pixels. Safe to run more than once.
-- Run after roi-chak-sam-rooms.sql. To move a table, change its numbers and run again.

do $$
declare r uuid;
begin
  select id into r from public.restaurants where slug = 'roi-chak-sam';
  if r is null then return; end if;

  update public.restaurant_areas set canvas_width = 1448, canvas_height = 1086 where restaurant_id = r;

  update public.tables t set pos_x = v.x, pos_y = v.y, width = v.w, height = v.h
  from (values
    ('VIP',     380, 275, 330, 60),
    ('Main 1',  885, 375,  90, 65),
    ('Main 2', 1030, 375,  90, 65),
    ('Main 3',  885, 575,  90, 65),
    ('Main 4', 1030, 575,  90, 65),
    ('Front 1', 858, 895,  75, 55),
    ('Front 2',1085, 895,  70, 55),
    ('Front 3', 975, 966,  70, 32)
  ) as v(label, x, y, w, h)
  where t.restaurant_id = r and t.label = v.label;
end $$;

select label, pos_x, pos_y, width, height from public.tables
where restaurant_id = (select id from public.restaurants where slug = 'roi-chak-sam') and is_active order by sort_order;
