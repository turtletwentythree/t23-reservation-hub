import { formatInTimeZone } from "date-fns-tz";
import type { StaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/data/common";
import { loadCapacityMonth } from "@/lib/data/capacity";
import { loadRestaurantConfig } from "@/lib/domain/reservation-service";
import { addDays, buildDashboard, prevMonth, type BranchTodayRow, type DayReservationRow, type RequestRow } from "@/lib/domain/dashboard";
import { EmptyState } from "@/components/ui/card";
import { LiveRefresh } from "@/components/live-refresh";
import { DashboardView } from "./view";

export type DashboardParams = { restaurant?: string; date?: string };

/** The staff dashboard: one restaurant, one day (today by default), with the 14 days ahead and the month. */
export async function StaffDashboard({ ctx, params }: { ctx: StaffContext; params: DashboardParams }) {
  const { t, locale } = await getStaffT();
  const restaurantId = [params.restaurant, ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const month = date.slice(0, 7);
  const last = prevMonth(month);
  const aheadMonth = addDays(date, 13).slice(0, 7);
  const months = [...new Set([last, month, aheadMonth])];
  const supabase = await createClient();
  const config = await loadRestaurantConfig(supabase, restaurantId);
  const ids = ctx.restaurants.map((r) => r.id);
  const multi = ids.length > 1;

  const [capMonths, dayRes, monthRes, reqRes, pendingRes, sources, branchRes, branchCap, branchDayCap, branchPending] = await Promise.all([
    Promise.all(months.map((mo) => loadCapacityMonth(supabase, restaurantId, mo, config))),
    supabase
      .from("reservations")
      .select("id, reservation_time, duration_minutes, customer_name, party_size, status, internal_notes, guest_notes, allergies, dietary_requirements, special_occasion, booking_source_id, reservation_tables(tables(label, area_id))")
      .eq("restaurant_id", restaurantId)
      .eq("reservation_date", date)
      .order("reservation_time"),
    supabase
      .from("reservations")
      .select("reservation_date, party_size, status, booking_source_id, internal_notes")
      .eq("restaurant_id", restaurantId)
      .gte("reservation_date", `${last}-01`)
      .lte("reservation_date", `${month}-31`),
    supabase
      .from("booking_requests")
      .select("requested_date, party_size, status, channel, decline_reason")
      .eq("restaurant_id", restaurantId)
      .gte("requested_date", `${last}-01`)
      .lte("requested_date", `${month}-31`),
    supabase
      .from("booking_requests")
      .select("id, customer_name, channel, party_size, requested_date, requested_time, notes, created_at", { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .order("requested_date")
      .order("requested_time")
      .limit(6),
    supabase.from("booking_sources").select("id, name"),
    multi
      ? supabase.from("reservations").select("restaurant_id, party_size").in("restaurant_id", ids).eq("reservation_date", date).not("status", "in", "(cancelled,no_show)")
      : Promise.resolve({ data: [] as { restaurant_id: string; party_size: number }[] }),
    multi ? supabase.from("restaurants").select("id, default_daily_capacity").in("id", ids) : Promise.resolve({ data: [], error: null }),
    multi ? supabase.from("daily_capacity").select("restaurant_id, capacity").in("restaurant_id", ids).eq("day", date) : Promise.resolve({ data: [], error: null }),
    multi ? supabase.from("booking_requests").select("restaurant_id").in("restaurant_id", ids).eq("status", "pending") : Promise.resolve({ data: [], error: null }),
  ]);

  const areaName = new Map((await supabase.from("restaurant_areas").select("id, name").eq("restaurant_id", restaurantId)).data?.map((a) => [a.id, a.name]) ?? []);
  const sourceName = new Map((sources.data ?? []).map((s) => [s.id, s.name]));

  type TableJoin = { tables: { label: string; area_id: string | null } | null };
  const day: DayReservationRow[] = (dayRes.data ?? []).map((r) => ({
    id: r.id,
    reservation_time: r.reservation_time,
    duration_minutes: r.duration_minutes,
    customer_name: r.customer_name,
    party_size: r.party_size,
    status: r.status,
    internal_notes: r.internal_notes,
    guest_notes: r.guest_notes,
    allergies: r.allergies,
    dietary_requirements: r.dietary_requirements,
    special_occasion: r.special_occasion,
    source: r.booking_source_id ? (sourceName.get(r.booking_source_id) ?? null) : null,
    tables: ((r.reservation_tables ?? []) as unknown as TableJoin[]).filter((x) => x.tables).map((x) => ({ label: x.tables!.label, area: x.tables!.area_id ? (areaName.get(x.tables!.area_id) ?? null) : null })),
  }));

  // Per-restaurant seats for the day: the daily number, else the default, else unknown.
  let branches: BranchTodayRow[] = [];
  if (multi) {
    const override = new Map((branchDayCap.error ? [] : (branchDayCap.data ?? [])).map((x: { restaurant_id: string; capacity: number | null }) => [x.restaurant_id, x.capacity]));
    const def = new Map((branchCap.error ? [] : (branchCap.data ?? [])).map((x: { id: string; default_daily_capacity: number | null }) => [x.id, x.default_daily_capacity]));
    const pend = new Map<string, number>();
    for (const p of (branchPending.error ? [] : (branchPending.data ?? [])) as { restaurant_id: string }[]) pend.set(p.restaurant_id, (pend.get(p.restaurant_id) ?? 0) + 1);
    branches = ctx.restaurants.map((r) => {
      const rows = (branchRes.data ?? []).filter((x) => x.restaurant_id === r.id);
      return {
        id: r.id,
        name: r.name,
        bookings: rows.length,
        guests: rows.reduce((a, x) => a + x.party_size, 0),
        seats: r.id === restaurantId ? (capMonths.flatMap((c) => c.rows).find((c) => c.date === date)?.seats ?? null) : (override.get(r.id) ?? def.get(r.id) ?? null),
        pending: pend.get(r.id) ?? 0,
      };
    });
  }

  const nowLocal = formatInTimeZone(new Date(), restaurant.timezone, "HH:mm");
  const data = buildDashboard({
    date,
    today,
    nowMinutes: Number(nowLocal.slice(0, 2)) * 60 + Number(nowLocal.slice(3, 5)),
    hours: config.hours,
    capacity: capMonths.flatMap((c) => c.rows),
    day,
    months: (monthRes.data ?? []).map((r) => ({ date: r.reservation_date, party: r.party_size, status: r.status, source: r.booking_source_id ? (sourceName.get(r.booking_source_id) ?? null) : null, notes: r.internal_notes })),
    requests: (reqRes.error ? [] : (reqRes.data ?? [])).map((r) => ({ requested_date: r.requested_date, party: r.party_size, status: r.status as RequestRow["status"], channel: r.channel as RequestRow["channel"], decline_reason: r.decline_reason })),
    pending: pendingRes.error ? [] : ((pendingRes.data ?? []) as Parameters<typeof buildDashboard>[0]["pending"]),
    pendingCount: pendingRes.error ? 0 : (pendingRes.count ?? 0),
    branches,
  });

  return (
    <>
      <LiveRefresh tables={["reservations", "booking_requests", "daily_capacity"]} />
      <DashboardView
        data={data}
        t={t}
        dateLocale={STAFF_DATE_LOCALES[locale]}
        restaurant={{ id: restaurant.id, name: restaurant.name }}
        restaurants={ctx.restaurants.map((r) => ({ id: r.id, name: r.name }))}
        canHandle={roleCan(ctx.role, "request.handle")}
      />
    </>
  );
}
