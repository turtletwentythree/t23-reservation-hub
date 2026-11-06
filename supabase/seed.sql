-- T23 Reservation Hub seed data
-- Structural data (organization, 8 branches, areas, tables, hours, policies, sources, templates)
-- plus DEMO users and DEMO reservations for local development / UAT.
-- Demo records are clearly fictional (phones 080-000-xxxx, emails @example.com).
select set_config('app.actor_label', 'seed', false);

-- Organization ----------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-000000000001', 'Turtle23 Restaurant Group', 't23');

-- Booking sources ----------------------------------------------------------------
insert into public.booking_sources (organization_id, code, name, is_system) values
  ('00000000-0000-4000-8000-000000000001', 'online', 'Online booking', true),
  ('00000000-0000-4000-8000-000000000001', 'phone', 'Phone', true),
  ('00000000-0000-4000-8000-000000000001', 'walk_in', 'Walk-in', true),
  ('00000000-0000-4000-8000-000000000001', 'staff', 'Staff / in person', true),
  ('00000000-0000-4000-8000-000000000001', 'line', 'LINE', true),
  ('00000000-0000-4000-8000-000000000001', 'google', 'Google Business Profile', true),
  ('00000000-0000-4000-8000-000000000001', 'instagram', 'Instagram / Facebook', false),
  ('00000000-0000-4000-8000-000000000001', 'email', 'Email', false),
  ('00000000-0000-4000-8000-000000000001', 'concierge', 'Hotel concierge', false),
  ('00000000-0000-4000-8000-000000000001', 'api', 'External channel (API)', true);

-- Restaurants -------------------------------------------------------------------
insert into public.restaurants (id, organization_id, name, slug, cuisine, description, brand_color) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Capricci', 'capricci', 'Italian', 'Italian dining', '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Lawoi', 'lawoi', null, null, '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Kappo Takashi', 'kappo-takashi', 'Japanese (kappo)', 'Counter-style Japanese kappo dining', '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'BLY', 'bly', null, null, '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Sushi Saryu', 'sushi-saryu', 'Japanese (sushi)', 'Sushi counter', '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Maison Dunand', 'maison-dunand', 'French', 'French dining', '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'Marlo', 'marlo', null, null, '#2f7d4f'),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'Roi Chak Sam', 'roi-chak-sam', null, null, '#2f7d4f');

-- Policies, hours, areas, tables, booking types ---------------------------------
do $$
declare
  r record;
  main_area uuid;
  second_area uuid;
  counter_style boolean;
  t3 uuid; t4 uuid; combo uuid;
  d int;
  caps int[];
  i int;
begin
  for r in select * from public.restaurants loop
    counter_style := r.slug in ('kappo-takashi', 'sushi-saryu');

    insert into public.booking_policies (restaurant_id, default_duration_minutes, duration_rules, buffer_minutes, slot_interval_minutes,
      min_party_size, max_party_size, deposit_type, deposit_amount, deposit_min_party_size, no_show_fee_amount, large_party_threshold,
      cancellation_policy, booking_terms)
    values (r.id,
      case when counter_style then 150 else 120 end,
      case when counter_style then '[]'::jsonb else '[{"max_party":2,"minutes":90},{"max_party":4,"minutes":120},{"max_party":20,"minutes":150}]'::jsonb end,
      15, 15, 1, case when counter_style then 6 else 10 end,
      case when counter_style then 'per_person'::public.deposit_type else 'none'::public.deposit_type end,
      case when counter_style then 1000 else 0 end,
      1,
      case when counter_style then 1000 else 0 end,
      case when counter_style then 5 else 8 end,
      jsonb_build_object(
        'en', 'Free cancellation up to 24 hours before your reservation. Late cancellations and no-shows may forfeit the deposit.',
        'th', 'ยกเลิกได้ฟรีก่อนเวลาจอง 24 ชั่วโมง การยกเลิกล่าช้าหรือไม่มาตามนัดอาจถูกริบเงินมัดจำ',
        'ja', 'ご予約の24時間前までキャンセル無料です。直前のキャンセルや無断キャンセルの場合、デポジットは返金されないことがあります。',
        'fr', 'Annulation gratuite jusqu''à 24 heures avant votre réservation. En cas d''annulation tardive ou d''absence, l''acompte peut être conservé.'),
      jsonb_build_object(
        'en', 'Please arrive on time. Tables are held for 15 minutes.',
        'th', 'กรุณามาตรงเวลา ทางร้านจะเก็บโต๊ะไว้ 15 นาที',
        'ja', '時間厳守でお願いいたします。お席は15分間お取り置きいたします。',
        'fr', 'Merci d''arriver à l''heure. Les tables sont réservées pendant 15 minutes.'));

    for d in 0..6 loop
      if counter_style then
        if d = 1 then
          insert into public.operating_hours (restaurant_id, day_of_week, service_name, is_closed) values (r.id, d, 'Closed', true);
        else
          insert into public.operating_hours (restaurant_id, day_of_week, service_name, open_time, close_time, last_seating_time)
          values (r.id, d, 'Dinner', '18:00', '22:30', '20:30');
        end if;
      else
        insert into public.operating_hours (restaurant_id, day_of_week, service_name, open_time, close_time, last_seating_time) values
          (r.id, d, 'Lunch', '11:30', '15:00', '13:30'),
          (r.id, d, 'Dinner', '17:30', '23:00', '21:00');
      end if;
    end loop;

    if counter_style then
      insert into public.restaurant_areas (restaurant_id, name, sort_order) values (r.id, 'Counter', 0) returning id into main_area;
      insert into public.restaurant_areas (restaurant_id, name, sort_order) values (r.id, 'Private Room', 1) returning id into second_area;
      for i in 1..5 loop
        insert into public.tables (restaurant_id, area_id, label, min_capacity, max_capacity, shape, pos_x, pos_y, width, height, sort_order)
        values (r.id, main_area, 'C' || i, 1, 2, 'bar', 60 + (i - 1) * 140, 120, 120, 60, i);
      end loop;
      insert into public.tables (restaurant_id, area_id, label, min_capacity, max_capacity, shape, pos_x, pos_y, width, height, sort_order, is_combinable)
      values (r.id, second_area, 'P1', 2, 6, 'rect', 120, 120, 220, 120, 10, false);
      select id into t3 from public.tables where restaurant_id = r.id and label = 'C2';
      select id into t4 from public.tables where restaurant_id = r.id and label = 'C3';
      insert into public.booking_types (restaurant_id, name, description, duration_minutes, sort_order) values
        (r.id, '{"en":"Omakase course","th":"คอร์สโอมากาเสะ","ja":"おまかせコース","fr":"Menu omakase"}', '{"en":"Chef''s seasonal course","th":"คอร์สตามฤดูกาลของเชฟ","ja":"季節のおまかせ","fr":"Menu de saison du chef"}', 150, 0);
    else
      insert into public.restaurant_areas (restaurant_id, name, sort_order) values (r.id, 'Main Dining', 0) returning id into main_area;
      insert into public.restaurant_areas (restaurant_id, name, sort_order) values (r.id, 'Terrace', 1) returning id into second_area;
      caps := array[2, 2, 4, 4, 4, 6, 8];
      for i in 1..array_length(caps, 1) loop
        insert into public.tables (restaurant_id, area_id, label, min_capacity, max_capacity, shape, pos_x, pos_y, width, height, sort_order)
        values (r.id, main_area, 'T' || i, greatest(1, caps[i] - 2), caps[i],
                case when caps[i] <= 2 then 'round'::public.table_shape else 'rect'::public.table_shape end,
                60 + ((i - 1) % 4) * 200, 80 + ((i - 1) / 4) * 200,
                case when caps[i] >= 6 then 160 else 100 end, 100, i);
      end loop;
      for i in 1..4 loop
        insert into public.tables (restaurant_id, area_id, label, min_capacity, max_capacity, shape, pos_x, pos_y, width, height, sort_order)
        values (r.id, second_area, 'E' || i, 1, case when i <= 2 then 2 else 4 end, 'round', 80 + (i - 1) * 180, 140, 100, 100, 20 + i);
      end loop;
      select id into t3 from public.tables where restaurant_id = r.id and label = 'T3';
      select id into t4 from public.tables where restaurant_id = r.id and label = 'T4';
      insert into public.booking_types (restaurant_id, name, description, sort_order) values
        (r.id, '{"en":"À la carte","th":"อาหารตามสั่ง","ja":"アラカルト","fr":"À la carte"}', null, 0);
    end if;

    insert into public.table_combinations (restaurant_id, name, min_capacity, max_capacity)
    values (r.id, case when counter_style then 'C2+C3' else 'T3+T4' end, case when counter_style then 3 else 5 end, case when counter_style then 4 else 8 end)
    returning id into combo;
    insert into public.table_combination_members values (combo, t3), (combo, t4);
  end loop;
end $$;

-- Notification templates (organization defaults) ---------------------------------
insert into public.notification_templates (organization_id, event, channel, locale, subject, body) values
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'email', 'en', 'Your reservation at {{restaurant_name}} is confirmed',
   'Dear {{customer_name}},\n\nThank you for booking {{restaurant_name}}.\nReference: {{reference}}\nDate: {{date}} at {{time}}\nGuests: {{party_size}}\n\nManage your booking: {{manage_url}}\n\nWe look forward to welcoming you.'),
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'email', 'th', 'ยืนยันการจองที่ {{restaurant_name}}',
   'เรียน คุณ{{customer_name}}\n\nขอบคุณที่จองโต๊ะกับ {{restaurant_name}}\nหมายเลขการจอง: {{reference}}\nวันที่: {{date}} เวลา {{time}}\nจำนวน: {{party_size}} ท่าน\n\nจัดการการจอง: {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'email', 'ja', '{{restaurant_name}} ご予約確定のお知らせ',
   '{{customer_name}} 様\n\n{{restaurant_name}} をご予約いただきありがとうございます。\n予約番号: {{reference}}\n日時: {{date}} {{time}}\n人数: {{party_size}}名\n\nご予約の確認・変更: {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'sms', 'en', null,
   '{{restaurant_name}}: booking {{reference}} confirmed for {{date}} {{time}}, {{party_size}} guests. Manage: {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'line', 'en', null,
   '✅ {{restaurant_name}}\nBooking {{reference}} confirmed\n{{date}} {{time}} · {{party_size}} guests\n{{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_reminder', 'email', 'en', 'Reminder: {{restaurant_name}} tomorrow',
   'Dear {{customer_name}},\n\nThis is a reminder of your reservation at {{restaurant_name}} on {{date}} at {{time}} for {{party_size}} guests.\nReference: {{reference}}\nManage: {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_reminder', 'sms', 'en', null,
   'Reminder: {{restaurant_name}} {{date}} {{time}}, {{party_size}} guests. Ref {{reference}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_modification', 'email', 'en', 'Your reservation at {{restaurant_name}} was updated',
   'Dear {{customer_name}},\n\nYour reservation {{reference}} is now on {{date}} at {{time}} for {{party_size}} guests.\nManage: {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_cancellation', 'email', 'en', 'Your reservation at {{restaurant_name}} was cancelled',
   'Dear {{customer_name}},\n\nYour reservation {{reference}} on {{date}} at {{time}} has been cancelled.\nWe hope to welcome you another time.'),
  ('00000000-0000-4000-8000-000000000001', 'waitlist_ready', 'sms', 'en', null,
   '{{restaurant_name}}: your table is ready! Queue #{{queue_number}}. Please come to the host stand.'),
  ('00000000-0000-4000-8000-000000000001', 'waitlist_ready', 'line', 'en', null,
   '🔔 {{restaurant_name}}: your table is ready (queue #{{queue_number}}). Please come to the host stand.'),
  ('00000000-0000-4000-8000-000000000001', 'birthday_campaign', 'email', 'en', 'Happy birthday from {{restaurant_name}}',
   'Dear {{customer_name}},\n\nHappy birthday from all of us at T23! We would love to celebrate with you.'),
  ('00000000-0000-4000-8000-000000000001', 'booking_confirmation', 'email', 'fr', 'Votre réservation chez {{restaurant_name}} est confirmée',
   'Bonjour {{customer_name}},\n\nMerci d''avoir réservé chez {{restaurant_name}}.\nRéférence : {{reference}}\nDate : {{date}} à {{time}}\nConvives : {{party_size}}\n\nGérer votre réservation : {{manage_url}}\n\nNous avons hâte de vous accueillir.'),
  ('00000000-0000-4000-8000-000000000001', 'booking_reminder', 'email', 'fr', 'Rappel : {{restaurant_name}} demain',
   'Bonjour {{customer_name}},\n\nNous vous rappelons votre réservation chez {{restaurant_name}} le {{date}} à {{time}} pour {{party_size}} convives.\nRéférence : {{reference}}\nGérer : {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_modification', 'email', 'fr', 'Votre réservation chez {{restaurant_name}} a été modifiée',
   'Bonjour {{customer_name}},\n\nVotre réservation {{reference}} est désormais prévue le {{date}} à {{time}} pour {{party_size}} convives.\nGérer : {{manage_url}}'),
  ('00000000-0000-4000-8000-000000000001', 'booking_cancellation', 'email', 'fr', 'Votre réservation chez {{restaurant_name}} a été annulée',
   'Bonjour {{customer_name}},\n\nVotre réservation {{reference}} du {{date}} à {{time}} a été annulée.\nNous espérons vous accueillir une prochaine fois.');

-- Integrations registry (nothing is active until credentials are configured) --------
insert into public.integrations (organization_id, provider, category, display_name, status, notes) values
  ('00000000-0000-4000-8000-000000000001', 'foodstory', 'pos', 'FoodStory POS', 'pending', 'Pending: API access and vendor documentation not yet confirmed.'),
  ('00000000-0000-4000-8000-000000000001', 'line', 'messaging', 'LINE Messaging API', 'not_configured', null),
  ('00000000-0000-4000-8000-000000000001', 'resend', 'email', 'Email (Resend)', 'not_configured', null),
  ('00000000-0000-4000-8000-000000000001', 'twilio', 'sms', 'SMS (Twilio)', 'not_configured', null),
  ('00000000-0000-4000-8000-000000000001', 'whatsapp', 'messaging', 'WhatsApp Cloud API', 'not_configured', 'Optional channel.'),
  ('00000000-0000-4000-8000-000000000001', 'stripe', 'payment', 'Stripe', 'not_configured', null),
  ('00000000-0000-4000-8000-000000000001', 'omise', 'payment', 'Omise', 'not_configured', null),
  ('00000000-0000-4000-8000-000000000001', 'google_business', 'listing', 'Google Business Profile', 'not_configured', 'Use each restaurant''s booking URL as the reservation link.');

-- Customer tags -----------------------------------------------------------------------
insert into public.customer_tags (organization_id, name, color) values
  ('00000000-0000-4000-8000-000000000001', 'VIP', '#e8772e'),
  ('00000000-0000-4000-8000-000000000001', 'Regular', '#2f7d4f'),
  ('00000000-0000-4000-8000-000000000001', 'Hotel guest', '#3b82f6'),
  ('00000000-0000-4000-8000-000000000001', 'Influencer', '#a855f7'),
  ('00000000-0000-4000-8000-000000000001', 'Corporate', '#64748b');

-- DEMO users (password for all: T23demo!2026) -------------------------------------------
do $$
declare
  u record;
  org uuid := '00000000-0000-4000-8000-000000000001';
begin
  for u in select * from (values
    ('20000000-0000-4000-8000-000000000001'::uuid, 'admin@t23.example.com', 'Super Admin', 'super_admin'::public.app_role),
    ('20000000-0000-4000-8000-000000000002'::uuid, 'group.manager@t23.example.com', 'Group Manager', 'group_manager'::public.app_role),
    ('20000000-0000-4000-8000-000000000003'::uuid, 'manager.capricci@t23.example.com', 'Capricci Manager', 'restaurant_manager'::public.app_role),
    ('20000000-0000-4000-8000-000000000004'::uuid, 'host.capricci@t23.example.com', 'Capricci Host', 'host'::public.app_role),
    ('20000000-0000-4000-8000-000000000005'::uuid, 'viewer@t23.example.com', 'Read-only Viewer', 'viewer'::public.app_role),
    ('20000000-0000-4000-8000-000000000006'::uuid, 'host.saryu@t23.example.com', 'Sushi Saryu Host', 'host'::public.app_role)
  ) as t(id, email, full_name, role) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('T23demo!2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    insert into public.user_roles (user_id, organization_id, role) values (u.id, org, u.role);
  end loop;

  -- Branch access
  insert into public.restaurant_user_access (user_id, restaurant_id)
  select '20000000-0000-4000-8000-000000000002', id from public.restaurants where slug in ('capricci','lawoi','bly','marlo');
  insert into public.restaurant_user_access (user_id, restaurant_id) values
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
    ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001'),
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001'),
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005');
end $$;

-- DEMO customers & reservations ------------------------------------------------------------
do $$
declare
  org uuid := '00000000-0000-4000-8000-000000000001';
  first_names text[] := array['Somchai','Suda','Anan','Kanya','Niran','Ploy','James','Emily','Oliver','Sophie','Hiroshi','Yuki','Kenji','Aiko','Lucas','Chloe','Arthit','Malee','Daniel','Hana'];
  last_names text[] := array['Srisuk','Wongsa','Chaiyaporn','Smith','Brown','Tanaka','Suzuki','Sato','Martin','Rossi','Kittisak','Johnson'];
  occasions text[] := array[null, null, null, 'Birthday', 'Anniversary', 'Business', null, 'Date night'];
  langs text[] := array['th','en','ja'];
  i int;
  cust_ids uuid[] := '{}';
  cid uuid;
  r record;
  tb record;
  d date;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  svc record;
  st public.reservation_status;
  src uuid[];
  res_id uuid;
  party int;
  roll float;
begin
  perform setseed(0.23);
  select array_agg(id order by code) into src from public.booking_sources where organization_id = org and code in ('online','phone','line','google','walk_in','staff');

  for i in 1..80 loop
    insert into public.customers (organization_id, full_name, phone, email, preferred_language, is_vip, birthday, allergies)
    values (org,
      first_names[1 + (i % array_length(first_names, 1))] || ' ' || last_names[1 + ((i * 7) % array_length(last_names, 1))],
      '080-000-' || lpad(i::text, 4, '0'),
      'guest' || i || '@example.com',
      langs[1 + (i % 3)],
      i % 13 = 0,
      make_date(1970 + (i % 35), 1 + (i % 12), 1 + (i % 28)),
      case when i % 9 = 0 then 'Shellfish' when i % 11 = 0 then 'Peanuts' end)
    returning id into cid;
    cust_ids := cust_ids || cid;
  end loop;

  for r in select * from public.restaurants loop
    for d in select generate_series(today - 35, today + 10, interval '1 day')::date loop
      for svc in select oh.* from public.operating_hours oh where oh.restaurant_id = r.id and oh.day_of_week = extract(dow from d) and not oh.is_closed loop
        for tb in select * from public.tables t where t.restaurant_id = r.id and t.is_active order by sort_order loop
          roll := random();
          continue when roll > case when svc.service_name = 'Lunch' then 0.35 else 0.6 end;
          party := greatest(tb.min_capacity, least(tb.max_capacity, tb.min_capacity + floor(random() * (tb.max_capacity - tb.min_capacity + 1))::int));
          roll := random();
          if d < today then
            st := case when roll < 0.82 then 'completed' when roll < 0.92 then 'cancelled' else 'no_show' end;
          elsif d = today and svc.close_time <= (now() at time zone r.timezone)::time then
            st := case when roll < 0.82 then 'completed' when roll < 0.92 then 'cancelled' else 'no_show' end;
          elsif d = today and svc.open_time <= (now() at time zone r.timezone)::time then
            -- service in progress: guests on the floor right now
            st := case when roll < 0.3 then 'arrived' when roll < 0.8 then 'seated' when roll < 0.9 then 'completed' else 'cancelled' end;
          else
            st := case when roll < 0.75 then 'confirmed' when roll < 0.93 then 'pending' else 'cancelled' end;
          end if;
          cid := cust_ids[1 + floor(random() * array_length(cust_ids, 1))::int];
          insert into public.reservations (restaurant_id, organization_id, customer_id, customer_name, phone, email, language,
            reservation_date, reservation_time, duration_minutes, starts_at, ends_at, party_size, booking_source_id,
            special_occasion, status, created_at)
          select r.id, org, c.id, c.full_name, c.phone, c.email, c.preferred_language,
            d, svc.open_time + make_interval(mins => (floor(random() * 3) * 30)::int), 90, now(), now() + interval '1 minute',
            party, src[1 + floor(random() * array_length(src, 1))::int],
            occasions[1 + floor(random() * array_length(occasions, 1))::int], st,
            (d - (1 + floor(random() * 14))::int)::timestamptz
          from public.customers c where c.id = cid
          returning id into res_id;
          insert into public.reservation_tables (reservation_id, table_id, restaurant_id, period)
          values (res_id, tb.id, r.id, tstzrange(now(), now() + interval '1 minute'));
        end loop;
      end loop;
    end loop;
  end loop;

  -- Demo payments: deposits actually recorded for counter restaurants' upcoming bookings
  insert into public.payments (organization_id, restaurant_id, reservation_id, kind, provider, amount, status, paid_at, note)
  select res.organization_id, res.restaurant_id, res.id, 'deposit', 'manual_transfer', 1000 * res.party_size, 'succeeded', res.created_at, 'Demo seed'
  from public.reservations res join public.restaurants rr on rr.id = res.restaurant_id
  where rr.slug in ('kappo-takashi','sushi-saryu') and res.status in ('confirmed','completed');
  update public.reservations res set deposit_amount = 1000 * party_size, payment_status = 'paid'
  where exists (select 1 from public.payments p where p.reservation_id = res.id and p.status = 'succeeded');
  update public.reservations res set deposit_amount = 1000 * party_size, payment_status = 'pending'
  from public.restaurants rr where rr.id = res.restaurant_id and rr.slug in ('kappo-takashi','sushi-saryu') and res.status = 'pending';
end $$;

-- Demo consent ledger
insert into public.customer_consents (customer_id, consent_type, granted, source)
select id, 'data_processing', true, 'import' from public.customers;
insert into public.customer_consents (customer_id, consent_type, granted, source)
select id, 'marketing_email', (row_number() over ()) % 3 <> 0, 'import' from public.customers;

-- Tag VIPs
insert into public.customer_tag_assignments (customer_id, tag_id)
select c.id, t.id from public.customers c join public.customer_tags t on t.name = 'VIP' where c.is_vip;
