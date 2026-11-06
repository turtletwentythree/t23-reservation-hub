-- Reservation payment_status is derived from actual payment & refund records.
create or replace function private.refresh_reservation_payment_status(rid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  required numeric;
  paid numeric;
  refunded numeric;
  any_failed boolean;
  any_pending boolean;
  cur public.payment_status;
  nxt public.payment_status;
begin
  if rid is null then return; end if;
  select deposit_amount, payment_status into required, cur from public.reservations where id = rid;
  if not found then return; end if;
  select coalesce(sum(amount) filter (where status = 'succeeded' and kind in ('deposit','prepayment')), 0),
         bool_or(status = 'failed'), bool_or(status = 'pending')
    into paid, any_failed, any_pending
    from public.payments where reservation_id = rid;
  select coalesce(sum(r.amount), 0) into refunded
    from public.refunds r join public.payments p on p.id = r.payment_id
   where p.reservation_id = rid and r.status = 'succeeded' and p.kind in ('deposit','prepayment');

  nxt := case
    when cur = 'waived' then 'waived'
    when paid > 0 and refunded >= paid then 'refunded'
    when refunded > 0 then 'partially_refunded'
    when paid > 0 and paid >= required then 'paid'
    when required > 0 and coalesce(any_failed, false) and not coalesce(any_pending, false) then 'failed'
    when required > 0 then 'pending'
    else 'not_required'
  end;
  if nxt is distinct from cur then
    update public.reservations set payment_status = nxt where id = rid;
  end if;
end $$;

create or replace function private.payments_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_reservation_payment_status(coalesce(new.reservation_id, old.reservation_id));
  return null;
end $$;
create trigger payments_status after insert or update or delete on public.payments
  for each row execute function private.payments_after_change();

create or replace function private.refunds_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_reservation_payment_status((select reservation_id from public.payments where id = coalesce(new.payment_id, old.payment_id)));
  return null;
end $$;
create trigger refunds_status after insert or update or delete on public.refunds
  for each row execute function private.refunds_after_change();

-- Refund total may never exceed the payment.
create or replace function private.refund_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare total numeric; paid numeric;
begin
  select amount into paid from public.payments where id = new.payment_id and status = 'succeeded';
  if paid is null then raise exception 'only succeeded payments can be refunded' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into total from public.refunds where payment_id = new.payment_id and status <> 'failed' and id <> new.id;
  if total + new.amount > paid then raise exception 'refund exceeds the amount paid' using errcode = '23514'; end if;
  return new;
end $$;
create trigger refund_guard before insert or update on public.refunds
  for each row execute function private.refund_guard();

-- Re-derive when the required deposit changes
create or replace function private.reservation_deposit_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deposit_amount is distinct from old.deposit_amount then
    perform private.refresh_reservation_payment_status(new.id);
  end if;
  return null;
end $$;
create trigger reservation_deposit_changed after update of deposit_amount on public.reservations
  for each row execute function private.reservation_deposit_changed();
