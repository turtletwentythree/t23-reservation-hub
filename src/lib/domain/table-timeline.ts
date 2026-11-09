/** Per-table timeline for one day: booked blocks and free gaps, grouped by room. Pure and framework-free. */
import { localToUtc } from "./availability";

export interface TimelineBlock {
  reservationId: string;
  /** Position on the axis, in percent. */
  left: number;
  width: number;
  from: string;
  to: string;
  name: string;
  party: number;
  type: string | null;
  status: string;
}

export interface TimelineTable {
  id: string;
  label: string;
  capacity: number;
  blocks: TimelineBlock[];
  /** Out of service: shown greyed out. */
  out: boolean;
}

export interface TimelineRoom {
  id: string | null;
  name: string;
  tables: TimelineTable[];
}

export interface Timeline {
  /** Axis start and end as "HH:mm". */
  start: string;
  end: string;
  ticks: { label: string; left: number }[];
  rooms: TimelineRoom[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function buildTimeline(args: {
  date: string;
  timezone: string;
  firstSlot: string;
  lastSlot: string;
  durationMinutes: number;
  tables: { id: string; label: string; capacity: number; areaId: string | null; out: boolean }[];
  areas: { id: string; name: string; sort_order: number }[];
  occupancy: { table_id: string; reservation_id: string; start: Date; end: Date }[];
  details: Map<string, { name: string; party: number; type: string | null; status: string }>;
}): Timeline {
  // Axis: whole hours around the service, so labels land on the hour.
  const axisStart = Math.floor(toMin(args.firstSlot) / 60) * 60;
  const axisEnd = Math.min(24 * 60, Math.ceil((toMin(args.lastSlot) + args.durationMinutes) / 60) * 60);
  const span = Math.max(60, axisEnd - axisStart);
  const midnight = localToUtc(args.date, "00:00", args.timezone).getTime();
  const minutesOf = (d: Date) => Math.round((d.getTime() - midnight) / 60_000);

  const ticks: Timeline["ticks"] = [];
  for (let m = axisStart; m <= axisStart + span; m += 60) ticks.push({ label: hhmm(m), left: ((m - axisStart) / span) * 100 });

  const byTable = new Map<string, TimelineBlock[]>();
  for (const o of args.occupancy) {
    const s = minutesOf(o.start);
    const e = minutesOf(o.end);
    const cs = Math.max(s, axisStart);
    const ce = Math.min(e, axisStart + span);
    if (ce <= cs) continue;
    const d = args.details.get(o.reservation_id);
    if (!d || d.status === "cancelled" || d.status === "no_show") continue;
    const list = byTable.get(o.table_id) ?? [];
    list.push({
      reservationId: o.reservation_id,
      left: ((cs - axisStart) / span) * 100,
      width: ((ce - cs) / span) * 100,
      from: hhmm(s),
      to: hhmm(e),
      name: d.name,
      party: d.party,
      type: d.type,
      status: d.status,
    });
    byTable.set(o.table_id, list);
  }

  const order = [...args.areas].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const groups: { id: string | null; name: string }[] = order.map((a) => ({ id: a.id, name: a.name }));
  if (args.tables.some((t) => !t.areaId)) groups.push({ id: null, name: "—" });
  const rooms = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      tables: args.tables
        .filter((t) => (t.areaId ?? null) === g.id)
        .map((t) => ({ id: t.id, label: t.label, capacity: t.capacity, out: t.out, blocks: (byTable.get(t.id) ?? []).sort((a, b) => a.left - b.left) })),
    }))
    .filter((r) => r.tables.length > 0);
  return { start: hhmm(axisStart), end: hhmm(axisStart + span), ticks, rooms };
}
