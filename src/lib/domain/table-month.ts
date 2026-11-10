/** Per-table month grid: which days each table is booked, and by whom. Pure and framework-free. */

export interface MonthBooking {
  id: string;
  time: string;
  name: string;
  party: number;
  type: string | null;
}

export interface MonthTable {
  id: string;
  label: string;
  capacity: number;
  out: boolean;
  /** Bookings by date (YYYY-MM-DD), sorted by time. */
  days: Record<string, MonthBooking[]>;
  total: number;
}

export interface MonthRoom {
  id: string | null;
  name: string;
  tables: MonthTable[];
}

export interface TableMonth {
  days: string[];
  rooms: MonthRoom[];
  /** Bookings with a table, per date. */
  perDay: Record<string, number>;
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function buildTableMonth(args: {
  month: string;
  tables: { id: string; label: string; capacity: number; areaId: string | null; out: boolean }[];
  areas: { id: string; name: string; sort_order: number }[];
  bookings: { id: string; date: string; time: string; name: string; party: number; type: string | null; status: string; tableIds: string[] }[];
}): TableMonth {
  const days = daysOfMonth(args.month);
  const inMonth = new Set(days);
  const byTable = new Map<string, Record<string, MonthBooking[]>>();
  const perDay: Record<string, number> = {};
  for (const b of args.bookings) {
    if (!inMonth.has(b.date) || b.status === "cancelled" || b.status === "no_show" || b.tableIds.length === 0) continue;
    perDay[b.date] = (perDay[b.date] ?? 0) + 1;
    for (const tid of b.tableIds) {
      const rec = byTable.get(tid) ?? {};
      (rec[b.date] ??= []).push({ id: b.id, time: b.time.slice(0, 5), name: b.name, party: b.party, type: b.type });
      byTable.set(tid, rec);
    }
  }
  for (const rec of byTable.values()) for (const k of Object.keys(rec)) rec[k].sort((a, b) => a.time.localeCompare(b.time));

  const order = [...args.areas].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const groups: { id: string | null; name: string }[] = order.map((a) => ({ id: a.id, name: a.name }));
  if (args.tables.some((t) => !t.areaId)) groups.push({ id: null, name: "—" });
  const rooms = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      tables: args.tables
        .filter((t) => (t.areaId ?? null) === g.id)
        .map((t) => {
          const rec = byTable.get(t.id) ?? {};
          return { id: t.id, label: t.label, capacity: t.capacity, out: t.out, days: rec, total: Object.values(rec).reduce((a, l) => a + l.length, 0) };
        }),
    }))
    .filter((r) => r.tables.length > 0);
  return { days, rooms, perDay };
}
