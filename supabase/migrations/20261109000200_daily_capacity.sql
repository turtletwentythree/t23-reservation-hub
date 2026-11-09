-- Guests a restaurant accepts per day (interim phone / LINE flow).
-- A default per restaurant, plus optional per-day overrides. Safe to run more than once.

alter table public.restaurants
  add column if not exists default_daily_capacity int check (default_daily_capacity is null or default_daily_capacity >= 0);

create table if not exists public.daily_capacity (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day date not null,
  capacity int check (capacity is null or capacity >= 0), -- null = use the restaurant default
  note text,
  updated_by uuid references public.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, day)
);

alter table public.daily_capacity enable row level security;

drop policy if exists daily_capacity_select on public.daily_capacity;
create policy daily_capacity_select on public.daily_capacity for select to authenticated
  using (private.can_view_restaurant(restaurant_id));

drop policy if exists daily_capacity_write on public.daily_capacity;
create policy daily_capacity_write on public.daily_capacity for all to authenticated
  using (private.can_manage_restaurant(restaurant_id))
  with check (private.can_manage_restaurant(restaurant_id));

grant select, insert, update, delete on public.daily_capacity to authenticated;

drop trigger if exists audit on public.daily_capacity;
create trigger audit after insert or update or delete on public.daily_capacity
  for each row execute function private.audit_trigger();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_capacity') then
    alter publication supabase_realtime add table public.daily_capacity;
  end if;
end $$;
