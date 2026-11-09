-- MOCK DATA for Roi Chak Sam, 9 Nov to 30 Nov 2026, for testing.
-- Everything is tagged: reservation references start with MOCK-, guest names start with "MOCK ",
-- so mock-cleanup.sql removes it all again. Safe to run more than once (it clears its own data first).
-- Run in Supabase -> SQL Editor. Run roi-chak-sam-rooms.sql, daily-capacity.sql and zone-capacity.sql first.
--
-- Scenarios: every reservation status; Internal / KOL / Media / untagged guests; Phone and LINE;
-- tables in all 3 rooms; bookings with no table; days that are OK, nearly full, FULL and OVER CAP;
-- a day closed by capacity 0; a holiday; zone limits (zone OVER, zone FULL, zone closed);
-- booking requests that are pending, keyed in, declined and cancelled.
-- Note: it sets the daily capacity of a few days (marked MOCK); mock-cleanup.sql removes those rows.

do $$
declare
  r uuid; org uuid; tz text; today date;
  src_phone uuid; src_line uuid;
  d date; i int; slot int; tb record; svc record;
  t_open time; t_a time; t_b time; t_slot time;
  h int; threshold int; party int; st text; ty int; tag text; seq int := 0; res uuid;
  names text[] := array['Somchai','Napat','Kanya','Arthit','Preecha','Malee','Chaiwat','Ploy','Anan','Siriporn',
                        'Tanawat','Wipa','Kittisak','Orn','Pimchanok','Surasak','Jirayu','Nattaya','Pongsakorn','Lalita'];
  profile int[] := array[20,30,40,55,70,85,35];
  a_vip uuid; a_main uuid; a_front uuid;
  day_total int; zone_pax int;
begin
  select id, organization_id, timezone into r, org, tz from public.restaurants where slug = 'roi-chak-sam';
  if r is null then raise exception 'Roi Chak Sam not found'; end if;
  today := (now() at time zone tz)::date;

  -- Start clean.
  delete from public.booking_requests where restaurant_id = r and customer_name like 'MOCK %';
  delete from public.reservations where restaurant_id = r and reference like 'MOCK-%';
  if to_regclass('public.daily_capacity') is not null then delete from public.daily_capacity where restaurant_id = r and note like 'MOCK%'; end if;
  if to_regclass('public.daily_zone_capacity') is not null then delete from public.daily_zone_capacity where restaurant_id = r and day in ('2026-11-15', '2026-11-16'); end if;
  delete from public.operating_hours where restaurant_id = r and service_name = 'MOCK holiday';

  select id into src_phone from public.booking_sources where organization_id = org and code = 'phone';
  select id into src_line from public.booking_sources where organization_id = org and code = 'line';

  -- Holiday: Tue 24 Nov is closed for everyone.
  insert into public.operating_hours (restaurant_id, specific_date, service_name, is_closed) values (r, '2026-11-24', 'MOCK holiday', true);

  for d in select generate_series('2026-11-09'::date, '2026-11-30'::date, interval '1 day')::date loop
    i := d - '2026-11-09'::date;
    -- No bookings on the holiday or on the day closed by capacity 0 (19 Nov).
    continue when d in ('2026-11-24', '2026-11-19');

    -- Service times for that weekday: first service, two seatings 2.5 hours apart.
    select * into svc from public.operating_hours
      where restaurant_id = r and specific_date is null and day_of_week = extract(dow from d) and not is_closed order by open_time limit 1;
    continue when not found and exists (select 1 from public.operating_hours where restaurant_id = r and specific_date is null);
    t_open := coalesce(svc.open_time, '18:00');
    t_a := t_open;
    t_b := t_open + interval '150 minutes';
    if svc.last_seating_time is not null and t_b > svc.last_seating_time then t_b := null; end if;

    threshold := case when i in (6, 7) then 100 else profile[1 + (i % 7)] end;

    for slot in 1..2 loop
      t_slot := case slot when 1 then t_a else t_b end;
      continue when t_slot is null;
      for tb in select t.* from public.tables t where t.restaurant_id = r and t.is_active order by t.sort_order loop
        -- 16 Nov: VIP zone is closed. 
        continue when d = '2026-11-16' and tb.label = 'VIP';
        h := abs(hashtext(d::text || tb.label || slot::text));
        continue when (h % 100) >= case slot when 1 then threshold else threshold / 2 end;
        -- Guest count within the table's seats (VIP: a big group).
        party := tb.min_capacity + ((h / 7) % (tb.max_capacity - tb.min_capacity + 1));
        -- Status by date and time.
        if d < today then
          st := case when (h / 11) % 100 < 70 then 'completed' when (h / 11) % 100 < 82 then 'cancelled' when (h / 11) % 100 < 92 then 'no_show' else 'completed' end;
        elsif d = today and slot = 1 then
          st := case when (h / 11) % 3 = 0 then 'seated' when (h / 11) % 3 = 1 then 'arrived' else 'confirmed' end;
        else
          st := case when (h / 11) % 100 < 55 then 'confirmed' when (h / 11) % 100 < 85 then 'pending' else 'cancelled' end;
        end if;
        ty := (h / 13) % 100;
        tag := case when ty < 40 then '[Internal] ' when ty < 65 then '[KOL] ' when ty < 85 then '[Media] ' else '' end;
        seq := seq + 1;
        insert into public.reservations (restaurant_id, organization_id, reference, customer_name, phone, language, reservation_date, reservation_time,
            duration_minutes, party_size, booking_source_id, internal_notes, guest_notes, status, cancellation_reason)
        values (r, org, 'MOCK-' || lpad(seq::text, 4, '0'),
            'MOCK ' || names[1 + (h / 3) % 20],
            '08' || lpad((abs(hashtext(seq::text)) % 100000000)::text, 8, '0'), 'th', d, t_slot, 120, party,
            case when (h / 17) % 2 = 0 then src_phone else src_line end,
            tag || 'MOCK test booking · ' || case when (h / 17) % 2 = 0 then 'Phone' else 'LINE' end,
            case when (h / 19) % 9 = 0 then 'Birthday, window seat please' end,
            st::public.reservation_status,
            case when st = 'cancelled' then 'Guest cancelled (mock)' end)
        returning id into res;
        insert into public.reservation_tables (reservation_id, table_id, restaurant_id, period)
        values (res, tb.id, r, tstzrange(now(), now() + interval '1 minute'));  -- period is filled by a trigger
      end loop;
    end loop;
  end loop;

  -- A few bookings with no table yet (the store has not assigned one).
  for d in select unnest(array['2026-11-11', '2026-11-13', '2026-11-18', '2026-11-26']::date[]) loop
    seq := seq + 1;
    insert into public.reservations (restaurant_id, organization_id, reference, customer_name, phone, language, reservation_date, reservation_time,
        duration_minutes, party_size, booking_source_id, internal_notes, status)
    values (r, org, 'MOCK-' || lpad(seq::text, 4, '0'), 'MOCK No-table ' || names[1 + seq % 20], '0811111' || lpad(seq::text, 3, '0'), 'th', d, '19:00', 120,
        5 + seq % 4, src_phone, '[KOL] MOCK booking with no table assigned', case when d < today then 'completed' else 'pending' end::public.reservation_status);
  end loop;

  -- Daily capacity scenarios (needs daily-capacity.sql).
  if to_regclass('public.daily_capacity') is not null then
    -- 12 Nov: exactly FULL. 13 Nov: OVER CAP. 14 Nov: nearly full but OK.
    for d, i in select * from (values ('2026-11-12'::date, 0), ('2026-11-13'::date, -5), ('2026-11-14'::date, 2)) v(d, i) loop
      select coalesce(sum(party_size), 0) into day_total from public.reservations
        where restaurant_id = r and reservation_date = d and status not in ('cancelled', 'no_show');
      insert into public.daily_capacity (restaurant_id, day, capacity, note)
      values (r, d, greatest(1, day_total + i), 'MOCK ' || case when i = 0 then 'full day' when i < 0 then 'over capacity day' else 'nearly full day' end)
      on conflict (restaurant_id, day) do update set capacity = excluded.capacity, note = excluded.note;
    end loop;
    insert into public.daily_capacity (restaurant_id, day, capacity, note) values
      (r, '2026-11-19', 0, 'MOCK closed: no bookings'),
      (r, '2026-11-24', null, 'MOCK holiday')
    on conflict (restaurant_id, day) do update set capacity = excluded.capacity, note = excluded.note;
  end if;

  -- Zone limits (needs zone-capacity.sql): 15 Nov Main zone over, 16 Nov VIP closed and Front full.
  if to_regclass('public.daily_zone_capacity') is not null then
    select id into a_vip from public.restaurant_areas where restaurant_id = r and name like 'VIP%' and is_active limit 1;
    select id into a_main from public.restaurant_areas where restaurant_id = r and name like 'Main%' and is_active limit 1;
    select id into a_front from public.restaurant_areas where restaurant_id = r and name like 'Dining%' and is_active limit 1;
    if a_main is not null then
      select coalesce(sum(res.party_size), 0) into zone_pax from public.reservations res join public.reservation_tables rt on rt.reservation_id = res.id
        join public.tables t on t.id = rt.table_id
        where res.restaurant_id = r and res.reservation_date = '2026-11-15' and t.area_id = a_main and res.status not in ('cancelled', 'no_show');
      insert into public.daily_zone_capacity (area_id, restaurant_id, day, capacity) values (a_main, r, '2026-11-15', greatest(1, zone_pax - 3))
      on conflict (area_id, day) do update set capacity = excluded.capacity;
    end if;
    if a_vip is not null then
      insert into public.daily_zone_capacity (area_id, restaurant_id, day, capacity) values (a_vip, r, '2026-11-16', 0)
      on conflict (area_id, day) do update set capacity = excluded.capacity;
    end if;
    if a_front is not null then
      select coalesce(sum(res.party_size), 0) into zone_pax from public.reservations res join public.reservation_tables rt on rt.reservation_id = res.id
        join public.tables t on t.id = rt.table_id
        where res.restaurant_id = r and res.reservation_date = '2026-11-16' and t.area_id = a_front and res.status not in ('cancelled', 'no_show');
      insert into public.daily_zone_capacity (area_id, restaurant_id, day, capacity) values (a_front, r, '2026-11-16', greatest(1, zone_pax))
      on conflict (area_id, day) do update set capacity = excluded.capacity;
    end if;
  end if;

  -- Call Center booking requests in every state. The trigger forces new requests to "pending", so it is paused for this insert.
  alter table public.booking_requests disable trigger booking_request_before_write;
  insert into public.booking_requests (organization_id, restaurant_id, channel, customer_name, phone, line_id, party_size, requested_date, requested_time, notes, status, decline_reason, handled_at) values
    (org, r, 'call', 'MOCK Pending Phone Internal', '0891110001', null, 4, '2026-11-12', '18:00', '[Internal] MOCK pending request', 'pending', null, null),
    (org, r, 'line', 'MOCK Pending LINE KOL',       null, 'mock_kol_1', 6, '2026-11-14', '18:30', '[KOL] MOCK window seat', 'pending', null, null),
    (org, r, 'call', 'MOCK Pending Phone Media',    '0891110003', null, 3, '2026-11-17', '19:00', '[Media] MOCK press visit', 'pending', null, null),
    (org, r, 'line', 'MOCK Pending LINE Big group', null, 'mock_vip_1', 16, '2026-11-21', '18:00', '[KOL] MOCK VIP room group', 'pending', null, null),
    (org, r, 'call', 'MOCK Pending Phone Other',    '0891110005', null, 2, '2026-11-25', '19:30', 'MOCK untagged guest', 'pending', null, null),
    (org, r, 'line', 'MOCK Pending LINE Internal',  null, 'mock_int_2', 5, '2026-11-28', '18:00', '[Internal] MOCK team dinner', 'pending', null, null),
    (org, r, 'call', 'MOCK Declined Full day',      '0891110007', null, 8, '2026-11-13', '18:00', '[KOL] MOCK day was full', 'declined', 'Fully booked that day', now()),
    (org, r, 'line', 'MOCK Declined Closed',        null, 'mock_dec_2', 4, '2026-11-24', '18:30', '[Internal] MOCK holiday', 'declined', 'Closed for the holiday', now()),
    (org, r, 'call', 'MOCK Cancelled by caller',    '0891110009', null, 2, '2026-11-18', '19:00', '[Media] MOCK guest changed plans', 'cancelled', null, null),
    (org, r, 'line', 'MOCK Cancelled LINE',         null, 'mock_can_2', 3, '2026-11-22', '18:00', 'MOCK cancelled', 'cancelled', null, null);
  -- Keyed-in requests, each linked to a mock reservation.
  insert into public.booking_requests (organization_id, restaurant_id, channel, customer_name, phone, party_size, requested_date, requested_time, notes, status, reservation_id, handled_at)
  select org, r, case when row_number() over (order by x.reservation_date, x.reference) % 2 = 0 then 'line' else 'call' end,
         'MOCK Keyed ' || substr(x.customer_name, 6), x.phone, x.party_size, x.reservation_date, to_char(x.reservation_time, 'HH24:MI')::time,
         x.internal_notes, 'booked', x.id, now()
  from (select * from public.reservations where restaurant_id = r and reference like 'MOCK-%' and status in ('confirmed', 'pending') order by reservation_date, reference limit 4) x;
  alter table public.booking_requests enable trigger booking_request_before_write;
end $$;

-- Summary: reservations by status, and the busiest days.
select status, count(*) as reservations, sum(party_size) as guests from public.reservations where reference like 'MOCK-%' group by status order by status;
select status, count(*) as requests from public.booking_requests where customer_name like 'MOCK %' group by status order by status;
