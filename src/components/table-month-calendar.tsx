import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TableMonth } from "@/lib/domain/table-month";

const TYPE_BG: Record<string, string> = {
  internal: "border-slate-400 bg-slate-100 text-slate-900",
  kol: "border-purple-400 bg-purple-50 text-purple-900",
  media: "border-sky-400 bg-sky-50 text-sky-900",
  other: "border-amber-400 bg-amber-50 text-amber-900",
};

/** Month calendar of table bookings: each day lists the booked tables, room by room, with time, guest and party size. */
export function TableMonthCalendar({ data, today, selected, closed, dayHref, weekdays, typeLabel, t }: {
  data: TableMonth;
  today: string;
  selected: string;
  closed: Set<string>;
  dayHref: (date: string) => string;
  /** Monday-first weekday labels. */
  weekdays: string[];
  typeLabel: (k: string) => string;
  t: (s: string) => string;
}) {
  const firstDow = (new Date(`${data.days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...data.days];
  while (cells.length % 7) cells.push(null);
  const totalTables = data.rooms.reduce((a, r) => a + r.tables.filter((x) => !x.out).length, 0);
  const MAX_LINES = 6;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-semibold uppercase text-muted">
            {weekdays.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} className="rounded-lg bg-slate-50/50" />;
              const isClosed = closed.has(d);
              const lines = data.rooms.flatMap((room) =>
                room.tables.flatMap((tb) => (tb.days[d] ?? []).map((b) => ({ room: room.name, table: tb.label, ...b }))),
              ).sort((a, b) => a.time.localeCompare(b.time) || a.table.localeCompare(b.table, undefined, { numeric: true }));
              const bookedTables = data.rooms.reduce((a, r) => a + r.tables.filter((x) => (x.days[d] ?? []).length > 0).length, 0);
              const guests = new Map<string, number>();
              for (const l of lines) guests.set(l.id, l.party);
              const pax = [...guests.values()].reduce((a, n) => a + n, 0);
              const free = totalTables - bookedTables;
              return (
                <Link
                  key={d}
                  href={dayHref(d)}
                  className={cn(
                    "flex min-h-36 flex-col gap-1 rounded-lg border p-1.5 text-left transition hover:border-brand-400 hover:shadow-sm",
                    isClosed ? "border-slate-200 bg-slate-100" : free === 0 ? "border-red-200 bg-red-50/60" : bookedTables > 0 ? "bg-white" : "border-emerald-200 bg-emerald-50/50",
                    d < today && "opacity-60",
                    d === selected && "ring-2 ring-brand-500",
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums", d === today ? "bg-brand-600 text-white" : "text-slate-900")}>{Number(d.slice(8))}</span>
                    {isClosed ? (
                      <span className="rounded bg-slate-200 px-1.5 text-[11px] font-medium text-slate-600">{t("Closed")}</span>
                    ) : (
                      <span className={cn("rounded px-1.5 text-[11px] font-semibold tabular-nums", free === 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800")}>
                        {free === 0 ? t("Full") : `${t("Free")} ${free}/${totalTables}`}
                      </span>
                    )}
                  </span>
                  {!isClosed && lines.length ? (
                    <span className="text-[11px] tabular-nums text-muted">{guests.size} {t("bookings")} · {pax} {t("guests")}</span>
                  ) : null}
                  {!isClosed ? (
                    <span className="flex flex-col gap-0.5">
                      {lines.slice(0, MAX_LINES).map((l) => (
                        <span key={l.id + l.table} title={`${l.time} ${l.table} · ${l.name} · ${l.party} · ${typeLabel(l.type ?? "other")}`} className={cn("flex items-center gap-1 truncate rounded border-l-[3px] px-1 text-[11px] leading-4", TYPE_BG[l.type ?? "other"] ?? TYPE_BG.other)}>
                          <span className="font-semibold tabular-nums">{l.time}</span>
                          <span className="truncate">{l.table}</span>
                          <span className="ml-auto tabular-nums">{l.party}</span>
                        </span>
                      ))}
                      {lines.length > MAX_LINES ? <span className="text-[11px] font-medium text-brand-700">+{lines.length - MAX_LINES} {t("more")}</span> : null}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
        {(["internal", "kol", "media", "other"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1"><span className={cn("size-3 rounded border-l-[3px]", TYPE_BG[k])} />{typeLabel(k)}</span>
        ))}
        <span className="flex items-center gap-1"><span className="size-3 rounded border border-emerald-200 bg-emerald-50" />{t("Free all day")}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded border border-red-200 bg-red-50" />{t("Full")}</span>
        <span>· {t("Click a day to see times")}</span>
      </p>
    </div>
  );
}
