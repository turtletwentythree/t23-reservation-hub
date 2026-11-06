-- Occupancy feed for the availability engine (SECURITY INVOKER: RLS applies to staff callers).
create or replace function public.table_occupancy(p_restaurant_id uuid, p_from timestamptz, p_to timestamptz)
returns table (table_id uuid, reservation_id uuid, starts timestamptz, ends timestamptz)
language sql stable security invoker set search_path = '' as $$
  select rt.table_id, rt.reservation_id, lower(rt.period), upper(rt.period)
  from public.reservation_tables rt
  where rt.restaurant_id = p_restaurant_id
    and rt.active
    and rt.period && tstzrange(p_from, p_to, '[)')
$$;
revoke execute on function public.table_occupancy(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.table_occupancy(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- Tables occupied at a given instant (for "available tables now").
create or replace function public.table_occupancy_now(p_restaurant_ids uuid[], p_at timestamptz)
returns table (table_id uuid, reservation_id uuid)
language sql stable security invoker set search_path = '' as $$
  select rt.table_id, rt.reservation_id
  from public.reservation_tables rt
  join public.reservations r on r.id = rt.reservation_id
  where rt.restaurant_id = any(p_restaurant_ids)
    and rt.active
    and (r.status in ('arrived','seated') or rt.period @> p_at)
    and lower(rt.period) <= p_at + interval '15 minutes'
$$;
revoke execute on function public.table_occupancy_now(uuid[], timestamptz) from public, anon;
grant execute on function public.table_occupancy_now(uuid[], timestamptz) to authenticated, service_role;
