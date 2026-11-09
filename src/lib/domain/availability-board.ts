/**
 * Availability board: a table-by-time view of one restaurant day, used by the
 * Call Center and Store staff to answer "is this date / time / table full?".
 * Pure and framework-free; built on the same rules as the booking engine.
 */
import { computeAvailability, durationForParty, localToUtc, servicesForDate, type CombinationInput, type HoursInput, type OccupancyInput, type PolicyInput, type TableInput } from "./availability";

export type BoardTable = TableInput & { area?: string | null };

export interface BoardSlot {
  time: string;
  service: string;
  /** Slot has already finished (staff can still book a custom time). */
  past: boolean;
  /** Tables free at this moment. */
  freeTables: number;
  /** Tables that can be used at all (active and not out of service). */
  totalTables: number;
  /** A party of the requested size can be seated for its full turn time from here. */
  fitsParty: boolean;
  /** Best table(s) for that party, if any. */
  bestLabels: string[];
  level: "open" | "busy" | "full" | "past";
}

export interface BoardRow {
  id: string;
  label: string;
  area: string | null;
  capacity: number;
  usable: boolean;
  /** One entry per slot: true when a booking holds the table during that slot. */
  busy: boolean[];
}

export type Board =
  | { ok: true; durationMinutes: number; intervalMinutes: number; slots: BoardSlot[]; rows: BoardRow[] }
  | { ok: false; reason: "closed" | "invalid_date"; slots: []; rows: [] };

export function buildAvailabilityBoard(args: {
  date: string;
  partySize: number;
  timezone: string;
  policy: PolicyInput;
  hours: HoursInput[];
  tables: BoardTable[];
  combinations: CombinationInput[];
  occupancy: OccupancyInput[];
  now: Date;
}): Board {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return { ok: false, reason: "invalid_date", slots: [], rows: [] };
  if (servicesForDate(args.hours, args.date).length === 0) return { ok: false, reason: "closed", slots: [], rows: [] };

  const partySize = Math.max(1, args.partySize);
  const res = computeAvailability({ ...args, partySize, channel: "staff" });
  if (!res.ok) return { ok: false, reason: res.reason === "closed" ? "closed" : "invalid_date", slots: [], rows: [] };

  const interval = Math.max(5, args.policy.slot_interval_minutes);
  const tables = args.tables.filter((t) => t.is_active);
  const usable = (t: TableInput) => t.service_status !== "out_of_service";
  const byTable = new Map<string, OccupancyInput[]>();
  for (const o of args.occupancy) {
    const list = byTable.get(o.table_id) ?? [];
    list.push(o);
    byTable.set(o.table_id, list);
  }

  const rows: BoardRow[] = tables.map((t) => ({
    id: t.id,
    label: t.label,
    area: t.area ?? null,
    capacity: t.max_capacity,
    usable: usable(t),
    busy: res.slots.map((s) => {
      const start = localToUtc(args.date, s.time, args.timezone);
      const end = new Date(start.getTime() + interval * 60_000);
      return (byTable.get(t.id) ?? []).some((o) => o.start < end && start < o.end);
    }),
  }));

  const totalTables = rows.filter((r) => r.usable).length;
  const duration = durationForParty(args.policy, partySize);
  const slots: BoardSlot[] = res.slots.map((s, i) => {
    const past = s.ends_at <= args.now;
    const freeTables = rows.filter((r) => r.usable && !r.busy[i]).length;
    const fitsParty = !past && s.available;
    const level: BoardSlot["level"] = past
      ? "past"
      : !fitsParty
        ? "full"
        : totalTables > 0 && freeTables / totalTables <= 0.25
          ? "busy"
          : "open";
    return {
      time: s.time,
      service: s.service,
      past,
      freeTables,
      totalTables,
      fitsParty,
      bestLabels: s.best?.labels ?? [],
      level,
    };
  });

  return { ok: true, durationMinutes: duration, intervalMinutes: interval, slots, rows };
}

export interface RoomTable {
  id: string;
  label: string;
  capacity: number;
  state: "free" | "booked" | "out";
}

export interface RoomSummary {
  id: string | null;
  name: string;
  tables: RoomTable[];
  /** Tables that can be used (not out of service). */
  total: number;
  free: number;
  booked: number;
  seats: number;
  freeSeats: number;
}

/** Group the board rows by room (area) for one time slot: tables, free and booked. */
export function summarizeRooms(
  board: Extract<Board, { ok: true }>,
  tableAreas: Map<string, string | null>,
  areas: { id: string; name: string; sort_order: number }[],
  slotIndex: number,
): RoomSummary[] {
  const order = [...areas].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const groups: { id: string | null; name: string }[] = order.map((a) => ({ id: a.id, name: a.name }));
  if (board.rows.some((r) => !tableAreas.get(r.id))) groups.push({ id: null, name: "—" });
  return groups
    .map((g) => {
      const tables: RoomTable[] = board.rows
        .filter((r) => (tableAreas.get(r.id) ?? null) === g.id)
        .map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, state: !r.usable ? "out" : r.busy[slotIndex] ? "booked" : "free" }));
      const usable = tables.filter((x) => x.state !== "out");
      const free = usable.filter((x) => x.state === "free");
      return {
        id: g.id,
        name: g.name,
        tables,
        total: usable.length,
        free: free.length,
        booked: usable.length - free.length,
        seats: usable.reduce((a, x) => a + x.capacity, 0),
        freeSeats: free.reduce((a, x) => a + x.capacity, 0),
      };
    })
    .filter((r) => r.tables.length > 0);
}
