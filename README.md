# T23 Reservation Hub

Multi-branch reservation, table and guest management for the Turtle23 Restaurant Group: Capricci, Lawoi, Kappo Takashi, BLY, Sushi Saryu, Maison Dunand, Marlo and Roi Chak Sam. A Super Admin can add more restaurants from the UI, with no code changes.

Built with Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Realtime), Recharts and Zod. It deploys to Vercel.

| Doc | What it covers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, folder structure, schema, RLS model, roadmap, risks |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase cloud and Vercel production setup, crons, backups, monitoring |
| [docs/API.md](docs/API.md) | REST API v1, outbound webhooks, payment webhooks |
| [docs/TESTING.md](docs/TESTING.md) | Test suites and the acceptance-criteria mapping |
| [docs/SECURITY.md](docs/SECURITY.md) | Security controls, PDPA handling, secrets |

## Features

- **Dashboard**: today's reservations, covers, arrivals, no-shows and occupancy. Filter by branch or date. Includes a cross-branch comparison.
- **Reservations**: create, edit, cancel and track status (pending → confirmed → arrived → seated → completed, or cancelled / no-show). Every change is recorded in history and audit logs.
- **Double-booking prevention**: enforced in the database by a Postgres exclusion constraint on (table, time range including buffer), so a conflict cannot be saved however the request arrives.
- **Availability engine**: works from opening hours and date overrides, last seating, turn time by party size, buffers, booking interval, advance limits, table combinations and table service status.
- **Floor plan**: drag-and-drop layout editor, live table status (available, reserved, arrived, seated, cleaning, out of service), combined tables, and seating directly from the plan.
- **Calendar**: month, week and day timeline views.
- **Online booking**: `/book/<restaurant-slug>` is mobile-first and available in Thai, English, Japanese and French. It supports deposits and records PDPA consent. Guests get a manage page with a QR code where they can modify or cancel within the policy. Embed it with `/book/<slug>?embed=1`.
- **Guest CRM**: cross-branch history, VIP flags, tags, segments, duplicate detection and merge, consent ledger, PDPA export and anonymisation.
- **Walk-ins and waitlist**: queue numbers, wait estimates and a notify action. Seating a guest from the waitlist creates a walk-in reservation.
- **Notifications**: email (Resend), SMS (Twilio), LINE and WhatsApp adapters, editable TH/EN/JA/FR templates, a delivery log, and retries with backoff. If a provider has no credentials, the message is logged as `not_configured` and is never reported as sent.
- **Payments**: Stripe Checkout and Omise payment links via adapters, plus manual records for cash, transfer and card terminal. Refunds are supported. No card data is stored.
- **Reports**: occupancy, covers, cancellation and no-show rates, source mix, peak hours, branch comparison and repeat guests, all calculated from real rows. Export to CSV or Excel. POS revenue shows as *pending* until FoodStory is connected; it is never estimated.
- **Integrations**: REST API with hashed, scoped and rate-limited keys; signed outbound webhooks with retries; FoodStory adapter kept *pending* until vendor documentation and API access are confirmed.
- **Admin**: restaurants, policies, hours, booking types, users and per-branch access, booking sources, data retention, audit log.

## Roles

| Role | Scope |
| --- | --- |
| Super Admin | Everything, all branches. Creates restaurants, users, API keys and templates; handles PDPA requests |
| Group Manager | Assigned branches: operations, guests, reports, audit log |
| Restaurant Manager | Assigned branch: operations plus restaurant settings, layout, refunds |
| Reservation Staff / Host | Assigned branch: reservations, tables, walk-ins, waitlist, guests |
| Viewer | Read-only on assigned branches |
| Customer | Public booking page and their own manage link only (no staff login) |

Permissions are enforced three times: Zod input validation, a server-side permission check in every Server Action and route (`src/lib/auth/permissions.ts`), and Postgres row-level security as the final guard.

## Local development

Requirements: Node 20+, pnpm, Docker, and the Supabase CLI (or `npx supabase`).

```bash
pnpm install
cp .env.example .env.local      # then paste the keys printed by `supabase start`
pnpm db:start                   # starts local Supabase (Postgres, Auth, Realtime, Studio)
pnpm db:reset                   # applies supabase/migrations and supabase/seed.sql
pnpm dev                        # http://localhost:3000
```

`supabase start` prints the API URL, anon key and service-role key. Put them in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Set `TOKEN_PEPPER` and `CRON_SECRET` to any long random strings.

### Demo accounts (local seed only)

Every demo account uses the password `T23demo!2026`.

| Email | Role |
| --- | --- |
| admin@t23.example.com | Super Admin |
| group.manager@t23.example.com | Group Manager (Capricci, Lawoi, BLY, Marlo) |
| manager.capricci@t23.example.com | Restaurant Manager, Capricci |
| host.capricci@t23.example.com | Host, Capricci |
| viewer@t23.example.com | Viewer, Capricci |
| host.saryu@t23.example.com | Host, Sushi Saryu |

The seed also creates 80 fictional guests and about 3,200 reservations, running from 35 days ago to 10 days ahead. Guest phone numbers are 080-000-xxxx and emails are @example.com. **Do not run `seed.sql` against production.** See docs/DEPLOYMENT.md.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Unit tests (availability engine, reports) |
| `pnpm test:integration` | Database permission and double-booking tests against local Supabase |
| `pnpm test:e2e` | Browser acceptance checks against a running app |
| `pnpm db:reset` / `pnpm db:types` | Rebuild the local database / regenerate TypeScript types |

## Project layout

```
supabase/migrations/   schema, functions, RLS, occupancy, payments, CRM, retention
supabase/seed.sql      T23 organisation, 8 restaurants, demo users and data
src/app/(auth)/        login
src/app/(staff)/       dashboard, reservations, calendar, floor-plan, waitlist, customers,
                       notifications, reports, restaurants, integrations, users, settings, audit-logs
src/app/book/          public booking engine
src/app/reservation/   guest manage page (signed link)
src/app/api/           v1 REST API, exports, cron jobs, payment webhooks
src/lib/domain/        availability engine, reservation service, reports (pure, unit tested)
src/lib/integrations/  notification providers, payment gateways, webhooks, FoodStory (pending)
tests/                 unit, integration (RLS), e2e
```

## Integration status

| Integration | Status |
| --- | --- |
| Email, SMS, LINE, WhatsApp | Adapters built. Each turns on when its credentials are set; until then deliveries are logged as `not_configured` |
| Stripe, Omise | Adapters built. Each turns on when its credentials are set; until then deposits are tracked as pending and recorded manually |
| FoodStory POS | **Pending.** Waiting for API access and vendor documentation. No revenue or spend is shown or estimated |
| REST API and webhooks | Ready. Keys and endpoints are managed in Settings |
