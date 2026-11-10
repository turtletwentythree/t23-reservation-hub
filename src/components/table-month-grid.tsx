import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TableMonth } from "@/lib/domain/table-month";

const TYPE_DOT: Record<string, string> = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-500" };
const level = (n: number) =>
  n === 0 ? "bg-emerald-50 text-emerald-700/50 hover:bg-emerald-100" : n === 1 ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : n === 2 ? "bg-orange-200 text-orange-950 hover:bg-orange-300" : "bg-red-300 text-red-950 hover:bg-red-400";

/** Tables down the side, days across the top: how many bookings each table has on each day. */
export function TableMonthGrid({ data, today, selected, closed, dayHref, weekday, t }: {
  data: TableMonth;
  today: string;
  selected: string;
  closed: Set<string>;
  dayHref: (date: string) => string;
  /** Short weekday label for a date. */
  weekday: (date: string) => string;
  t: (s: string) => string;
}) {
  const isWeekend = (d: string) => {
    const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    return w === 0 || w === 6;
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 min-w-32 border-b border-r bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-700">{t("Table")}</th>
              {data.days.map((d) => (
                <th key={d} className={cn("min-w-9 border-b px-0.5 py-1 text-center font-normal", isWeekend(d) && "bg-slate-100", d === selected && "bg-brand-100")}>
                  <Link href={dayHref(d)} className="block hover:underline">
                    <span className="block text-[10px] text-muted">{weekday(d)}</span>
                    <span className={cn("mx-auto flex size-6 items-center justify-center rounded-full font-semibold tabular-nums text-slate-800", d === today && "bg-brand-600 text-white")}>{Number(d.slice(8))}</span>
                  </Link>
                </th>
              ))}
              <th className="border-b border-l px-2 text-center font-semibold text-slate-700">{t("Total")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((room) => (
              <RoomRows key={room.id ?? "none"} room={room} data={data} closed={closed} selected={selected} dayHref={dayHref} isWeekend={isWeekend} t={t} />
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="sticky left-0 z-10 border-r border-t bg-slate-50 px-2 py-1.5 text-slate-700">{t("Bookings")}</td>
              {data.days.map((d) => (
                <td key={d} className="border-t text-center tabular-nums text-slate-700">{closed.has(d) ? "" : data.perDay[d] ?? ""}</td>
              ))}
              <td className="border-l border-t text-center tabular-nums">{Object.values(data.perDay).reduce((a, n) => a + n, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />{t("Free all day")}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-amber-100" />1 {t("booking")}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-orange-200" />2</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-red-300" />3+</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-slate-200" />{t("Closed")}</span>
        <span>· {t("Click a day to see times")}</span>
      </p>
    </div>
  );
}

function RoomRows({ room, data, closed, selected, dayHref, isWeekend, t }: {
  room: TableMonth["rooms"][number];
  data: TableMonth;
  closed: Set<string>;
  selected: string;
  dayHref: (date: string) => string;
  isWeekend: (d: string) => boolean;
  t: (s: string) => string;
}) {
  return (
    <>
      <tr>
        <td colSpan={data.days.length + 2} className="sticky left-0 border-t bg-white px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-800">{room.name}</td>
      </tr>
      {room.tables.map((tb) => (
        <tr key={tb.id}>
          <td className={cn("sticky left-0 z-10 border-r bg-white px-2 py-1", tb.out && "text-slate-400 line-through")}>
            <span className="font-medium text-slate-800">{tb.label}</span> <span className="text-muted">· {tb.capacity} {t("seats")}</span>
          </td>
          {data.days.map((d) => {
            const list = tb.days[d] ?? [];
            if (closed.has(d) || tb.out) return <td key={d} className="border border-white bg-slate-200" />;
            const tip = list.length ? list.map((b) => `${b.time} ${b.name} · ${b.party}`).join("\n") : t("Free");
            return (
              <td key={d} className={cn("h-9 border border-white p-0 text-center", d === selected && "ring-2 ring-inset ring-brand-500", isWeekend(d) && list.length === 0 && "bg-slate-50")}>
                <Link href={dayHref(d)} title={tip} className={cn("flex h-full min-h-9 flex-col items-center justify-center gap-0.5", level(list.length))}>
                  {list.length ? (
                    <>
                      <span className="font-semibold tabular-nums leading-none">{list.length}</span>
                      <span className="flex gap-0.5">
                        {list.slice(0, 3).map((b) => <span key={b.id + b.time} className={cn("size-1.5 rounded-full", TYPE_DOT[b.type ?? "other"] ?? TYPE_DOT.other)} />)}
                      </span>
                    </>
                  ) : null}
                </Link>
              </td>
            );
          })}
          <td className="border-l text-center font-semibold tabular-nums text-slate-700">{tb.total || ""}</td>
        </tr>
      ))}
    </>
  );
}
