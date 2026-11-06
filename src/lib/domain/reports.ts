/**
 * Report calculations. Pure functions over actual database rows (no estimates).
 * Definitions are shown in the UI next to each KPI.
 */
import type { ReservationStatus } from "@/lib/supabase/types";

export interface ReportReservation {
  restaurant_id: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  duration_minutes: number;
  status: ReservationStatus;
  booking_source_id: string | null;
  customer_id: string | null;
}
export interface ReportCapacity {
  restaurant_id: string;
  /** Sum over days in range of (seats × open minutes). */
  seat_minutes: number;
}

const live = (s: ReservationStatus) => s !== "cancelled" && s !== "no_show";
const honoured = (s: ReservationStatus) => s === "completed" || s === "seated" || s === "arrived";
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export function summarize(rows: ReportReservation[], capacity: ReportCapacity[], repeatCustomerIds: Set<string>) {
  const total = rows.length;
  const liveRows = rows.filter((r) => live(r.status));
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const noShows = rows.filter((r) => r.status === "no_show").length;
  const covers = liveRows.reduce((a, r) => a + r.party_size, 0);
  const bookedSeatMinutes = liveRows.reduce((a, r) => a + r.party_size * r.duration_minutes, 0);
  const availableSeatMinutes = capacity.reduce((a, c) => a + c.seat_minutes, 0);
  const customers = new Set(rows.filter((r) => r.customer_id && live(r.status)).map((r) => r.customer_id!));
  const repeat = [...customers].filter((c) => repeatCustomerIds.has(c)).length;

  return {
    totalReservations: total,
    liveReservations: liveRows.length,
    covers,
    honouredCovers: rows.filter((r) => honoured(r.status)).reduce((a, r) => a + r.party_size, 0),
    occupancyRate: pct(bookedSeatMinutes, availableSeatMinutes),
    avgPartySize: liveRows.length ? Math.round((covers / liveRows.length) * 10) / 10 : 0,
    cancellationRate: pct(cancelled, total),
    noShowRate: pct(noShows, total - cancelled),
    cancelled,
    noShows,
    uniqueGuests: customers.size,
    repeatCustomerRate: pct(repeat, customers.size),
  };
}

export function groupBy<K extends string>(rows: ReportReservation[], key: (r: ReportReservation) => K) {
  const m = new Map<K, ReportReservation[]>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

export function bySource(rows: ReportReservation[], names: Map<string, string>) {
  return [...groupBy(rows, (r) => (r.booking_source_id ?? "none") as string).entries()]
    .map(([id, list]) => {
      const cancelled = list.filter((r) => r.status === "cancelled").length;
      return {
        source: names.get(id) ?? "Unspecified",
        reservations: list.length,
        covers: list.filter((r) => live(r.status)).reduce((a, r) => a + r.party_size, 0),
        cancellationRate: pct(cancelled, list.length),
        noShowRate: pct(list.filter((r) => r.status === "no_show").length, list.length - cancelled),
      };
    })
    .sort((a, b) => b.reservations - a.reservations);
}

export function peakHours(rows: ReportReservation[]) {
  const hours = new Map<number, { reservations: number; covers: number }>();
  for (const r of rows.filter((x) => live(x.status))) {
    const h = Number(r.reservation_time.slice(0, 2));
    const cur = hours.get(h) ?? { reservations: 0, covers: 0 };
    hours.set(h, { reservations: cur.reservations + 1, covers: cur.covers + r.party_size });
  }
  return [...hours.entries()].sort(([a], [b]) => a - b).map(([h, v]) => ({ hour: `${String(h).padStart(2, "0")}:00`, ...v }));
}

export function dailyTrend(rows: ReportReservation[]) {
  return [...groupBy(rows, (r) => r.reservation_date).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      reservations: list.filter((r) => live(r.status)).length,
      covers: list.filter((r) => live(r.status)).reduce((a, r) => a + r.party_size, 0),
      cancelled: list.filter((r) => r.status === "cancelled").length,
      noShows: list.filter((r) => r.status === "no_show").length,
    }));
}

/** Seat-minutes available per restaurant over a date range from opening hours × active table seats. */
export function capacityFor(
  restaurantId: string,
  dates: string[],
  seats: number,
  hours: { day_of_week: number | null; specific_date: string | null; open_time: string | null; close_time: string | null; is_closed: boolean }[],
): ReportCapacity {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let total = 0;
  for (const d of dates) {
    const [y, m, dd] = d.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    const override = hours.filter((h) => h.specific_date === d);
    const rows = override.length ? override : hours.filter((h) => h.day_of_week === dow);
    if (override.some((h) => h.is_closed)) continue;
    for (const h of rows) if (!h.is_closed && h.open_time && h.close_time) total += (mins(h.close_time) - mins(h.open_time)) * seats;
  }
  return { restaurant_id: restaurantId, seat_minutes: total };
}
