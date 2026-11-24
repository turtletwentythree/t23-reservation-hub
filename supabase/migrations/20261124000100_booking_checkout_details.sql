-- Checkout details shown to online guests before they pay.
-- Service charge and VAT are added on top of a prepaid course price (Thai "++" pricing).
-- Both default to 0, so existing amounts do not change until a restaurant sets them.

alter table public.booking_policies
  add column if not exists service_charge_percent numeric(5,2) not null default 0 check (service_charge_percent between 0 and 30),
  add column if not exists vat_percent numeric(5,2) not null default 0 check (vat_percent between 0 and 30),
  add column if not exists dietary_question_required boolean not null default false;

comment on column public.booking_policies.service_charge_percent is
  'Full prepayment of a priced course: service charge added to the course total, in percent.';
comment on column public.booking_policies.vat_percent is
  'Full prepayment of a priced course: VAT added after the service charge, in percent.';
comment on column public.booking_policies.dietary_question_required is
  'Online guests must answer the dietary requirements / allergies question.';
