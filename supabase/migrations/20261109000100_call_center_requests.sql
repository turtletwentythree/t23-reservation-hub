-- Interim phone / LINE booking flow.
-- A Call Center role takes booking requests (by phone or LINE) and hands them to
-- front-of-house (Store) staff, who key them into the system as reservations.
-- Safe to run more than once.

-- New role. Policies below compare roles as text so this script also works when
-- run in one transaction (a new enum value cannot be used before it is committed).
alter type public.app_role add value if not exists 'call_center';

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  channel text not null default 'call' check (channel in ('call','line')),
  customer_name text not null check (length(trim(customer_name)) > 0),
  phone text,
  line_id text,
  party_size int not null check (party_size between 1 and 200),
  requested_date date not null,
  requested_time time not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','booked','declined','cancelled')),
  reservation_id uuid references public.reservations(id) on delete set null,
  decline_reason text,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_requests_restaurant_date on public.booking_requests (restaurant_id, requested_date);
create index if not exists booking_requests_status on public.booking_requests (status, created_at desc);

create or replace function private.booking_request_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.organization_id := (select organization_id from public.restaurants where id = new.restaurant_id);
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.status := 'pending';
  else
    new.organization_id := old.organization_id;
    new.restaurant_id := old.restaurant_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- The Call Center may only edit or cancel its own requests while they are still pending.
    if not private.can_operate_restaurant(old.restaurant_id) then
      if old.status <> 'pending' or new.status not in ('pending','cancelled') or new.reservation_id is distinct from old.reservation_id then
        raise exception 'Only store staff can change a handled request' using errcode = '42501';
      end if;
    end if;
    if new.status is distinct from old.status and new.status <> 'pending' then
      new.handled_by := auth.uid();
      new.handled_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists booking_request_before_write on public.booking_requests;
create trigger booking_request_before_write before insert or update on public.booking_requests
  for each row execute function private.booking_request_before_write();

drop trigger if exists audit on public.booking_requests;
create trigger audit after insert or update or delete on public.booking_requests
  for each row execute function private.audit_trigger();

alter table public.booking_requests enable row level security;

drop policy if exists booking_requests_select on public.booking_requests;
create policy booking_requests_select on public.booking_requests for select to authenticated
  using (private.can_view_restaurant(restaurant_id));

-- Call Center and Store (and managers / Admin) can log a request. View-only users cannot.
drop policy if exists booking_requests_insert on public.booking_requests;
create policy booking_requests_insert on public.booking_requests for insert to authenticated
  with check (coalesce(private.restaurant_role(restaurant_id)::text in ('super_admin','group_manager','restaurant_manager','host','call_center'), false));

-- Store staff handle any request; the Call Center can edit or cancel the requests it logged.
drop policy if exists booking_requests_update on public.booking_requests;
create policy booking_requests_update on public.booking_requests for update to authenticated
  using (private.can_operate_restaurant(restaurant_id)
         or (created_by = auth.uid() and private.restaurant_role(restaurant_id)::text = 'call_center'))
  with check (private.can_operate_restaurant(restaurant_id)
         or (created_by = auth.uid() and private.restaurant_role(restaurant_id)::text = 'call_center'));

grant select, insert, update on public.booking_requests to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_requests') then
    alter publication supabase_realtime add table public.booking_requests;
  end if;
end $$;

-- If an Admin already saved page switches, switch the two new pages on for Store
-- (and Table availability for View) so nobody loses them.
update public.organizations
  set page_access = jsonb_set(page_access, '{host}', (page_access->'host') || '["requests","availability"]'::jsonb)
  where jsonb_typeof(page_access->'host') = 'array' and not (page_access->'host') ? 'requests';
update public.organizations
  set page_access = jsonb_set(page_access, '{viewer}', (page_access->'viewer') || '["availability"]'::jsonb)
  where jsonb_typeof(page_access->'viewer') = 'array' and not (page_access->'viewer') ? 'availability';
