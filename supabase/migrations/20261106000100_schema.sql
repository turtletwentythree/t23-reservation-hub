-- T23 Reservation Hub: core schema
-- Extensions -------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- Enums ------------------------------------------------------------------
create type public.app_role as enum ('super_admin','group_manager','restaurant_manager','host','viewer');
create type public.reservation_status as enum ('pending','confirmed','arrived','seated','completed','cancelled','no_show');
create type public.table_service_status as enum ('available','cleaning','out_of_service');
create type public.table_shape as enum ('rect','round','square','bar');
create type public.payment_status as enum ('not_required','pending','paid','partially_refunded','refunded','failed','waived');
create type public.payment_kind as enum ('deposit','prepayment','no_show_fee','cancellation_fee','other');
create type public.payment_txn_status as enum ('pending','succeeded','failed','cancelled');
create type public.refund_status as enum ('pending','succeeded','failed');
create type public.deposit_type as enum ('none','per_person','flat','full_prepayment');
create type public.waitlist_status as enum ('waiting','notified','seated','left','cancelled');
create type public.notification_channel as enum ('email','sms','line','whatsapp');
create type public.notification_event as enum ('booking_confirmation','booking_reminder','booking_modification','booking_cancellation','waitlist_ready','birthday_campaign');
create type public.notification_status as enum ('queued','sending','sent','failed','not_configured','skipped');
create type public.integration_status as enum ('not_configured','pending','active','error','disabled');
create type public.dsr_type as enum ('export','deletion','rectification');
create type public.dsr_status as enum ('open','in_progress','completed','rejected');

-- Shared trigger: updated_at ------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Organizations & restaurants ---------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  default_timezone text not null default 'Asia/Bangkok',
  default_currency char(3) not null default 'THB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  cuisine text,
  address text,
  phone text,
  email text,
  timezone text not null default 'Asia/Bangkok',
  currency char(3) not null default 'THB',
  brand_color text,
  logo_path text,
  is_active boolean not null default true,
  accepts_online_bookings boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.restaurants (organization_id);

create table public.restaurant_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  canvas_width int not null default 1000 check (canvas_width between 200 and 5000),
  canvas_height int not null default 700 check (canvas_height between 200 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  area_id uuid references public.restaurant_areas(id) on delete set null,
  label text not null,
  min_capacity int not null default 1 check (min_capacity >= 1),
  max_capacity int not null check (max_capacity >= 1),
  shape public.table_shape not null default 'rect',
  pos_x int not null default 40,
  pos_y int not null default 40,
  width int not null default 80 check (width between 20 and 600),
  height int not null default 80 check (height between 20 and 600),
  rotation int not null default 0 check (rotation between 0 and 359),
  service_status public.table_service_status not null default 'available',
  is_combinable boolean not null default true,
  is_online_bookable boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, label),
  check (max_capacity >= min_capacity)
);
create index on public.tables (restaurant_id);
create index on public.tables (area_id);

create table public.table_combinations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  min_capacity int not null default 1 check (min_capacity >= 1),
  max_capacity int not null check (max_capacity >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name),
  check (max_capacity >= min_capacity)
);

create table public.table_combination_members (
  combination_id uuid not null references public.table_combinations(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  primary key (combination_id, table_id)
);
create index on public.table_combination_members (table_id);

-- Users & access ---------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en','th','ja')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);
create index on public.user_roles (organization_id);

create table public.restaurant_user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
create index on public.restaurant_user_access (restaurant_id);

-- Customers (CRM) --------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null,
  phone text,
  phone_normalized text,
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  preferred_language text not null default 'en' check (preferred_language in ('en','th','ja')),
  birthday date,
  is_vip boolean not null default false,
  vip_note text,
  allergies text,
  dietary_preferences text,
  special_requests text,
  internal_notes text,
  line_user_id text,
  total_visits int not null default 0,
  total_no_shows int not null default 0,
  total_cancellations int not null default 0,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers (organization_id, phone_normalized);
create index on public.customers (organization_id, email_normalized);
create index customers_name_trgm on public.customers using gin (full_name extensions.gin_trgm_ops);

create table public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#2f7d4f',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.customer_tag_assignments (
  customer_id uuid not null references public.customers(id) on delete cascade,
  tag_id uuid not null references public.customer_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
create index on public.customer_tag_assignments (tag_id);

create table public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent_type text not null check (consent_type in ('data_processing','marketing_email','marketing_sms','marketing_line','birthday_offers')),
  granted boolean not null,
  policy_version text not null default '2026-11',
  source text not null default 'staff' check (source in ('online_booking','staff','import','guest_portal')),
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.customer_consents (customer_id, consent_type, created_at desc);

-- Booking configuration --------------------------------------------------
create table public.booking_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.booking_types (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name jsonb not null,               -- {"en": "...", "th": "...", "ja": "..."}
  description jsonb,
  price numeric(12,2) check (price is null or price >= 0),
  duration_minutes int check (duration_minutes is null or duration_minutes between 15 and 600),
  deposit_override numeric(12,2) check (deposit_override is null or deposit_override >= 0),
  min_party_size int,
  max_party_size int,
  is_online boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.booking_types (restaurant_id);

create table public.booking_policies (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  default_duration_minutes int not null default 120 check (default_duration_minutes between 15 and 600),
  duration_rules jsonb not null default '[]'::jsonb,   -- [{"max_party":2,"minutes":90}, ...] turn time by party size
  buffer_minutes int not null default 15 check (buffer_minutes between 0 and 240),
  slot_interval_minutes int not null default 15 check (slot_interval_minutes in (5,10,15,20,30,60)),
  min_party_size int not null default 1 check (min_party_size >= 1),
  max_party_size int not null default 8 check (max_party_size >= 1),
  min_advance_minutes int not null default 60 check (min_advance_minutes >= 0),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 730),
  cancellation_cutoff_hours int not null default 24 check (cancellation_cutoff_hours >= 0),
  modification_cutoff_hours int not null default 24 check (modification_cutoff_hours >= 0),
  auto_confirm_online boolean not null default true,
  large_party_threshold int,       -- parties at/above this need manual confirmation
  deposit_type public.deposit_type not null default 'none',
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  deposit_min_party_size int not null default 1,
  no_show_fee_amount numeric(12,2) not null default 0 check (no_show_fee_amount >= 0),
  cancellation_policy jsonb not null default '{}'::jsonb,  -- {"en": "...", "th": "...", "ja": "..."}
  booking_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_party_size >= min_party_size)
);

create table public.operating_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week smallint check (day_of_week between 0 and 6),   -- 0 = Sunday
  specific_date date,                                          -- override for a date (holiday, event)
  service_name text not null default 'Dinner',
  open_time time,
  close_time time,
  last_seating_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((day_of_week is null) <> (specific_date is null)),
  check (is_closed or (open_time is not null and close_time is not null)),
  check (is_closed or close_time > open_time),
  check (last_seating_time is null or (last_seating_time >= open_time and last_seating_time <= close_time))
);
create index on public.operating_hours (restaurant_id, day_of_week);
create index on public.operating_hours (restaurant_id, specific_date);

-- Reservations -------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  reference text not null unique,
  customer_name text not null check (length(trim(customer_name)) > 0),
  phone text,
  email text,
  language text not null default 'en' check (language in ('en','th','ja')),
  reservation_date date not null,
  reservation_time time not null,
  duration_minutes int not null check (duration_minutes between 15 and 600),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size int not null check (party_size between 1 and 200),
  booking_source_id uuid references public.booking_sources(id) on delete set null,
  booking_type_id uuid references public.booking_types(id) on delete set null,
  special_occasion text,
  dietary_requirements text,
  allergies text,
  guest_notes text,
  internal_notes text,
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  payment_status public.payment_status not null default 'not_required',
  status public.reservation_status not null default 'pending',
  is_walk_in boolean not null default false,
  policy_accepted_at timestamptz,
  manage_token_hash text,
  confirmed_at timestamptz,
  arrived_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  no_show_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.reservations (restaurant_id, reservation_date);
create index on public.reservations (restaurant_id, starts_at);
create index on public.reservations (customer_id);
create index on public.reservations (status);
create index on public.reservations (organization_id, reservation_date);
create index reservations_phone_idx on public.reservations (phone);

create table public.reservation_tables (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period tstzrange not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (reservation_id, table_id),
  -- The core double-booking guarantee:
  constraint reservation_tables_no_overlap exclude using gist (table_id with =, period with &&) where (active)
);
create index on public.reservation_tables (table_id);
create index on public.reservation_tables (restaurant_id);

create table public.reservation_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  change_type text not null check (change_type in ('created','updated','status_changed','tables_changed')),
  from_status public.reservation_status,
  to_status public.reservation_status,
  changes jsonb not null default '{}'::jsonb,
  changed_by uuid references public.users(id) on delete set null,
  actor_label text,
  created_at timestamptz not null default now()
);
create index on public.reservation_history (reservation_id, created_at);

-- Waitlist -----------------------------------------------------------------
create table public.waitlists (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text,
  party_size int not null check (party_size between 1 and 100),
  queue_date date not null,
  queue_number int not null,
  status public.waitlist_status not null default 'waiting',
  quoted_wait_minutes int check (quoted_wait_minutes is null or quoted_wait_minutes >= 0),
  joined_at timestamptz not null default now(),
  notified_at timestamptz,
  seated_at timestamptz,
  left_at timestamptz,
  table_id uuid references public.tables(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, queue_date, queue_number)
);
create index on public.waitlists (restaurant_id, queue_date, status);

-- Notifications ------------------------------------------------------------
create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  event public.notification_event not null,
  channel public.notification_channel not null,
  locale text not null default 'en' check (locale in ('en','th','ja')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index notification_templates_unique
  on public.notification_templates (organization_id, coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), event, channel, locale);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  waitlist_id uuid references public.waitlists(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  template_id uuid references public.notification_templates(id) on delete set null,
  event public.notification_event not null,
  channel public.notification_channel not null,
  recipient text not null,
  locale text not null default 'en',
  subject text,
  body text not null,
  provider text,
  provider_message_id text,
  status public.notification_status not null default 'queued',
  error text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notification_logs (restaurant_id, created_at desc);
create index on public.notification_logs (status, next_attempt_at);
create index on public.notification_logs (reservation_id);

-- Payments -----------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  kind public.payment_kind not null,
  provider text not null,                 -- 'manual_cash', 'manual_transfer', 'stripe', 'omise', ...
  provider_reference text,                -- gateway charge/session id; NEVER card data
  checkout_url text,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'THB',
  status public.payment_txn_status not null default 'pending',
  paid_at timestamptz,
  note text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments (reservation_id);
create index on public.payments (restaurant_id, created_at);
create unique index payments_provider_ref_unique on public.payments (provider, provider_reference) where provider_reference is not null;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  status public.refund_status not null default 'pending',
  provider_reference text,
  processed_by uuid references public.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.refunds (payment_id);

-- Integrations, API, webhooks ---------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  provider text not null,
  category text not null check (category in ('pos','messaging','email','sms','payment','listing','channel','webhook','api')),
  display_name text not null,
  status public.integration_status not null default 'not_configured',
  config jsonb not null default '{}'::jsonb,   -- NON-SECRET settings only. Secrets live in env vars.
  notes text,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index integrations_unique
  on public.integrations (organization_id, coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), provider);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['availability:read','reservations:write'],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  events text[] not null default array['reservation.created','reservation.updated','reservation.cancelled'],
  secret_hash text not null,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','delivered','failed')),
  response_status int,
  error text,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.webhook_deliveries (status, next_attempt_at);

-- Audit & compliance -------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  actor_id uuid references public.users(id) on delete set null,
  actor_label text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (organization_id, created_at desc);
create index on public.audit_logs (restaurant_id, created_at desc);
create index on public.audit_logs (entity_type, entity_id);

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  request_type public.dsr_type not null,
  status public.dsr_status not null default 'open',
  requester_contact text,
  notes text,
  processed_by uuid references public.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- updated_at triggers ------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['organizations','restaurants','restaurant_areas','tables','table_combinations','users',
    'user_roles','customers','booking_types','booking_policies','operating_hours','reservations','waitlists',
    'notification_templates','notification_logs','payments','refunds','integrations','webhook_endpoints','data_subject_requests']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;
