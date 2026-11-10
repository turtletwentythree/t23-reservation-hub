import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Timeline } from "@/lib/domain/table-timeline";

const BLOCK: Record<string, string> = {
  internal: "border-slate-400 bg-slate-200 text-slate-900",
  kol: "border-purple-400 bg-purple-100 text-purple-900",
  media: "border-sky-400 bg-sky-100 text-sky-900",
  other: "border-amber-400 bg-amber-100 text-amber-900",
};

/** Table-by-time schedule: booked blocks (who, how many, when) and the free gaps between them, grouped by room. */
export function TableTimeline({ timeline, typeLabel, t, linkTo, nowLeft }: {
  timeline: Timeline;
  /** Position of "now" on the axis in percent, when the day shown is today. */
  nowLeft?: number | null;
  typeLabel: (k: string) => string;
  t: (s: string) => string;
  /** Build a link for a booking, or null when the viewer cannot open reservations. */
  linkTo: ((reservationId: string) => string) | null;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[48rem] space-y-4">
          <div className="sticky top-0 z-10 grid grid-cols-[9rem_1fr] gap-2 bg-white pb-1">
            <span />
            <div className="relative h-5 text-xs font-medium tabular-nums text-slate-600">
              {timeline.ticks.map((k, i) => (
                <span key={k.label} className={cn("absolute", i === timeline.ticks.length - 1 ? "-translate-x-full" : i === 0 ? "" : "-translate-x-1/2")} style={{ left: `${k.left}%` }}>{k.label}</span>
              ))}
            </div>
          </div>
          {timeline.rooms.map((room) => (
            <div key={room.id ?? "none"} className="space-y-1.5 rounded-lg border bg-slate-50/50 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">{room.name}</p>
              {room.tables.map((tb) => (
                <div key={tb.id} className="grid grid-cols-[9rem_1fr] items-center gap-2">
                  <div className={cn("min-w-0", tb.out && "text-slate-400 line-through")}>
                    <p className="truncate text-sm font-medium text-slate-900">{tb.label}</p>
                    <p className="text-[11px] text-muted">{tb.capacity} {t("seats")} · {tb.out ? t("Out of service") : tb.blocks.length ? `${tb.blocks.length} ${t("booking")}` : t("Free all day")}</p>
                  </div>
                  <div className={cn("relative h-12 rounded-md border", tb.out ? "bg-slate-100" : "border-emerald-200 bg-emerald-50")}>
                    {timeline.ticks.map((k) => (
                      <span key={k.label} className="absolute inset-y-0 w-px bg-emerald-200/70" style={{ left: `${k.left}%` }} />
                    ))}
                    {nowLeft != null ? <span className="absolute -inset-y-1 z-[1] w-0.5 bg-red-500" style={{ left: `${nowLeft}%` }} title={t("Now")} /> : null}
                    {tb.blocks.map((b) => {
                      const cls = cn("absolute inset-y-0.5 overflow-hidden flex flex-col justify-center rounded border-l-4 px-1.5 text-xs leading-tight shadow-xs", BLOCK[b.type ?? "other"] ?? BLOCK.other);
                      const inner = (
                        <>
                          <span className="block truncate font-semibold">{b.name} · {b.party}</span>
                          <span className="block truncate tabular-nums">{b.from}–{b.to}{b.type ? ` · ${typeLabel(b.type)}` : ""}</span>
                        </>
                      );
                      const style = { left: `${b.left}%`, width: `${b.width}%` };
                      return linkTo ? (
                        <Link key={b.reservationId + b.from} href={linkTo(b.reservationId)} className={cn(cls, "hover:ring-2 hover:ring-brand-400")} style={style} title={`${b.name} · ${b.party} · ${b.from}–${b.to}`}>{inner}</Link>
                      ) : (
                        <span key={b.reservationId + b.from} className={cls} style={style} title={`${b.name} · ${b.party} · ${b.from}–${b.to}`}>{inner}</span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="size-3 rounded border border-emerald-200 bg-emerald-50" />{t("Free")}</span>
        {(["internal", "kol", "media", "other"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1"><span className={cn("size-3 rounded border", BLOCK[k])} />{typeLabel(k)}</span>
        ))}
        {nowLeft != null ? <span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-red-500" />{t("Now")}</span> : null}
      </p>
    </div>
  );
}
