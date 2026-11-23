-- Prepaid online bookings: the guest pays the deposit / prepayment on our payment page
-- before the booking is confirmed. While they pay, the table is held for a short time.
-- An unpaid hold is cancelled when it runs out, which releases the table again.

alter table public.booking_policies
  add column payment_hold_minutes int not null default 15 check (payment_hold_minutes between 5 and 1440);

comment on column public.booking_policies.payment_hold_minutes is
  'How long an online booking that needs a deposit holds its table while the guest pays.';

alter table public.reservations add column payment_due_at timestamptz;
comment on column public.reservations.payment_due_at is
  'Online bookings awaiting payment: the hold is cancelled automatically after this time. Null = no automatic expiry.';
create index reservations_payment_due_idx on public.reservations (payment_due_at) where payment_due_at is not null;

alter table public.payments add column method text check (method is null or method in ('promptpay','card','checkout','simulator'));

-- Cancels unpaid online holds whose time ran out, and their pending gateway payments.
-- Called by the booking page before it lists free times, by the payment page and by the daily cron.
create or replace function public.release_expired_payment_holds(p_restaurant_id uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with expired as (
    update public.reservations
       set status = 'cancelled',
           cancellation_reason = 'Online payment not completed in time',
           payment_due_at = null
     where payment_due_at is not null
       and payment_due_at < now()
       and status = 'pending'
       and payment_status in ('pending','failed')
       and (p_restaurant_id is null or restaurant_id = p_restaurant_id)
    returning id
  ), cancelled_payments as (
    update public.payments p set status = 'cancelled'
      from expired e
     where p.reservation_id = e.id and p.status = 'pending'
    returning p.id
  )
  select count(*) into n from expired;
  return n;
end $$;

revoke all on function public.release_expired_payment_holds(uuid) from public, anon, authenticated;
grant execute on function public.release_expired_payment_holds(uuid) to service_role;
