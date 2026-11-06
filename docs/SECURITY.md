# Security and PDPA

## Access control

- **Three layers.** Every Server Action and API route validates input with Zod. It then checks the caller's role and branch on the server (`assertPermission`, `requireStaff`, `src/lib/auth/permissions.ts`). Finally, Postgres row-level security enforces the same rules on every table, so a bug in the app layer still cannot leak another branch's data.
- **Branch isolation.** Staff only see restaurants listed for them in `restaurant_user_access`; a Super Admin sees all. The RLS helper functions live in a private schema (`private.restaurant_role`, `can_view_restaurant`, `can_operate_restaurant`, `can_manage_restaurant`).
- **No anonymous table access.** The `anon` role has no table privileges at all. The public booking engine and guest pages run on the server with the service-role client, and expose only public fields such as available times, never tables or other guests.
- **Role changes.** Only a Super Admin can change roles. A trigger stops users from changing their own role or active flag, and new accounts are created by the Super Admin only.
- **Service-role key.** Only `src/lib/supabase/admin.ts` reads it, and that file is marked `server-only`, so importing it from client code breaks the build.

## Integrity

- **Double booking.** A Postgres exclusion constraint on `reservation_tables (table_id WITH =, period WITH &&) WHERE active` makes overlapping bookings on one table impossible, including races between two staff members or staff versus online.
- **Audit trail.** Triggers write every insert, update and delete on business tables to `audit_logs`, with the actor (user id, or `online_booking` / `api_key:<id>` / `system`). Customer audit rows store which fields changed, not the personal values themselves. Reservation status changes also go to `reservation_history`.
- **Payments.** No card numbers or CVV are ever stored or sent through the app. Card payments go to hosted checkout (Stripe Checkout, Omise Links). Manual payment notes are checked for card-number patterns and rejected. Refunds cannot exceed the amount paid (database trigger).

## Secrets

- All secrets come from environment variables (see `.env.example`); none are hard-coded or committed (`.env*` is gitignored).
- API keys are random and hashed with SHA-256 plus `TOKEN_PEPPER`, and the full key is shown once.
- Guest manage links are signed with an HMAC of the reservation id and nothing guessable is stored. Webhook signing secrets are derived per endpoint.
- Cron routes require `CRON_SECRET`, checked with a constant-time comparison.

## Abuse protection

- Database-backed rate limits on login, slot search, public booking (per IP and per phone number), guest changes and API keys.
- A honeypot field on the public booking form.
- Outbound webhook URLs must use HTTPS and resolve to a public host (SSRF protection).
- CSV exports escape formula characters (`= + - @`) to prevent spreadsheet injection.
- Security headers: HSTS, nosniff and a strict referrer policy. The staff app cannot be framed; only `/book/*` may be embedded.

## PDPA (Thailand Personal Data Protection Act)

| Requirement | Implementation |
| --- | --- |
| Lawful basis and consent | The booking form requires consent to processing for the reservation. Marketing consent is a separate, optional, unticked checkbox. Both are written to the `customer_consents` ledger with source and policy version |
| Withdraw consent | Staff can update consent in the guest profile. Changes are appended to the ledger; old entries are never overwritten |
| Right of access and portability | Guest profile → **Export data (PDPA)** downloads JSON with the profile, reservations, consents, payments and notifications. The request is logged in `data_subject_requests` |
| Right to erasure | Guest profile → **Data deletion** (Super Admin) anonymises the guest. Personal fields are cleared or replaced and booking statistics are kept without identity. The request is logged |
| Data minimisation | Webhook payloads and API reads leave out contact details. Reports use aggregates |
| Retention | Settings → Data retention anonymises guests with no visits for N months. A dry run is shown first |
| Security of processing | Encryption in transit (HTTPS) and at rest (Supabase), RLS, audit logs, least-privilege roles |
| Breach response | Audit logs and Supabase logs support investigation. Notify the PDPC within 72 hours where required |

Before go-live, have legal review the privacy notice and the booking policy text shown on the booking page (Restaurants → Policy).
