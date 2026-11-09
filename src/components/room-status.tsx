import { cn } from "@/lib/utils";
import type { RoomSummary } from "@/lib/domain/availability-board";

const STATE = {
  free: "border-emerald-300 bg-emerald-50 text-emerald-800",
  booked: "border-red-300 bg-red-50 text-red-700",
  out: "border-slate-200 bg-slate-100 text-slate-400 line-through",
} as const;

/** Per-room tables: how many exist, how many are free and how many are already booked. */
export function RoomStatus({ rooms, t }: { rooms: RoomSummary[]; t: (s: string) => string }) {
  if (rooms.length === 0) return <p className="py-3 text-center text-sm text-muted">{t("No tables set up yet.")}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((r) => (
        <div key={r.id ?? "none"} className="rounded-xl border bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{r.name}</p>
              <p className="text-xs text-muted">{r.total} {t("tables")} · {r.seats} {t("seats")}</p>
            </div>
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", r.total > 0 && r.free === 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800")}>
              {r.free}/{r.total} {t("free")}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-lg bg-emerald-50 py-1.5"><p className="text-lg font-semibold tabular-nums text-emerald-800">{r.free}</p><p className="text-[11px] text-muted">{t("Free tables")} · {r.freeSeats} {t("seats")}</p></div>
            <div className="rounded-lg bg-red-50 py-1.5"><p className="text-lg font-semibold tabular-nums text-red-700">{r.booked}</p><p className="text-[11px] text-muted">{t("Booked tables")}</p></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.tables.map((x) => (
              <span key={x.id} className={cn("rounded-md border px-2 py-0.5 text-xs tabular-nums", STATE[x.state])}>{x.label} · {x.capacity}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
