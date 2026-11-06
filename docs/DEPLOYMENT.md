# Deployment

Production runs on Supabase Cloud (database, auth, realtime) and Vercel (Next.js). Choose the Singapore region (`ap-southeast-1`) for both, since it is closest to Thailand.

## 1. Supabase project

1. Create a project at supabase.com in the Singapore region. Save the database password in a password manager.
2. Link the project and apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # applies supabase/migrations/* in order
   ```
3. **Do not run `supabase/seed.sql` in production.** It contains demo users with a published password and fictional guests. Bootstrap production data like this instead:
   - Run the "structural" part of the seed in the SQL editor: the organisation, the 8 restaurants, booking sources, policies, hours, areas, tables, booking types, templates and the integrations registry. That means everything in `seed.sql` above the `-- DEMO users` section (line ~173).
   - Create the first admin. In Authentication → Users, choose Add user with a real email and a strong password. Then run:
     ```sql
     insert into public.user_roles (user_id, organization_id, role)
     values ('<auth user id>', '00000000-0000-4000-8000-000000000001', 'super_admin');
     ```
   - Add every other staff account from **User management** in the app.
4. Authentication settings:
   - Set the Site URL to your production domain and add it to Redirect URLs.
   - Turn off public sign-ups. Staff accounts are created by the Super Admin.
   - Set the minimum password length to 12 or more and turn on leaked-password protection.
5. Realtime: the migrations already add `reservations`, `reservation_tables`, `tables` and `waitlists` to the `supabase_realtime` publication.
6. After any schema change, regenerate types: `npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`.

## 2. Vercel project

1. Import the GitHub repository into Vercel. The framework preset is Next.js.
2. Set the environment variables for Production and Preview:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon or publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Never give it a `NEXT_PUBLIC_` prefix |
| `NEXT_PUBLIC_APP_URL` | e.g. `https://reservations.turtle23.com`; used in guest links and emails |
| `TOKEN_PEPPER` | 32+ random bytes. Changing it invalidates guest manage links, API keys and webhook secrets |
| `CRON_SECRET` | 32+ random bytes. Vercel Cron sends it automatically |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional; email |
| `TWILIO_*` | Optional; SMS |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` | Optional; LINE |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Optional; WhatsApp |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional; deposits by card |
| `OMISE_SECRET_KEY` | Optional; deposits by card or PromptPay |
| `FOODSTORY_*` | Leave blank until FoodStory API access is confirmed |

   Generate secrets with `openssl rand -base64 32`.
3. Crons are defined in `vercel.json`:
   - `/api/cron/notifications` retries failed messages and webhooks.
   - `/api/cron/reminders` queues reminders for bookings starting `REMINDER_LEAD_HOURS` (default 14) to `REMINDER_LEAD_HOURS + REMINDER_WINDOW_HOURS` (default 24) hours ahead. The defaults match a daily run at 03:00 UTC; with an hourly cron set them to 20 and 1.

   `vercel.json` currently schedules both jobs **once a day** (01:00 and 03:00 UTC) because the Vercel Hobby plan rejects more frequent crons. On Pro, change them to `*/10 * * * *` (notifications) and `0 * * * *` (reminders), or call both URLs from an external scheduler with `Authorization: Bearer $CRON_SECRET`. Messages are still sent immediately when a booking changes; the cron only retries failures and queues reminders.
4. Payment webhooks:
   - Stripe: add an endpoint at `https://<domain>/api/webhooks/payments/stripe` for `checkout.session.completed`, `checkout.session.expired` and `checkout.session.async_payment_failed`, then copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
   - Omise: set the webhook URL to `https://<domain>/api/webhooks/payments/omise`. Events are re-fetched from the Omise API before they are trusted.
5. Add your custom domain. The booking URLs are `https://<domain>/book/<slug>`.

## 3. Go-live checklist

- [ ] Migrations applied; `select count(*) from supabase_migrations.schema_migrations` matches the number of files in `supabase/migrations`
- [ ] No demo users in production (`select email from auth.users where email like '%@t23.example.com'` returns nothing)
- [ ] Supabase Security Advisor shows no errors (every table has RLS)
- [ ] Hours, tables and policies checked by each restaurant manager
- [ ] A test booking made on a phone for each branch, then cancelled from the guest link
- [ ] Each notification provider tested from Notifications (the log shows `sent`, not `not_configured`)
- [ ] Privacy notice and booking policy text reviewed by legal (PDPA)

## 4. Backups and recovery

- Supabase Pro includes daily backups. Turn on **Point-in-Time Recovery** for reservation data; losing a day of bookings is not acceptable.
- Weekly logical backup: `pg_dump --no-owner -Fc "$DATABASE_URL" > t23-$(date +%F).dump`, kept in separate cloud storage.
- Restore drill: restore into a staging project once a quarter.

## 5. Monitoring

- Vercel: Runtime Logs and Observability for errors, plus a Log Drain if you have one.
- Supabase: Reports (API and database), Advisors (security and performance) and Logs.
- The Notifications page shows failed or `not_configured` deliveries. Settings → Webhooks shows delivery failures.
- Uptime: monitor `/` and `/book/capricci` with an external checker.

## 6. Data retention

Settings → Data retention runs `apply_retention(months)`, which anonymises guests with no visits in the chosen period. Always run the dry run first. Schedule a quarterly review.
