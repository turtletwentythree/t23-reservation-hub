# Testing

| Suite | Command | Needs | Count |
| --- | --- | --- | --- |
| Unit | `pnpm test` | nothing | 26 |
| Database permissions and integrity | `pnpm test:integration` | local Supabase, freshly reset (`pnpm db:reset`), `.env.local` loaded | 24 |
| Browser acceptance | `pnpm test:e2e` | the above, plus the app running (`pnpm dev`) | 6 |

Load the environment for the integration and e2e suites with `set -a; . ./.env.local; set +a`.

- **Unit** (`tests/unit`). Covers the availability engine: hours, overrides, last seating, buffers, combinations, advance limits, table status and ranking. Also covers report maths: covers, occupancy, cancellation and no-show definitions, source mix, peak hours and capacity with closures.
- **Integration** (`tests/integration/rls.test.ts`). Signs in as each demo role through Supabase Auth and queries through PostgREST, so RLS is tested exactly as production runs it.
- **E2E** (`tests/e2e/run.mjs`). A Playwright script that drives the real UI on desktop and an iPhone 13 profile. It cleans up the data it creates.

## Acceptance criteria

| # | Criterion | Verified by |
| --- | --- | --- |
| 1 | Super Admin can create restaurants without code changes | e2e "AC1" (UI creates a restaurant with default policy, area and 7 days of hours); integration "only super admin can create restaurants" |
| 2 | Staff only see their branches | integration "branch isolation" (6 tests); e2e "AC2" (host UI shows only Capricci and cannot open Users or Audit logs) |
| 3 | Staff can create, edit and manage reservations | e2e "AC8" walk-in creation; integration "host can book a table"; status changes via the reservation detail page |
| 4 | Double booking is prevented | integration "overlapping booking is rejected" (`23P01`), "cancelling frees the table", "party larger than capacity is rejected" |
| 5 | Table status is tracked | floor plan page renders live status (e2e page check); `table_occupancy_now` RPC; manual check of seat, check-in and status changes |
| 6 | Public online booking works | e2e "AC6/11" (Thai UI, phone profile, confirmation page with QR); inactive restaurant returns 404 |
| 7 | Guest history across branches | customer detail page lists every visible branch's reservations; `refresh_customer_stats` trigger keeps visit and no-show counts |
| 8 | Walk-ins and waitlist | e2e "AC8"; waitlist board seat action creates a seated walk-in reservation |
| 9 | Reports use real data | unit report tests; the report page and exports read `reservations` and `payments` only, and POS revenue shows "pending" |
| 10 | Audit logs exist | integration "audit log and reservation history record the change" (includes actor id); audit-logs page |
| 11 | Mobile booking works | e2e "AC6/11" with the iPhone 13 device profile |
| 12 | Database permissions are tested | integration suite: anon denied on 7 tables and the RPC; viewer cannot write; cross-branch writes denied; no self-escalation |

## Manual test results (local, 2026-11-06)

- Every staff page returns 200 with no browser console errors, checked as Super Admin and as Capricci host.
- REST API: restaurants, availability, create (`201`, auto-assigned table), get and cancel all work. A request without a key returns 401 and an unknown slug returns 404.
- Exports: the reservations CSV is branch-scoped for a host. The report CSV and Excel files download for Super Admin and return 403 for a host. The PDPA JSON export works for Super Admin only.
- Cron: 401 without the secret, 200 with it.
- Notifications with no provider credentials are logged as `not_configured`, never `sent`.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.

## Bugs found by the tests

- RLS: `INSERT … RETURNING` on `restaurants` failed for a Super Admin, because the select policy looked up the new row by id inside the same statement. Fixed in migration `20261106000800_restaurant_select_fix.sql`.
- Accessibility: form labels were not linked to their inputs. `Field` now links them automatically.
