/**
 * Daily capacity check for one month (the interim phone / LINE flow).
 * Mirrors the "Media / KOL capacity check" sheet: guests per day by type,
 * against the restaurant's seats, with OK / FULL / OVER CAP.
 */
import { servicesForDate, type HoursInput } from "./availability";
import { splitCustomerType, type CustomerType } from "./request-tags";

export type CapacityStatus = "ok" | "full" | "over" | "closed";

export interface CapacityDay {
  date: string;
  pax: Record<CustomerType | "other", number>;
  total: number;
  /** Guests in requests still waiting for the store to key them in (not in total). */
  waiting: number;
  seats: number;
  left: number;
  status: CapacityStatus;
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function buildCapacityMonth(args: {
  month: string; // "YYYY-MM"
  /** Guests accepted on a day (daily capacity setting, or the table seats). */
  seats: number | ((date: string) => number);
  hours: HoursInput[];
  reservations: { date: string; party: number; notes: string | null }[];
  waiting: { date: string; party: number }[];
}): CapacityDay[] {
  return monthDays(args.month).map((date) => {
    const pax = { internal: 0, kol: 0, media: 0, other: 0 };
    for (const r of args.reservations) {
      if (r.date !== date) continue;
      pax[splitCustomerType(r.notes).type ?? "other"] += r.party;
    }
    const total = pax.internal + pax.kol + pax.media + pax.other;
    const waiting = args.waiting.filter((w) => w.date === date).reduce((a, w) => a + w.party, 0);
    const seats = typeof args.seats === "function" ? args.seats(date) : args.seats;
    const closed = servicesForDate(args.hours, date).length === 0 || seats === 0;
    const status: CapacityStatus = closed ? "closed" : total > seats ? "over" : total === seats ? "full" : "ok";
    return { date, pax, total, waiting, seats, left: seats - total, status };
  });
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
