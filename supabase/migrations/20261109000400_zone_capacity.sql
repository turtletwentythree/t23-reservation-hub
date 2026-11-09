-- Guests accepted per zone (room): a default per zone plus optional per-day numbers.
-- Run after daily-capacity.sql. Safe to run more than once.

alter table public.restaurant_areas
  add column if not exists default_daily_capacity int check (default_daily_capacity is null or default_daily_capacity >= 0);

create table if not exists public.daily_zone_capacity (
  area_id uuid not null references public.restaurant_areas(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day date not null,
  capacity int not null check (capacity >= 0),
  updated_by uuid references public.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (area_id, day)
);
create index if not exists daily_zone_capacity_restaurant_day on public.daily_zone_capacity (restaurant_id, day);

alter table public.daily_zone_capacity enable row level security;

drop policy if exists daily_zone_capacity_select on public.daily_zone_capacity;
create policy daily_zone_capacity_select on public.daily_zone_capacity for select to authenticated
  using (private.can_view_restaurant(restaurant_id));

drop policy if exists daily_zone_capacity_write on public.daily_zone_capacity;
create policy daily_zone_capacity_write on public.daily_zone_capacity for all to authenticated
  using (private.can_manage_restaurant(restaurant_id))
  with check (private.can_manage_restaurant(restaurant_id));

grant select, insert, update, delete on public.daily_zone_capacity to authenticated;

drop trigger if exists audit on public.daily_zone_capacity;
create trigger audit after insert or update or delete on public.daily_zone_capacity
  for each row execute function private.audit_trigger();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_zone_capacity') then
    alter publication supabase_realtime add table public.daily_zone_capacity;
  end if;
end $$;
