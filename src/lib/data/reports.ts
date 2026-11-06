import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, getBookingSources } from "./common";
import { bySource, capacityFor, dailyTrend, peakHours, summarize, type ReportReservation } from "@/lib/domain/reports";

export async function buildReport(restaurantIds: string[], from: string, to: string) {
  const supabase = await createClient();
  const rows: ReportReservation[] = [];
  // paginate past PostgREST's row cap
  for (let page = 0; page < 50; page++) {
    const { data } = await supabase
      .from("reservations")
      .select("restaurant_id, reservation_date, reservation_time, party_size, duration_minutes, status, booking_source_id, customer_id")
      .in("restaurant_id", restaurantIds)
      .gte("reservation_date", from)
      .lte("reservation_date", to)
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    rows.push(...((data ?? []) as ReportReservation[]));
    if (!data || data.length < 1000) break;
  }
  const [{ data: tables }, { data: hours }, { data: restaurants }, sources, { data: payments }] = await Promise.all([
    supabase.from("tables").select("restaurant_id, max_capacity").in("restaurant_id", restaurantIds).eq("is_active", true),
    supabase.from("operating_hours").select("restaurant_id, day_of_week, specific_date, open_time, close_time, is_closed").in("restaurant_id", restaurantIds),
    supabase.from("restaurants").select("id, name, currency").in("id", restaurantIds),
    getBookingSources(),
    supabase.from("payments").select("restaurant_id, amount, currency, kind, created_at, refunds(amount, status)").in("restaurant_id", restaurantIds).eq("status", "succeeded").gte("paid_at", `${from}T00:00:00+07:00`).lte("paid_at", `${to}T23:59:59+07:00`),
  ]);
  const dates: string[] = [];
  for (let d = from; d <= to && dates.length < 400; d = addDays(d, 1)) dates.push(d);
  const capacity = restaurantIds.map((id) =>
    capacityFor(id, dates, (tables ?? []).filter((t) => t.restaurant_id === id).reduce((a, t) => a + t.max_capacity, 0), (hours ?? []).filter((h) => h.restaurant_id === id)),
  );
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const repeat = new Set<string>();
  for (let i = 0; i < custIds.length; i += 300) {
    const { data } = await supabase.from("customers").select("id").in("id", custIds.slice(i, i + 300)).gte("total_visits", 2);
    (data ?? []).forEach((c) => repeat.add(c.id));
  }
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const names = new Map((restaurants ?? []).map((r) => [r.id, r.name]));
  const branches = restaurantIds.map((id) => {
    const s = summarize(rows.filter((r) => r.restaurant_id === id), capacity.filter((c) => c.restaurant_id === id), repeat);
    return { restaurant: names.get(id) ?? id, ...s };
  });
  const paymentsTotal = (payments ?? []).reduce((a, p) => a + Number(p.amount) - (p.refunds ?? []).filter((r) => r.status === "succeeded").reduce((x, r) => x + Number(r.amount), 0), 0);
  return {
    summary: summarize(rows, capacity, repeat),
    sources: bySource(rows, sourceNames),
    peaks: peakHours(rows),
    trend: dailyTrend(rows),
    branches,
    payments: { net: paymentsTotal, count: (payments ?? []).length },
    rowCount: rows.length,
  };
}
export type Report = Awaited<ReturnType<typeof buildReport>>;
