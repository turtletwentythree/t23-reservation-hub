/**
 * Booking availability engine (pure, framework-free, unit tested).
 *
 * It answers "which start times can seat a party of N on date D, and on which
 * table(s)?" using: operating hours (weekly + date overrides), last seating,
 * seating duration by party size (turn time), buffer time, booking interval,
 * table capacities, table combinations, table service status and existing
 * reservations. The database exclusion constraint on reservation_tables remains
 * the final guarantee against double booking under concurrency.
 */
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

export type Channel = "online" | "staff";

export interface PolicyInput {
  default_duration_minutes: number;
  duration_rules: { max_party: number; minutes: number }[] | unknown;
  buffer_minutes: number;
  slot_interval_minutes: number;
  min_party_size: number;
  max_party_size: number;
  min_advance_minutes: number;
  max_advance_days: number;
}

export interface HoursInput {
  day_of_week: number | null;
  specific_date: string | null;
  service_name: string;
  open_time: string | null; // "HH:MM[:SS]"
  close_time: string | null;
  last_seating_time: string | null;
  is_closed: boolean;
}

export interface TableInput {
  id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  is_active: boolean;
  is_online_bookable: boolean;
  is_combinable: boolean;
  service_status: "available" | "cleaning" | "out_of_service";
}

export interface CombinationInput {
  id: string;
  name: string;
  min_capacity: number;
  max_capacity: number;
  is_active: boolean;
  table_ids: string[];
}

export interface OccupancyInput {
  table_id: string;
  start: Date; // inclusive
  end: Date; // exclusive, already includes the buffer of that booking
  reservation_id?: string;
}

export interface TableOption {
  kind: "single" | "combination";
  table_ids: string[];
  labels: string[];
  capacity: number;
}

export interface Slot {
  time: string; // local "HH:MM"
  service: string;
  starts_at: Date;
  ends_at: Date;
  available: boolean;
  best: TableOption | null;
  options: TableOption[];
}

export interface AvailabilityRequest {
  date: string; // local "YYYY-MM-DD"
  partySize: number;
  timezone: string;
  policy: PolicyInput;
  hours: HoursInput[];
  tables: TableInput[];
  combinations: CombinationInput[];
  occupancy: OccupancyInput[];
  now: Date;
  channel: Channel;
  durationOverride?: number | null;
  /** Ignore this reservation's own occupancy (used when modifying a booking). */
  ignoreReservationId?: string;
}

export type AvailabilityResult =
  | { ok: true; durationMinutes: number; slots: Slot[] }
  | { ok: false; reason: "closed" | "party_size_out_of_range" | "outside_booking_window" | "invalid_date"; slots: [] };

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Seating duration (turn time) for a party, from policy rules or the default. */
export function durationForParty(policy: PolicyInput, partySize: number, override?: number | null): number {
  if (override && override > 0) return override;
  const rules = Array.isArray(policy.duration_rules)
    ? (policy.duration_rules as { max_party: number; minutes: number }[]).filter((r) => r && r.max_party > 0 && r.minutes > 0)
    : [];
  const match = [...rules].sort((a, b) => a.max_party - b.max_party).find((r) => partySize <= r.max_party);
  return match ? match.minutes : policy.default_duration_minutes;
}

/** Converts a local date + time in a restaurant time zone to a UTC instant. */
export function localToUtc(date: string, time: string, timezone: string): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? time + ":00" : time}`, timezone);
}

export function localToday(now: Date, timezone: string): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

/** Services (open periods) for a local date, honouring date-specific overrides. */
export function servicesForDate(hours: HoursInput[], date: string): HoursInput[] {
  const overrides = hours.filter((h) => h.specific_date === date);
  const rows = overrides.length > 0 ? overrides : hours.filter((h) => h.day_of_week === dayOfWeek(date));
  if (rows.some((r) => r.is_closed && overrides.length > 0)) return [];
  return rows.filter((r) => !r.is_closed && r.open_time && r.close_time);
}

export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

function tableUsable(t: TableInput, channel: Channel, start: Date, now: Date): boolean {
  if (!t.is_active || t.service_status === "out_of_service") return false;
  if (channel === "online" && !t.is_online_bookable) return false;
  // A table being cleaned cannot be used for an immediate seating.
  if (t.service_status === "cleaning" && start.getTime() - now.getTime() < 30 * 60_000) return false;
  return true;
}

export function computeAvailability(req: AvailabilityRequest): AvailabilityResult {
  const { policy, partySize, timezone, channel, now } = req;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date)) return { ok: false, reason: "invalid_date", slots: [] };

  if (channel === "online" && (partySize < policy.min_party_size || partySize > policy.max_party_size)) {
    return { ok: false, reason: "party_size_out_of_range", slots: [] };
  }
  if (partySize < 1) return { ok: false, reason: "party_size_out_of_range", slots: [] };

  const today = localToday(now, timezone);
  if (channel === "online") {
    const maxDate = formatInTimeZone(new Date(now.getTime() + policy.max_advance_days * 86_400_000), timezone, "yyyy-MM-dd");
    if (req.date < today || req.date > maxDate) return { ok: false, reason: "outside_booking_window", slots: [] };
  }

  const services = servicesForDate(req.hours, req.date);
  if (services.length === 0) return { ok: false, reason: "closed", slots: [] };

  const duration = durationForParty(policy, partySize, req.durationOverride);
  const buffer = policy.buffer_minutes;
  const interval = policy.slot_interval_minutes;
  const occupancy = req.occupancy.filter((o) => !req.ignoreReservationId || o.reservation_id !== req.ignoreReservationId);
  const byTable = new Map<string, OccupancyInput[]>();
  for (const o of occupancy) {
    const list = byTable.get(o.table_id) ?? [];
    list.push(o);
    byTable.set(o.table_id, list);
  }
  const tableById = new Map(req.tables.map((t) => [t.id, t]));
  const earliest = channel === "online" ? new Date(now.getTime() + policy.min_advance_minutes * 60_000) : null;

  const slots: Slot[] = [];
  const seen = new Set<string>();
  for (const svc of services) {
    const open = toMinutes(svc.open_time!);
    const close = toMinutes(svc.close_time!);
    const last = svc.last_seating_time ? toMinutes(svc.last_seating_time) : close - duration;
    for (let m = open; m <= last; m += interval) {
      const time = fmt(m);
      if (seen.has(time)) continue;
      seen.add(time);
      const start = localToUtc(req.date, time, timezone);
      const end = new Date(start.getTime() + duration * 60_000);
      const blockEnd = new Date(end.getTime() + buffer * 60_000);

      const isFree = (tableId: string) =>
        !(byTable.get(tableId) ?? []).some((o) => overlaps(start, blockEnd, o.start, o.end));

      let options: TableOption[] = [];
      const tooEarly = earliest !== null && start < earliest;
      const inPast = channel === "staff" && end <= now;
      if (!tooEarly && !inPast) {
        for (const t of req.tables) {
          if (!tableUsable(t, channel, start, now)) continue;
          const minOk = channel === "online" ? partySize >= t.min_capacity : true;
          if (minOk && partySize <= t.max_capacity && isFree(t.id)) {
            options.push({ kind: "single", table_ids: [t.id], labels: [t.label], capacity: t.max_capacity });
          }
        }
        for (const c of req.combinations) {
          if (!c.is_active || partySize < c.min_capacity || partySize > c.max_capacity) continue;
          const members = c.table_ids.map((id) => tableById.get(id));
          if (members.some((t) => !t || !t.is_combinable || !tableUsable(t, channel, start, now) || !isFree(t.id))) continue;
          options.push({
            kind: "combination",
            table_ids: c.table_ids,
            labels: members.map((t) => t!.label),
            capacity: c.max_capacity,
          });
        }
        options = rankOptions(options, partySize);
      }
      slots.push({
        time,
        service: svc.service_name,
        starts_at: start,
        ends_at: end,
        available: options.length > 0,
        best: options[0] ?? null,
        options,
      });
    }
  }
  slots.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  return { ok: true, durationMinutes: duration, slots };
}

/** Best fit first: least wasted seats, single tables before combinations, then label. */
export function rankOptions(options: TableOption[], partySize: number): TableOption[] {
  return [...options].sort((a, b) => {
    const waste = a.capacity - partySize - (b.capacity - partySize);
    if (waste !== 0) return waste;
    if (a.kind !== b.kind) return a.kind === "single" ? -1 : 1;
    return a.labels.join(",").localeCompare(b.labels.join(","), undefined, { numeric: true });
  });
}

/** Convert DB tstzrange text like '["2026-11-06 11:30:00+00","2026-11-06 13:15:00+00")' to dates. */
export function parseTstzRange(range: string): { start: Date; end: Date } | null {
  const m = range.match(/^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/);
  if (!m) return null;
  const start = new Date(m[1].replace(" ", "T").replace(/\+00$/, "Z"));
  const end = new Date(m[2].replace(" ", "T").replace(/\+00$/, "Z"));
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

export { toZonedTime };
