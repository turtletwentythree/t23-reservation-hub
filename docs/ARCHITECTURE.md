# T23 Reservation Hub — Architecture, Schema & Roadmap

_Last updated: 2026-11-06_

## 1. Environment inspection (2026-11-06)

| Item | Finding | Impact |
|---|---|---|
| Node / pnpm | Node 22, pnpm 10 | Next.js 15 + React 19 supported |
| Supabase | Full local stack (Postgres 17, GoTrue Auth, PostgREST, Realtime, Storage) running in Docker via Supabase CLI 3 | Real auth, RLS and persistence locally; same migrations deploy to cloud |
| Cloud Supabase | Existing projects belong to other apps | Dedicated project needed (decision pending with owner) |
| GitHub | No repository for this project | Owner to create `t23-reservation-hub`; code lives locally until then |
| Vercel | Connector available | Deployment once repo + Supabase project exist |
| Email / SMS / LINE / Payment / FoodStory credentials | None provided | Adapters report `not_configured`; nothing is simulated |

## 2. Architecture

```
Browser (staff app, public booking, embed widget)
   │  HTTPS
   ▼
Next.js 15 (App Router, TypeScript) on Vercel
   ├─ Server Components  → read data with the user's Supabase session (RLS applies)
   ├─ Server Actions     → zod validation → server-side permission check → Supabase (RLS applies)
   ├─ Public booking     → server-only service client calling SECURITY DEFINER RPCs
   │                        (rate limited, validated, no direct table access for anon)
   ├─ /api/v1/*          → REST API for external channels (API keys, hashed)
   ├─ /api/webhooks/*    → inbound provider webhooks (signature verified)
   └─ /api/cron/*        → notification retries / reminders (CRON_SECRET)
   │
   ▼
Supabase
   ├─ Postgres: normalized schema, RLS on every table, exclusion constraint prevents
   │            double-booked tables, triggers for history + audit log
   ├─ Auth: email/password for staff (invite by Super Admin)
   ├─ Realtime: reservations / tables / waitlists → live dashboard & floor plan
   └─ Storage: restaurant logos / floor plan backgrounds
   │
   ▼
Adapters (src/lib/integrations) — swap providers without touching reservation logic
   ├─ notifications: email (Resend), SMS (Twilio), LINE Messaging API, WhatsApp (Cloud API)
   ├─ payments: manual (cash/transfer recorded by staff), Stripe, Omise
   └─ pos: FoodStory (status = pending until API access & docs are confirmed)
```

### Key decisions
1. **Defense in depth.** Every write is validated by zod, checked by server-side RBAC (`src/lib/auth/permissions.ts`), and enforced again by Postgres RLS. The UI hiding a button is never the only control.
2. **Double booking is impossible at the database level.** `reservation_tables` stores each table's occupied `tstzrange` (seating duration + buffer) with a GiST exclusion constraint for active reservations. The TypeScript availability engine finds options; the database guarantees correctness under concurrency.
3. **Customers do not need accounts.** A guest manages a booking with its reference and a secret link token (only the SHA-256 hash is stored), which avoids password friction on mobile. Customer accounts can be added later without schema changes.
4. **Time zones.** Each restaurant has an IANA time zone (default `Asia/Bangkok`). `reservation_date`/`reservation_time` are local; `starts_at`/`ends_at` are computed by trigger in that zone.
5. **No fabricated data.** Notifications without a configured provider are logged as `not_configured`. Revenue figures only come from recorded payments or POS data; none are estimated.
6. **Service-role key is server-only.** It lives in `src/lib/supabase/admin.ts`, which imports `server-only` so a client bundle containing it fails to build.

## 3. Folder structure

```
t23-reservation-hub/
├─ docs/                     architecture, deployment, testing, PDPA notes
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/            ordered SQL migrations (schema, functions, RLS)
│  ├─ seed.sql               T23 organization, 8 restaurants, tables, hours, demo users
│  └─ tests/                 SQL permission tests
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login        staff sign in
│  │  ├─ (staff)/…           dashboard, reservations, calendar, floor-plan, waitlist,
│  │  │                      customers, reports, restaurants, integrations, users,
│  │  │                      settings, audit-logs
│  │  ├─ book/[slug]         public booking engine (mobile-first, TH/EN/JA, embeddable)
│  │  ├─ reservation/[ref]   guest view / modify / cancel / QR
│  │  └─ api/                v1 REST, webhooks, cron, exports
│  ├─ components/            ui primitives, layout, feature components
│  ├─ lib/
│  │  ├─ supabase/           server, browser, admin, middleware clients
│  │  ├─ auth/               session + RBAC permission matrix
│  │  ├─ domain/             availability engine, reservation rules, reports (pure TS)
│  │  ├─ validation/         zod schemas
│  │  ├─ integrations/       notification, payment, POS adapters
│  │  └─ i18n/               en / th / ja dictionaries
│  └─ middleware.ts          session refresh + route protection
└─ tests/                    vitest unit + integration (RLS via real Supabase)
```

## 4. Database schema

All tables: UUID PK (`gen_random_uuid()`), `created_at`/`updated_at` timestamps (trigger-maintained), FKs with explicit `on delete`, indexes on FK and lookup columns, RLS enabled.

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| organizations | Restaurant group (T23) | slug unique, default timezone/currency |
| restaurants | Branches | slug unique (booking URL), timezone, is_active, accepts_online_bookings |
| restaurant_areas | Dining areas | sort order, canvas size |
| tables | Physical tables | min/max capacity (check), x/y/w/h/rotation, shape, service_status, combinable, online bookable; unique(restaurant, label) |
| table_combinations (+ table_combination_members) | Joinable table sets | min/max capacity |
| users | Staff profile, 1:1 with `auth.users` | is_active |
| user_roles | Role per user per organization | enum app_role; unique(user, org) |
| restaurant_user_access | Branch assignments | unique(user, restaurant) |
| customers | Central guest profile (org-wide, across branches) | normalized phone/email for duplicate detection, VIP, allergies, counters, anonymized_at |
| customer_consents | PDPA consent ledger | type, granted, policy_version, source, timestamps |
| customer_tags (+ customer_tag_assignments) | Segmentation | unique(org, name) |
| booking_sources | Phone, walk-in, online, LINE, Google… | unique(org, code) |
| booking_types | Dining courses / booking types per restaurant | i18n name, price, duration & deposit overrides |
| booking_policies | Per-restaurant rules | duration, duration_rules by party size, buffer, slot interval, min/max party, advance window, cut-offs, deposit & no-show fee config, policy text |
| operating_hours | Weekly services + date overrides | day_of_week or specific_date, open/close/last seating, is_closed |
| reservations | Bookings | reference unique, status enum, local date/time + computed tstz range, party size, source, notes, deposit, payment_status, manage_token_hash, created_by |
| reservation_tables | Table assignment | `period tstzrange`, `active`; **EXCLUDE USING gist (table_id =, period &&) WHERE active** |
| reservation_history | Per-booking change history | from/to status, jsonb diff, changed_by |
| waitlists | Walk-in queue | queue_number per restaurant per day, quoted wait, status |
| notification_templates | Templates by event/channel/locale | restaurant override optional |
| notification_logs | Every send attempt | status (queued/sent/failed/not_configured), attempts, next_attempt_at, provider id |
| payments / refunds | Deposits, prepayments, fees, refunds | provider reference only, never card data |
| integrations | Provider registry & status | non-secret config only; secrets in env vars |
| audit_logs | Who did what | actor, action, entity, old/new jsonb |
| api_keys, webhook_endpoints, webhook_deliveries | REST API + outbound webhooks | hashed keys / signed payloads |
| rate_limits | Public endpoint throttling | fixed window counters |
| data_subject_requests | PDPA export / deletion workflow | status, processed_by |

### RLS model
Helper functions in a non-exposed `private` schema (SECURITY DEFINER, `search_path` pinned):
- `private.has_role(role[])`, `private.is_super_admin()`
- `private.can_view_restaurant(id)` — super admin, or assigned via `restaurant_user_access`
- `private.can_operate_restaurant(id)` — view + role in (super_admin, group_manager, restaurant_manager, host)
- `private.can_manage_restaurant(id)` — view + role in (super_admin, restaurant_manager)

| Data | Read | Write |
|---|---|---|
| restaurants & config | assigned staff | manage (create/delete: super admin) |
| reservations, tables status, waitlists | assigned staff | operate |
| customers | staff of the organization | operate roles |
| users / roles / access | self + super admin | super admin |
| audit logs | super admin, group manager (assigned branches) | triggers only |
| anon | nothing directly | only through SECURITY DEFINER RPCs called by the server |

## 5. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 Foundation | Next.js app, Supabase local stack, migrations, auth, RBAC + RLS, multi-branch switcher, restaurants & user management, seed | Login works; users see only assigned branches (tested); admin creates restaurants |
| 2 Reservation core | Booking CRUD, statuses, history, audit, availability engine, table assignment, floor plan editor, calendar | Conflicting booking rejected by DB; engine unit-tested |
| 3 Customer experience | Public booking (TH/EN/JA), manage/cancel link, QR, embed, CRM, walk-in, waitlist | Mobile booking end-to-end; guest history retained |
| 4 Operations | Notification center + adapters + retries, deposits, payments, refunds, policies | No fake deliveries; payments recorded via adapters |
| 5 Analytics & integration | Reports + CSV/Excel export, REST API, webhooks, LINE, FoodStory (pending) | KPIs computed from DB records |
| 6 Production | Security review, load test, Vercel deploy, backups, monitoring, UAT | Deployed, documented |

## 6. Dependencies & integration risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| FoodStory API access/docs unconfirmed | High | Adapter interface + `pending` status; no spend data until confirmed |
| LINE Messaging needs customer `userId` (via LINE Login / OA follow) | High | Store `line_user_id` on customer; fall back to SMS/email; LIFF later |
| SMS sender ID registration in Thailand takes time | Medium | Provider-agnostic adapter; email first |
| Payment gateway onboarding (Omise/Stripe TH) | Medium | Manual payment recording works day one; gateway adapters ready |
| Supabase free tier limits / project location | Medium | Singapore region for latency to Thailand; Pro plan for backups (PITR) |
| PDPA compliance (consent, retention, deletion) | Medium | Consent ledger, anonymization workflow, retention job; legal review recommended |
| Time zone / DST bugs | Low (TH has no DST) | All math in restaurant zone, tested |
| Concurrent bookings for last table | Medium | DB exclusion constraint + retry on conflict |

## 7. Phase 1 plan

1. Scaffold Next.js 15 + TypeScript + Tailwind 4, shadcn-style UI primitives, T23 green/orange theme.
2. Supabase local stack + migrations: extensions, enums, all core tables, triggers (updated_at, history, audit), RLS helper functions and policies.
3. Seed: T23 organization, 8 restaurants with areas, tables, hours, policies; booking sources; demo users for every role.
4. Supabase Auth with `@supabase/ssr` (cookie sessions), middleware route protection, login page.
5. Server-side RBAC permission matrix mirrored from RLS; staff layout with sidebar + branch selector.
6. Restaurant management (create / edit / disable) and user management (invite, role, branch access).
7. Tests: RLS integration tests per role, permission unit tests.
