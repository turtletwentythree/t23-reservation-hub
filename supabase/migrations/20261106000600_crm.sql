-- CRM: duplicate detection, merge, PDPA anonymization

create or replace function public.find_duplicate_customers(p_limit int default 100)
returns table (customer_a uuid, customer_b uuid, reason text, name_a text, name_b text, phone_a text, phone_b text)
language sql stable security invoker set search_path = '' as $$
  select a.id, b.id,
         case when a.phone_normalized = b.phone_normalized then 'same phone'
              when a.email_normalized = b.email_normalized then 'same email'
              else 'similar name' end,
         a.full_name, b.full_name, a.phone, b.phone
  from public.customers a
  join public.customers b on b.organization_id = a.organization_id and a.id < b.id
  where a.anonymized_at is null and b.anonymized_at is null
    and (
      (a.phone_normalized is not null and a.phone_normalized = b.phone_normalized)
      or (a.email_normalized is not null and a.email_normalized = b.email_normalized)
      or (extensions.similarity(a.full_name, b.full_name) > 0.85 and length(a.full_name) > 5)
    )
  limit p_limit
$$;
revoke execute on function public.find_duplicate_customers(int) from public, anon;
grant execute on function public.find_duplicate_customers(int) to authenticated;

create or replace function public.merge_customers(p_primary uuid, p_duplicate uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare org uuid; dup public.customers;
begin
  select organization_id into org from public.customers where id = p_primary;
  select * into dup from public.customers where id = p_duplicate and organization_id = org;
  if org is null or dup.id is null or p_primary = p_duplicate then raise exception 'customers not found in the same organization' using errcode = 'P0002'; end if;
  if coalesce(private.current_role_in(org) not in ('super_admin','group_manager','restaurant_manager'), true) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.reservations set customer_id = p_primary where customer_id = p_duplicate;
  update public.waitlists set customer_id = p_primary where customer_id = p_duplicate;
  update public.notification_logs set customer_id = p_primary where customer_id = p_duplicate;
  update public.data_subject_requests set customer_id = p_primary where customer_id = p_duplicate;
  update public.customer_consents set customer_id = p_primary where customer_id = p_duplicate;
  insert into public.customer_tag_assignments (customer_id, tag_id)
    select p_primary, tag_id from public.customer_tag_assignments where customer_id = p_duplicate
    on conflict do nothing;
  update public.customers c set
    phone = coalesce(c.phone, dup.phone),
    email = coalesce(c.email, dup.email),
    birthday = coalesce(c.birthday, dup.birthday),
    is_vip = c.is_vip or dup.is_vip,
    allergies = nullif(concat_ws('; ', c.allergies, case when dup.allergies is distinct from c.allergies then dup.allergies end), ''),
    dietary_preferences = coalesce(c.dietary_preferences, dup.dietary_preferences),
    internal_notes = nullif(concat_ws(E'\n', c.internal_notes, dup.internal_notes), ''),
    line_user_id = coalesce(c.line_user_id, dup.line_user_id)
  where c.id = p_primary;
  delete from public.customers where id = p_duplicate;
  perform private.refresh_customer_stats(p_primary);
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, new_data)
  values (org, auth.uid(), 'merge', 'customers', p_primary, jsonb_build_object('merged_customer_id', p_duplicate));
end $$;
revoke execute on function public.merge_customers(uuid, uuid) from public, anon;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

-- PDPA right to erasure: irreversibly removes personal data while keeping
-- anonymous booking statistics (covers, dates) intact for reporting.
create or replace function public.anonymize_customer(p_customer_id uuid, p_request_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare org uuid;
begin
  select organization_id into org from public.customers where id = p_customer_id;
  if org is null then raise exception 'customer not found' using errcode = 'P0002'; end if;
  if coalesce(private.current_role_in(org) <> 'super_admin', true) then raise exception 'not authorized' using errcode = '42501'; end if;

  perform set_config('app.actor_label', 'pdpa_erasure', true);
  update public.reservations set customer_name = 'Anonymized guest', phone = null, email = null, guest_notes = null,
    internal_notes = null, allergies = null, dietary_requirements = null, special_occasion = null
  where customer_id = p_customer_id;
  update public.waitlists set customer_name = 'Anonymized guest', phone = null, notes = null where customer_id = p_customer_id;
  update public.notification_logs set recipient = '[erased]', body = '[erased]', subject = null where customer_id = p_customer_id;
  delete from public.customer_tag_assignments where customer_id = p_customer_id;
  update public.customers set full_name = 'Anonymized guest', phone = null, email = null, birthday = null, vip_note = null,
    allergies = null, dietary_preferences = null, special_requests = null, internal_notes = null, line_user_id = null,
    is_vip = false, anonymized_at = now()
  where id = p_customer_id;
  -- Reservation history diffs may contain old personal values
  update public.reservation_history h set changes = '{"redacted": true}'::jsonb
  where h.reservation_id in (select id from public.reservations where customer_id = p_customer_id) and h.change_type = 'updated';
  insert into public.data_subject_requests (organization_id, customer_id, request_type, status, notes, processed_by, processed_at)
  values (org, p_customer_id, 'deletion', 'completed', p_request_note, auth.uid(), now());
end $$;
revoke execute on function public.anonymize_customer(uuid, text) from public, anon;
grant execute on function public.anonymize_customer(uuid, text) to authenticated;
