/**
 * Staff dashboard figures, computed from plain rows so the page can be previewed
 * and tested without a database. Everything is for one restaurant and one day,
 * plus that day's month (with the month before for comparison) and the 14 days ahead.
 */
import type { ReservationStatus } from "@/lib/supabase/types";
import { servicesForDate, type HoursInput } from "./availability";
import type { CapacityDay, CapacityStatus } from "./capacity-check";
import { splitCustomerType, type CustomerType } from "./request-tags";

export type GuestType = CustomerType | "other";
export const GUEST_TYPES: GuestType[] = ["internal", "kol", "media", "other"];

const ACTIVE: ReservationStatus[] = ["pending", "confirmed", "arrived", "seated"];
const LIVE = (s: ReservationStatus) => s !== "cancelled" && s !== "no_show";

export interface DayReservationRow {
  id: string;
  reservation_time: string; // HH:MM[:SS]
  duration_minutes: number;
  customer_name: string;
  party_size: number;
  status: ReservationStatus;
  internal_notes: string | null;
  guest_notes: string | null;
  allergies: string | null;
  dietary_requirements: string | null;
  special_occasion: string | null;
  source: string | null;
  tables: { label: string; area: string | null }[];
}

export interface MonthReservationRow {
  date: string;
  party: number;
  status: ReservationStatus;
  source: string | null;
  notes: string | null;
}

export interface RequestRow {
  requested_date: string;
  party: number;
  status: "pending" | "booked" | "declined" | "cancelled";
  channel: "call" | "line";
  decline_reason: string | null;
}

export interface PendingRequestRow {
  id: string;
  customer_name: string;
  channel: "call" | "line";
  party_size: number;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  created_at: string;
}

export interface BranchTodayRow {
  id: string;
  name: string;
  bookings: number;
  guests: number;
  seats: number | null;
  pending: number;
}

export interface DashboardInput {
  date: string;
  today: string;
  /** Minutes since local midnight right now (used only when date is today). */
  nowMinutes: number;
  hours: HoursInput[];
  /** Capacity rows covering the previous month, the date's month and the 14 days ahead. */
  capacity: CapacityDay[];
  day: DayReservationRow[];
  /** All reservations (any status) in the date's month and the month before. */
  months: MonthReservationRow[];
  /** Requests whose requested date falls in the date's month and the month before. */
  requests: RequestRow[];
  pending: PendingRequestRow[];
  pendingCount: number;
  branches: BranchTodayRow[];
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export type AttentionTone = "red" | "amber" | "blue";
export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  /** English text with {n} for the count; translated by the view. */
  text: string;
  n: number;
  detail?: string;
  href: string;
}

export interface SlotLoad {
  time: string;
  inHouse: number;
  arriving: number;
}

export interface ArrivalGroup {
  time: string;
  guests: number;
  rows: (DayReservationRow & { type: GuestType; note: string; late: boolean; end: string })[];
}

export interface MonthStats {
  month: string;
  guests: number;
  seats: number;
  bookings: number;
  avgParty: number;
  cancelled: number;
  noShow: number;
  lostRate: number;
  byType: Record<GuestType, number>;
  bySource: { name: string; bookings: number }[];
  requests: { total: number; booked: number; declined: number; pending: number; call: number; line: number };
  declineReasons: { reason: string; n: number }[];
  overDays: number;
  fullDays: number;
}

export function computeMonth(month: string, input: Pick<DashboardInput, "capacity" | "months" | "requests">): MonthStats {
  const days = input.capacity.filter((c) => c.date.startsWith(month));
  const res = input.months.filter((r) => r.date.startsWith(month));
  const live = res.filter((r) => LIVE(r.status));
  const byType: Record<GuestType, number> = { internal: 0, kol: 0, media: 0, other: 0 };
  for (const r of live) byType[splitCustomerType(r.notes).type ?? "other"] += r.party;
  const src = new Map<string, number>();
  for (const r of live) src.set(r.source ?? "—", (src.get(r.source ?? "—") ?? 0) + 1);
  const reqs = input.requests.filter((r) => r.requested_date.startsWith(month));
  const reasons = new Map<string, number>();
  for (const r of reqs) if (r.status === "declined") reasons.set(r.decline_reason?.trim() || "—", (reasons.get(r.decline_reason?.trim() || "—") ?? 0) + 1);
  const guests = live.reduce((a, r) => a + r.party, 0);
  const cancelled = res.filter((r) => r.status === "cancelled").length;
  const noShow = res.filter((r) => r.status === "no_show").length;
  return {
    month,
    guests,
    seats: days.filter((d) => d.status !== "closed").reduce((a, d) => a + d.seats, 0),
    bookings: live.length,
    avgParty: live.length ? guests / live.length : 0,
    cancelled,
    noShow,
    lostRate: res.length ? (cancelled + noShow) / res.length : 0,
    byType,
    bySource: [...src].map(([name, bookings]) => ({ name, bookings })).sort((a, b) => b.bookings - a.bookings),
    requests: {
      total: reqs.filter((r) => r.status !== "cancelled").length,
      booked: reqs.filter((r) => r.status === "booked").length,
      declined: reqs.filter((r) => r.status === "declined").length,
      pending: reqs.filter((r) => r.status === "pending").length,
      call: reqs.filter((r) => r.channel === "call" && r.status !== "cancelled").length,
      line: reqs.filter((r) => r.channel === "line" && r.status !== "cancelled").length,
    },
    declineReasons: [...reasons].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n).slice(0, 3),
    overDays: days.filter((d) => d.status === "over").length,
    fullDays: days.filter((d) => d.status === "full").length,
  };
}

export function buildDashboard(input: DashboardInput) {
  const { date, today } = input;
  const isToday = date === today;
  const now = isToday ? input.nowMinutes : date < today ? 24 * 60 * 2 : -1;
  const capByDate = new Map(input.capacity.map((c) => [c.date, c]));
  const dayCap = capByDate.get(date);

  // ---- The day ----
  const live = input.day.filter((r) => LIVE(r.status));
  const guests = live.reduce((a, r) => a + r.party_size, 0);
  const seats = dayCap?.seats ?? 0;
  const dayStatus: CapacityStatus = dayCap?.status === "closed" || !seats ? "closed" : guests > seats ? "over" : guests === seats ? "full" : "ok";
  const byType: Record<GuestType, number> = { internal: 0, kol: 0, media: 0, other: 0 };
  for (const r of live) byType[splitCustomerType(r.internal_notes).type ?? "other"] += r.party_size;
  const inHouseNow = isToday
    ? live.filter((r) => r.status === "arrived" || r.status === "seated").reduce((a, r) => a + r.party_size, 0)
    : 0;
  const toCome = live.filter((r) => r.status === "pending" || r.status === "confirmed");
  const done = live.filter((r) => r.status === "completed" || r.status === "arrived" || r.status === "seated");
  const nextArrival = isToday ? toCome.map((r) => toMin(r.reservation_time)).filter((m) => m >= now - 15).sort((a, b) => a - b)[0] : undefined;

  // Arrivals, grouped by time
  const groups = new Map<string, ArrivalGroup>();
  for (const r of [...live].sort((a, b) => a.reservation_time.localeCompare(b.reservation_time) || a.customer_name.localeCompare(b.customer_name))) {
    const time = r.reservation_time.slice(0, 5);
    const g = groups.get(time) ?? { time, guests: 0, rows: [] };
    const start = toMin(r.reservation_time);
    const note = [r.special_occasion, splitCustomerType(r.internal_notes).notes, r.guest_notes].map((x) => x?.trim()).filter(Boolean).join(" · ");
    g.rows.push({
      ...r,
      type: splitCustomerType(r.internal_notes).type ?? "other",
      note,
      late: (r.status === "pending" || r.status === "confirmed") && now >= start + 15,
      end: hhmm(start + r.duration_minutes),
    });
    g.guests += r.party_size;
    groups.set(time, g);
  }
  const arrivals = [...groups.values()];

  // Guests in the restaurant through the day, every 30 minutes
  const services = servicesForDate(input.hours, date);
  const opens = services.map((s) => toMin(s.open_time!));
  const closes = services.map((s) => { const c = toMin(s.close_time!); const o = toMin(s.open_time!); return c <= o ? c + 1440 : c; });
  const firstRes = live.map((r) => toMin(r.reservation_time));
  const lastEnd = live.map((r) => toMin(r.reservation_time) + r.duration_minutes);
  const from = Math.floor(Math.min(...opens, ...firstRes, 17 * 60) / 30) * 30;
  const to = Math.ceil(Math.max(...closes, ...lastEnd, from + 4 * 60) / 30) * 30;
  const slots: SlotLoad[] = [];
  for (let m = from; m < to; m += 30) {
    let inHouse = 0, arriving = 0;
    for (const r of live) {
      const s = toMin(r.reservation_time);
      if (s < m + 30 && s + r.duration_minutes > m) inHouse += r.party_size;
      if (s >= m && s < m + 30) arriving += r.party_size;
    }
    slots.push({ time: hhmm(m), inHouse, arriving });
  }
  const peakSlot = slots.reduce<SlotLoad | null>((a, s) => (!a || s.inHouse > a.inHouse ? s : a), null);
  const nowSlot = isToday ? hhmm(Math.floor(now / 30) * 30) : null;

  // ---- 14 days ahead ----
  const outlook = Array.from({ length: 14 }, (_, i) => capByDate.get(addDays(date, i))).filter((d): d is CapacityDay => Boolean(d));
  const outlookOpen = outlook.filter((d) => d.status !== "closed");
  const outlookGuests = outlookOpen.reduce((a, d) => a + d.total, 0);
  const outlookSeats = outlookOpen.reduce((a, d) => a + d.seats, 0);

  // ---- Month ----
  const month = date.slice(0, 7);
  const thisMonth = computeMonth(month, input);
  const lastMonth = computeMonth(prevMonth(month), input);
  const monthDays = input.capacity.filter((c) => c.date.startsWith(month) && c.status !== "closed");
  const wd = Array.from({ length: 7 }, () => ({ guests: 0, days: 0 }));
  for (const d of monthDays) { wd[weekday(d.date)].guests += d.total; wd[weekday(d.date)].days += 1; }
  // Monday first
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ day: i, avg: wd[i].days ? wd[i].guests / wd[i].days : 0, days: wd[i].days }));

  // ---- Needs attention ----
  const attention: AttentionItem[] = [];
  const late = arrivals.flatMap((g) => g.rows).filter((r) => r.late);
  if (late.length) attention.push({ key: "late", tone: "red", text: "{n} bookings are 15+ minutes late. Call them or mark no-show", n: late.length, detail: late.map((r) => `${r.reservation_time.slice(0, 5)} ${r.customer_name}`).join(", "), href: `/reservations?date=${date}` });
  const overAhead = outlook.filter((d) => d.status === "over");
  if (overAhead.length) attention.push({ key: "over", tone: "red", text: "{n} days in the next 14 are over capacity", n: overAhead.length, detail: overAhead.map((d) => d.date).join(","), href: `/availability?date=${overAhead[0].date}` });
  if (input.pendingCount) {
    const oldest = input.pending.map((p) => p.created_at).sort()[0];
    attention.push({ key: "requests", tone: "amber", text: "{n} phone / LINE requests waiting to be keyed in", n: input.pendingCount, detail: oldest ? `since:${oldest}` : undefined, href: "/requests" });
  }
  const reqFull = input.pending.filter((p) => { const s = capByDate.get(p.requested_date)?.status; return s === "full" || s === "over" || s === "closed"; });
  if (reqFull.length) attention.push({ key: "reqfull", tone: "red", text: "{n} waiting requests are for a day that is already full or closed", n: reqFull.length, detail: reqFull.map((p) => `${p.customer_name} (${p.requested_date})`).join(", "), href: "/requests" });
  const noTable = live.filter((r) => ACTIVE.includes(r.status) && r.tables.length === 0);
  if (noTable.length) attention.push({ key: "notable", tone: "amber", text: "{n} bookings on this day have no table yet", n: noTable.length, detail: noTable.map((r) => `${r.reservation_time.slice(0, 5)} ${r.customer_name}`).join(", "), href: `/reservations?date=${date}` });
  const unconfirmed = live.filter((r) => r.status === "pending" && !(isToday && toMin(r.reservation_time) + 15 <= now));
  if (unconfirmed.length) attention.push({ key: "pending", tone: "amber", text: "{n} bookings on this day are not confirmed yet", n: unconfirmed.length, detail: unconfirmed.map((r) => `${r.reservation_time.slice(0, 5)} ${r.customer_name}`).join(", "), href: `/reservations?date=${date}&status=pending` });
  const allergy = live.filter((r) => r.allergies?.trim() || r.dietary_requirements?.trim());
  if (allergy.length) attention.push({ key: "allergy", tone: "blue", text: "{n} bookings have allergies or dietary needs. Tell the kitchen", n: allergy.length, detail: allergy.map((r) => `${r.customer_name}: ${[r.allergies, r.dietary_requirements].filter(Boolean).join(", ")}`).join(" · "), href: `/reservations?date=${date}` });
  const occasions = live.filter((r) => r.special_occasion?.trim());
  if (occasions.length) attention.push({ key: "occasion", tone: "blue", text: "{n} special occasions on this day", n: occasions.length, detail: occasions.map((r) => `${r.customer_name}: ${r.special_occasion}`).join(" · "), href: `/reservations?date=${date}` });

  return {
    date,
    isToday,
    now,
    day: {
      guests,
      seats,
      left: seats - guests,
      status: dayStatus,
      bookings: live.length,
      byType,
      inHouseNow,
      toComeBookings: toCome.length,
      toComeGuests: toCome.reduce((a, r) => a + r.party_size, 0),
      doneBookings: done.length,
      cancelled: input.day.filter((r) => r.status === "cancelled").length,
      noShow: input.day.filter((r) => r.status === "no_show").length,
      nextArrival: nextArrival === undefined ? null : hhmm(nextArrival),
      waitingGuests: dayCap?.waiting ?? 0,
    },
    arrivals,
    slots,
    peakSlot,
    nowSlot,
    outlook,
    outlookGuests,
    outlookSeats,
    thisMonth,
    lastMonth,
    weekdays,
    attention,
    pending: input.pending,
    pendingCount: input.pendingCount,
    branches: input.branches,
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
