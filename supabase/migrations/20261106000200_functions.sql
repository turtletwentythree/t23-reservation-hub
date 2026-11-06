-- T23 Reservation Hub: helper functions, triggers and RPCs

-- =========================================================================
-- Authorization helpers (private schema, not exposed through the REST API)
-- =========================================================================
create or replace function private.current_role_in(org uuid) returns public.app_role
language sql stable security definer set search_path = '' as $$
  select ur.role from public.user_roles ur
  join public.users u on u.id = ur.user_id and u.is_active
  where ur.user_id = auth.uid() and ur.organization_id = org
$$;

create or replace function private.has_any_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.users u on u.id = ur.user_id and u.is_active
    where ur.user_id = auth.uid() and ur.role = any(roles)
  )
$$;

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_any_role(array['super_admin']::public.app_role[])
$$;

create or replace function private.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.users u on u.id = ur.user_id and u.is_active
    where ur.user_id = auth.uid() and ur.organization_id = org
  )
$$;

-- Role of the current user for the organization owning a restaurant, if they may see it.
create or replace function private.restaurant_role(rid uuid) returns public.app_role
language sql stable security definer set search_path = '' as $$
  select ur.role
  from public.restaurants r
  join public.user_roles ur on ur.organization_id = r.organization_id and ur.user_id = auth.uid()
  join public.users u on u.id = ur.user_id and u.is_active
  where r.id = rid
    and (ur.role = 'super_admin'
         or exists (select 1 from public.restaurant_user_access a where a.user_id = auth.uid() and a.restaurant_id = rid))
$$;

create or replace function private.can_view_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.restaurant_role(rid) is not null
$$;

create or replace function private.can_operate_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.restaurant_role(rid) in ('super_admin','group_manager','restaurant_manager','host'), false)
$$;

create or replace function private.can_manage_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.restaurant_role(rid) in ('super_admin','restaurant_manager'), false)
$$;

create or replace function private.can_report_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.restaurant_role(rid) in ('super_admin','group_manager','restaurant_manager','viewer'), false)
$$;

-- Customers are organization-wide (central CRM).
create or replace function private.can_view_customers(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_org_member(org)
$$;

create or replace function private.can_edit_customers(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_role_in(org) in ('super_admin','group_manager','restaurant_manager','host'), false)
$$;

-- Public wrapper so the app can ask "what can I do here?" (returns only the caller's own info)
create or replace function public.my_restaurant_roles()
returns table (restaurant_id uuid, role public.app_role)
language sql stable security definer set search_path = '' as $$
  select r.id, private.restaurant_role(r.id)
  from public.restaurants r
  where private.restaurant_role(r.id) is not null
$$;

-- =========================================================================
-- New auth user -> public.users profile
-- =========================================================================
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- =========================================================================
-- Utilities
-- =========================================================================
create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  if d = '' then return null; end if;
  -- Thai local format 0XXXXXXXXX -> 66XXXXXXXXX
  if length(d) in (9, 10) and left(d, 1) = '0' then d := '66' || substr(d, 2); end if;
  return d;
end $$;

create or replace function private.customer_normalize() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  new.full_name := trim(new.full_name);
  return new;
end $$;
create trigger customer_normalize before insert or update of phone, full_name on public.customers
  for each row execute function private.customer_normalize();

create or replace function private.generate_reference() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
  i int;
begin
  loop
    ref := 'T23-';
    for i in 1..6 loop
      ref := ref || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.reservations where reference = ref);
  end loop;
  return ref;
end $$;

create or replace function private.reservation_is_active(s public.reservation_status) returns boolean
language sql immutable set search_path = '' as $$
  select s in ('pending','confirmed','arrived','seated')
$$;

-- =========================================================================
-- Reservations: derive timestamps, org, reference, lifecycle stamps
-- =========================================================================
create or replace function private.reservation_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tz text;
  org uuid;
begin
  select r.timezone, r.organization_id into tz, org from public.restaurants r where r.id = new.restaurant_id;
  if tz is null then raise exception 'restaurant % not found', new.restaurant_id; end if;

  new.organization_id := org;
  new.starts_at := (new.reservation_date + new.reservation_time) at time zone tz;
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);

  if tg_op = 'INSERT' then
    if new.reference is null or new.reference = '' then new.reference := private.generate_reference(); end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
  else
    new.reference := old.reference;            -- immutable
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'confirmed' then new.confirmed_at := coalesce(new.confirmed_at, now());
      when 'arrived'   then new.arrived_at   := coalesce(new.arrived_at, now());
      when 'seated'    then new.seated_at    := coalesce(new.seated_at, now()); new.arrived_at := coalesce(new.arrived_at, now());
      when 'completed' then new.completed_at := coalesce(new.completed_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      when 'no_show'   then new.no_show_at   := coalesce(new.no_show_at, now());
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger reservation_before_write before insert or update on public.reservations
  for each row execute function private.reservation_before_write();

-- Keep reservation_tables periods/active flags in sync with their reservation.
create or replace function private.reservation_buffer(rid uuid) returns interval
language sql stable security definer set search_path = '' as $$
  select make_interval(mins => coalesce((select buffer_minutes from public.booking_policies where restaurant_id = rid), 0))
$$;

create or replace function private.reservation_sync_tables() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.status is distinct from old.status then
    update public.reservation_tables rt
       set period = tstzrange(new.starts_at, new.ends_at + private.reservation_buffer(new.restaurant_id), '[)'),
           active = private.reservation_is_active(new.status)
     where rt.reservation_id = new.id;
  end if;
  return new;
end $$;

create trigger reservation_sync_tables after update on public.reservations
  for each row execute function private.reservation_sync_tables();

-- Fill period/restaurant on reservation_tables insert.
create or replace function private.reservation_tables_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare res record; trest uuid;
begin
  select * into res from public.reservations where id = new.reservation_id;
  select restaurant_id into trest from public.tables where id = new.table_id;
  if trest is distinct from res.restaurant_id then
    raise exception 'table does not belong to this restaurant' using errcode = '23514';
  end if;
  new.restaurant_id := res.restaurant_id;
  new.period := tstzrange(res.starts_at, res.ends_at + private.reservation_buffer(res.restaurant_id), '[)');
  new.active := private.reservation_is_active(res.status);
  return new;
end $$;

create trigger reservation_tables_before_insert before insert on public.reservation_tables
  for each row execute function private.reservation_tables_before_insert();

-- Reservation history -------------------------------------------------------
create or replace function private.jsonb_diff(old_row jsonb, new_row jsonb, ignore text[] default array['updated_at','updated_by']) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', old_row->n.key, 'to', n.value)), '{}'::jsonb)
  from jsonb_each(new_row) n
  where not (n.key = any(ignore)) and (old_row->n.key) is distinct from n.value
$$;

create or replace function private.reservation_history_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  diff jsonb;
  label text := coalesce(nullif(current_setting('app.actor_label', true), ''), case when auth.uid() is null then 'system' end);
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_history (reservation_id, change_type, to_status, changes, changed_by, actor_label)
    values (new.id, 'created', new.status,
            jsonb_build_object('party_size', new.party_size, 'date', new.reservation_date, 'time', new.reservation_time),
            auth.uid(), label);
  else
    diff := private.jsonb_diff(to_jsonb(old), to_jsonb(new),
      array['updated_at','updated_by','starts_at','ends_at','confirmed_at','arrived_at','seated_at','completed_at','cancelled_at','no_show_at','manage_token_hash','reminder_sent_at']);
    if diff = '{}'::jsonb then return new; end if;
    insert into public.reservation_history (reservation_id, change_type, from_status, to_status, changes, changed_by, actor_label)
    values (new.id,
            case when new.status is distinct from old.status then 'status_changed' else 'updated' end,
            old.status, new.status, diff, auth.uid(), label);
  end if;
  return new;
end $$;

create trigger reservation_history after insert or update on public.reservations
  for each row execute function private.reservation_history_trigger();

-- Customer statistics are recomputed from real reservation records.
create or replace function private.refresh_customer_stats(cid uuid) returns void
language sql security definer set search_path = '' as $$
  update public.customers c set
    total_visits = s.visits,
    total_no_shows = s.no_shows,
    total_cancellations = s.cancels,
    first_visit_at = s.first_visit,
    last_visit_at = s.last_visit
  from (
    select
      count(*) filter (where status in ('seated','completed'))::int as visits,
      count(*) filter (where status = 'no_show')::int as no_shows,
      count(*) filter (where status = 'cancelled')::int as cancels,
      min(starts_at) filter (where status in ('seated','completed')) as first_visit,
      max(starts_at) filter (where status in ('seated','completed')) as last_visit
    from public.reservations where customer_id = cid
  ) s
  where c.id = cid
$$;

create or replace function private.reservation_customer_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is not null and (tg_op = 'INSERT' or new.status is distinct from old.status or new.customer_id is distinct from old.customer_id) then
    perform private.refresh_customer_stats(new.customer_id);
  end if;
  if tg_op = 'UPDATE' and old.customer_id is not null and old.customer_id is distinct from new.customer_id then
    perform private.refresh_customer_stats(old.customer_id);
  end if;
  return new;
end $$;

create trigger reservation_customer_stats after insert or update on public.reservations
  for each row execute function private.reservation_customer_stats();

-- Waitlist queue numbers ----------------------------------------------------
create or replace function private.waitlist_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tz text;
begin
  select timezone into tz from public.restaurants where id = new.restaurant_id;
  new.queue_date := coalesce(new.queue_date, (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date);
  perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text || new.queue_date::text));
  select coalesce(max(queue_number), 0) + 1 into new.queue_number
    from public.waitlists where restaurant_id = new.restaurant_id and queue_date = new.queue_date;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;

create trigger waitlist_before_insert before insert on public.waitlists
  for each row execute function private.waitlist_before_insert();

-- =========================================================================
-- Audit logging
-- =========================================================================
create or replace function private.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  redact boolean := coalesce(tg_argv[0], '') = 'redact';
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  rec jsonb := coalesce(n, o);
  org uuid;
  rest uuid;
  diff jsonb;
  label text := coalesce(nullif(current_setting('app.actor_label', true), ''), case when auth.uid() is null then 'system' end);
begin
  rest := case when tg_table_name = 'restaurants' then (rec->>'id')::uuid else (rec->>'restaurant_id')::uuid end;
  org := coalesce((rec->>'organization_id')::uuid,
                  case when tg_table_name = 'organizations' then (rec->>'id')::uuid end,
                  (select organization_id from public.restaurants where id = rest));

  if tg_op = 'UPDATE' then
    diff := private.jsonb_diff(o, n, array['updated_at','updated_by','manage_token_hash']);
    if diff = '{}'::jsonb then return new; end if;
    o := (select jsonb_object_agg(key, value->'from') from jsonb_each(diff));
    n := (select jsonb_object_agg(key, value->'to') from jsonb_each(diff));
  end if;

  -- Personal data is not duplicated into the audit trail: keep field names only.
  if redact then
    o := (select jsonb_object_agg(key, '"[redacted]"'::jsonb) from jsonb_each(o));
    n := (select jsonb_object_agg(key, '"[redacted]"'::jsonb) from jsonb_each(n));
  else
    o := o - 'manage_token_hash' - 'key_hash' - 'secret_hash';
    n := n - 'manage_token_hash' - 'key_hash' - 'secret_hash';
  end if;

  insert into public.audit_logs (organization_id, restaurant_id, actor_id, actor_label, action, entity_type, entity_id, old_data, new_data)
  values (org, rest, auth.uid(), label, lower(tg_op), tg_table_name, (rec->>'id')::uuid, o, n);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','restaurants','restaurant_areas','tables','table_combinations','booking_types',
    'booking_policies','operating_hours','reservations','waitlists','user_roles','payments','refunds',
    'integrations','notification_templates','api_keys','webhook_endpoints','data_subject_requests','booking_sources']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_trigger()', t);
  end loop;
end $$;

create trigger audit after insert or update or delete on public.customers
  for each row execute function private.audit_trigger('redact');
create trigger audit after insert or update or delete on public.customer_consents
  for each row execute function private.audit_trigger();

-- restaurant_user_access has no id-bearing org column; log explicitly
create or replace function private.audit_access_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_rest uuid := case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
begin
  insert into public.audit_logs (organization_id, restaurant_id, actor_id, actor_label, action, entity_type, entity_id, new_data)
  values ((select organization_id from public.restaurants where id = v_rest), v_rest, auth.uid(),
          case when auth.uid() is null then 'system' end,
          case when tg_op = 'INSERT' then 'grant_access' else 'revoke_access' end,
          'restaurant_user_access', v_user, jsonb_build_object('user_id', v_user));
  return null;
end $$;
create trigger audit after insert or delete on public.restaurant_user_access
  for each row execute function private.audit_access_trigger();

-- =========================================================================
-- RPC: create a reservation with table assignment atomically.
-- SECURITY INVOKER: staff calls are governed by RLS; the server-side public
-- booking flow calls it with the service role after its own validation.
-- =========================================================================
create or replace function public.create_reservation(payload jsonb)
returns public.reservations
language plpgsql security invoker set search_path = '' as $$
declare
  rid uuid := (payload->>'restaurant_id')::uuid;
  org uuid;
  cust uuid := nullif(payload->>'customer_id', '')::uuid;
  phone_n text := public.normalize_phone(payload->>'phone');
  email_n text := lower(trim(nullif(payload->>'email', '')));
  table_ids uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload->'table_ids', '[]'::jsonb))::uuid), '{}');
  cap int;
  res public.reservations;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if auth.uid() is null then
    perform set_config('app.actor_label', coalesce(payload->>'actor_label', 'online_booking'), true);
  end if;

  select organization_id into org from public.restaurants where id = rid and is_active;
  if org is null then raise exception 'restaurant not available' using errcode = 'P0002'; end if;

  -- Capacity conflict detection
  if array_length(table_ids, 1) > 0 then
    select coalesce(sum(max_capacity), 0) into cap from public.tables
      where id = any(table_ids) and restaurant_id = rid and is_active;
    if cap < (payload->>'party_size')::int and not coalesce((payload->>'allow_over_capacity')::boolean, false) then
      raise exception 'party of % exceeds assigned table capacity of %', payload->>'party_size', cap using errcode = '23514', hint = 'capacity_conflict';
    end if;
    if exists (select 1 from public.tables where id = any(table_ids) and service_status = 'out_of_service') then
      raise exception 'a selected table is out of service' using errcode = '23514', hint = 'table_out_of_service';
    end if;
  end if;

  -- Find or create the central customer profile (duplicate detection by phone, then email)
  if cust is null and (phone_n is not null or email_n is not null) then
    select id into cust from public.customers
     where organization_id = org and anonymized_at is null
       and ((phone_n is not null and phone_normalized = phone_n) or (phone_n is null and email_n is not null and email_normalized = email_n))
     order by updated_at desc limit 1;
  end if;
  if cust is null then
    insert into public.customers (organization_id, full_name, phone, email, preferred_language, allergies, dietary_preferences)
    values (org, payload->>'customer_name', nullif(payload->>'phone', ''), nullif(payload->>'email', ''),
            coalesce(payload->>'language', 'en'), nullif(payload->>'allergies', ''), nullif(payload->>'dietary_requirements', ''))
    returning id into cust;
  end if;

  insert into public.reservations (
    restaurant_id, organization_id, customer_id, customer_name, phone, email, language,
    reservation_date, reservation_time, duration_minutes, starts_at, ends_at, party_size,
    booking_source_id, booking_type_id, special_occasion, dietary_requirements, allergies,
    guest_notes, internal_notes, deposit_amount, payment_status, status, is_walk_in,
    policy_accepted_at, manage_token_hash)
  values (
    rid, org, cust, payload->>'customer_name', nullif(payload->>'phone', ''), nullif(payload->>'email', ''),
    coalesce(payload->>'language', 'en'),
    (payload->>'reservation_date')::date, (payload->>'reservation_time')::time,
    (payload->>'duration_minutes')::int, now(), now() + interval '1 minute',  -- real values set by trigger
    (payload->>'party_size')::int,
    nullif(payload->>'booking_source_id', '')::uuid, nullif(payload->>'booking_type_id', '')::uuid,
    nullif(payload->>'special_occasion', ''), nullif(payload->>'dietary_requirements', ''), nullif(payload->>'allergies', ''),
    nullif(payload->>'guest_notes', ''), nullif(payload->>'internal_notes', ''),
    coalesce((payload->>'deposit_amount')::numeric, 0),
    coalesce((payload->>'payment_status')::public.payment_status, 'not_required'),
    coalesce((payload->>'status')::public.reservation_status, 'pending'),
    coalesce((payload->>'is_walk_in')::boolean, false),
    case when coalesce((payload->>'policy_accepted')::boolean, false) then now() end,
    nullif(payload->>'manage_token_hash', ''))
  returning * into res;

  insert into public.reservation_tables (reservation_id, table_id, restaurant_id, period)
  select res.id, t, rid, tstzrange(res.starts_at, res.ends_at)  -- period recomputed by trigger
  from unnest(table_ids) t;

  return res;
end $$;

-- Replace a reservation's table assignment atomically.
create or replace function public.assign_reservation_tables(p_reservation_id uuid, p_table_ids uuid[], p_allow_over_capacity boolean default false)
returns void
language plpgsql security invoker set search_path = '' as $$
declare res public.reservations; cap int;
begin
  select * into res from public.reservations where id = p_reservation_id;
  if res.id is null then raise exception 'reservation not found' using errcode = 'P0002'; end if;
  if coalesce(array_length(p_table_ids, 1), 0) > 0 then
    select coalesce(sum(max_capacity), 0) into cap from public.tables where id = any(p_table_ids) and restaurant_id = res.restaurant_id;
    if cap < res.party_size and not p_allow_over_capacity then
      raise exception 'party of % exceeds assigned table capacity of %', res.party_size, cap using errcode = '23514', hint = 'capacity_conflict';
    end if;
  end if;
  delete from public.reservation_tables where reservation_id = p_reservation_id and not (table_id = any(coalesce(p_table_ids, '{}')));
  insert into public.reservation_tables (reservation_id, table_id, restaurant_id, period)
  select p_reservation_id, t, res.restaurant_id, tstzrange(res.starts_at, res.ends_at)
  from unnest(coalesce(p_table_ids, '{}')) t
  where not exists (select 1 from public.reservation_tables x where x.reservation_id = p_reservation_id and x.table_id = t);
  insert into public.reservation_history (reservation_id, change_type, changes, changed_by)
  values (p_reservation_id, 'tables_changed', jsonb_build_object('table_ids', to_jsonb(p_table_ids)), auth.uid());
end $$;

-- Fixed-window rate limiter for public endpoints (called by the server with the service role).
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return c <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

revoke execute on function public.create_reservation(jsonb) from public, anon;
grant execute on function public.create_reservation(jsonb) to authenticated, service_role;
revoke execute on function public.assign_reservation_tables(uuid, uuid[], boolean) from public, anon;
grant execute on function public.assign_reservation_tables(uuid, uuid[], boolean) to authenticated, service_role;
revoke execute on function public.my_restaurant_roles() from public, anon;
grant execute on function public.my_restaurant_roles() to authenticated;
