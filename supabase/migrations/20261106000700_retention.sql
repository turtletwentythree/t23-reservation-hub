-- PDPA data retention: anonymize guests inactive for N months (no upcoming bookings),
-- and purge old notification bodies / rate-limit rows. Dry run returns counts only.
create or replace function public.apply_retention(p_months int, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
  cutoff timestamptz := now() - make_interval(months => greatest(p_months, 6));
  ids uuid[];
  c uuid;
  logs int;
begin
  select organization_id into org from public.user_roles where user_id = auth.uid() and role = 'super_admin' limit 1;
  if org is null then raise exception 'not authorized' using errcode = '42501'; end if;
  select coalesce(array_agg(cu.id), '{}') into ids from public.customers cu
   where cu.organization_id = org and cu.anonymized_at is null
     and coalesce(cu.last_visit_at, cu.created_at) < cutoff and cu.updated_at < cutoff
     and not exists (select 1 from public.reservations r where r.customer_id = cu.id and (r.starts_at >= cutoff or r.status in ('pending','confirmed','arrived','seated')));
  select count(*) into logs from public.notification_logs where organization_id = org and created_at < cutoff and body <> '[erased]';
  if not p_dry_run then
    foreach c in array ids loop
      perform public.anonymize_customer(c, format('Retention policy: inactive > %s months', p_months));
    end loop;
    update public.notification_logs set body = '[erased]', subject = null, recipient = '[erased]' where organization_id = org and created_at < cutoff;
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return jsonb_build_object('customers', coalesce(array_length(ids, 1), 0), 'notification_logs', logs, 'cutoff', cutoff, 'dry_run', p_dry_run);
end $$;
revoke execute on function public.apply_retention(int, boolean) from public, anon;
grant execute on function public.apply_retention(int, boolean) to authenticated;
