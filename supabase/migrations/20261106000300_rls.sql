-- T23 Reservation Hub: Row Level Security
-- Every table has RLS enabled. anon has no direct table access at all; public
-- booking runs server-side with the service role after validation.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Organizations ------------------------------------------------------------
create policy org_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (private.current_role_in(id) = 'super_admin') with check (private.current_role_in(id) = 'super_admin');

-- Restaurants ----------------------------------------------------------------
create policy restaurants_select on public.restaurants for select to authenticated
  using (private.can_view_restaurant(id));
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (private.current_role_in(organization_id) = 'super_admin');
create policy restaurants_update on public.restaurants for update to authenticated
  using (private.can_manage_restaurant(id))
  with check (private.can_manage_restaurant(id) and private.is_org_member(organization_id));
create policy restaurants_delete on public.restaurants for delete to authenticated
  using (private.current_role_in(organization_id) = 'super_admin');

-- Restaurant configuration (view: assigned staff; write: managers) -----------
do $$
declare t text;
begin
  foreach t in array array['restaurant_areas','tables','table_combinations','booking_types','booking_policies','operating_hours'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (private.can_view_restaurant(restaurant_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.can_manage_restaurant(restaurant_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (private.can_manage_restaurant(restaurant_id)) with check (private.can_manage_restaurant(restaurant_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (private.can_manage_restaurant(restaurant_id))', t);
  end loop;
end $$;

create policy tcm_select on public.table_combination_members for select to authenticated
  using (exists (select 1 from public.table_combinations c where c.id = combination_id and private.can_view_restaurant(c.restaurant_id)));
create policy tcm_write on public.table_combination_members for all to authenticated
  using (exists (select 1 from public.table_combinations c where c.id = combination_id and private.can_manage_restaurant(c.restaurant_id)))
  with check (exists (select 1 from public.table_combinations c join public.tables t on t.id = table_id
                      where c.id = combination_id and t.restaurant_id = c.restaurant_id and private.can_manage_restaurant(c.restaurant_id)));

-- Hosts may change a table's service status (cleaning / out of service) without layout rights.
create or replace function public.set_table_service_status(p_table_id uuid, p_status public.table_service_status)
returns void language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  select restaurant_id into rid from public.tables where id = p_table_id;
  if rid is null or not private.can_operate_restaurant(rid) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.tables set service_status = p_status where id = p_table_id;
end $$;
revoke execute on function public.set_table_service_status(uuid, public.table_service_status) from public, anon;
grant execute on function public.set_table_service_status(uuid, public.table_service_status) to authenticated;

-- Users & roles --------------------------------------------------------------
create policy users_select on public.users for select to authenticated
  using (id = auth.uid()
         or exists (select 1 from public.user_roles ur where ur.user_id = users.id and private.is_org_member(ur.organization_id)));
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid() or private.is_super_admin())
  with check (id = auth.uid() or private.is_super_admin());

-- Only super admins may change is_active / email, even on their own row.
create or replace function private.users_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_super_admin() then
    if new.is_active is distinct from old.is_active or new.email is distinct from old.email then
      raise exception 'only a super admin can change account status or email' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger users_guard before update on public.users for each row execute function private.users_guard();

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.is_org_member(organization_id));
create policy user_roles_write on public.user_roles for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin')
  with check (private.current_role_in(organization_id) = 'super_admin');

create policy access_select on public.restaurant_user_access for select to authenticated
  using (user_id = auth.uid() or private.is_super_admin());
create policy access_write on public.restaurant_user_access for all to authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and private.current_role_in(r.organization_id) = 'super_admin'))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and private.current_role_in(r.organization_id) = 'super_admin'));

-- Customers (central CRM) ----------------------------------------------------
create policy customers_select on public.customers for select to authenticated
  using (private.can_view_customers(organization_id));
create policy customers_insert on public.customers for insert to authenticated
  with check (private.can_edit_customers(organization_id));
create policy customers_update on public.customers for update to authenticated
  using (private.can_edit_customers(organization_id)) with check (private.can_edit_customers(organization_id));
create policy customers_delete on public.customers for delete to authenticated
  using (private.current_role_in(organization_id) = 'super_admin');

create policy tags_select on public.customer_tags for select to authenticated using (private.can_view_customers(organization_id));
create policy tags_write on public.customer_tags for all to authenticated
  using (private.can_edit_customers(organization_id)) with check (private.can_edit_customers(organization_id));

create policy tag_assign_select on public.customer_tag_assignments for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and private.can_view_customers(c.organization_id)));
create policy tag_assign_write on public.customer_tag_assignments for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and private.can_edit_customers(c.organization_id)))
  with check (exists (select 1 from public.customers c join public.customer_tags t on t.id = tag_id
                      where c.id = customer_id and t.organization_id = c.organization_id and private.can_edit_customers(c.organization_id)));

create policy consents_select on public.customer_consents for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and private.can_view_customers(c.organization_id)));
create policy consents_insert on public.customer_consents for insert to authenticated
  with check (exists (select 1 from public.customers c where c.id = customer_id and private.can_edit_customers(c.organization_id)));
-- consent rows are an append-only ledger: no update/delete policies

-- Booking sources ------------------------------------------------------------
create policy sources_select on public.booking_sources for select to authenticated using (private.is_org_member(organization_id));
create policy sources_write on public.booking_sources for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin') with check (private.current_role_in(organization_id) = 'super_admin');

-- Reservations ---------------------------------------------------------------
create policy reservations_select on public.reservations for select to authenticated
  using (private.can_view_restaurant(restaurant_id));
create policy reservations_insert on public.reservations for insert to authenticated
  with check (private.can_operate_restaurant(restaurant_id));
create policy reservations_update on public.reservations for update to authenticated
  using (private.can_operate_restaurant(restaurant_id)) with check (private.can_operate_restaurant(restaurant_id));
create policy reservations_delete on public.reservations for delete to authenticated
  using (private.is_super_admin() and private.can_view_restaurant(restaurant_id));

create policy rt_select on public.reservation_tables for select to authenticated using (private.can_view_restaurant(restaurant_id));
create policy rt_insert on public.reservation_tables for insert to authenticated
  with check (exists (select 1 from public.reservations r where r.id = reservation_id and private.can_operate_restaurant(r.restaurant_id)));
create policy rt_update on public.reservation_tables for update to authenticated
  using (private.can_operate_restaurant(restaurant_id)) with check (private.can_operate_restaurant(restaurant_id));
create policy rt_delete on public.reservation_tables for delete to authenticated using (private.can_operate_restaurant(restaurant_id));

create policy history_select on public.reservation_history for select to authenticated
  using (exists (select 1 from public.reservations r where r.id = reservation_id and private.can_view_restaurant(r.restaurant_id)));

-- Waitlist -------------------------------------------------------------------
create policy waitlists_select on public.waitlists for select to authenticated using (private.can_view_restaurant(restaurant_id));
create policy waitlists_insert on public.waitlists for insert to authenticated with check (private.can_operate_restaurant(restaurant_id));
create policy waitlists_update on public.waitlists for update to authenticated
  using (private.can_operate_restaurant(restaurant_id)) with check (private.can_operate_restaurant(restaurant_id));

-- Notifications --------------------------------------------------------------
create policy templates_select on public.notification_templates for select to authenticated
  using (private.is_org_member(organization_id));
create policy templates_write on public.notification_templates for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin' or (restaurant_id is not null and private.can_manage_restaurant(restaurant_id)))
  with check (private.current_role_in(organization_id) = 'super_admin' or (restaurant_id is not null and private.can_manage_restaurant(restaurant_id)));

create policy notif_logs_select on public.notification_logs for select to authenticated
  using (case when restaurant_id is null then private.current_role_in(organization_id) = 'super_admin'
              else private.can_view_restaurant(restaurant_id) end);

-- Payments -------------------------------------------------------------------
create policy payments_select on public.payments for select to authenticated using (private.can_view_restaurant(restaurant_id));
create policy payments_insert on public.payments for insert to authenticated with check (private.can_operate_restaurant(restaurant_id));
create policy payments_update on public.payments for update to authenticated
  using (private.can_operate_restaurant(restaurant_id)) with check (private.can_operate_restaurant(restaurant_id));

create policy refunds_select on public.refunds for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and private.can_view_restaurant(p.restaurant_id)));
create policy refunds_write on public.refunds for insert to authenticated
  with check (exists (select 1 from public.payments p where p.id = payment_id and private.can_manage_restaurant(p.restaurant_id)));
create policy refunds_update on public.refunds for update to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and private.can_manage_restaurant(p.restaurant_id)));

-- Integrations / API / webhooks ---------------------------------------------
create policy integrations_select on public.integrations for select to authenticated
  using (private.current_role_in(organization_id) in ('super_admin','group_manager')
         or (restaurant_id is not null and private.can_manage_restaurant(restaurant_id)));
create policy integrations_write on public.integrations for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin')
  with check (private.current_role_in(organization_id) = 'super_admin');

create policy api_keys_all on public.api_keys for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin') with check (private.current_role_in(organization_id) = 'super_admin');
create policy webhooks_all on public.webhook_endpoints for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin') with check (private.current_role_in(organization_id) = 'super_admin');
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (exists (select 1 from public.webhook_endpoints e where e.id = endpoint_id and private.current_role_in(e.organization_id) = 'super_admin'));

-- Audit & PDPA ---------------------------------------------------------------
create policy audit_select on public.audit_logs for select to authenticated
  using (private.current_role_in(organization_id) = 'super_admin'
         or (restaurant_id is not null and private.restaurant_role(restaurant_id) in ('group_manager','restaurant_manager')));

create policy dsr_all on public.data_subject_requests for all to authenticated
  using (private.current_role_in(organization_id) = 'super_admin') with check (private.current_role_in(organization_id) = 'super_admin');

-- rate_limits: no policies -> only service role.

-- Realtime ---------------------------------------------------------------------
alter publication supabase_realtime add table public.reservations, public.reservation_tables, public.tables, public.waitlists;
