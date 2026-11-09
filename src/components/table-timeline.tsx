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
export function TableTimeline({ timeline, typeLabel, t, linkTo }: {
  timeline: Timeline;
  typeLabel: (k: string) => string;
  t: (s: string) => string;
  /** Build a link for a booking, or null when the viewer cannot open reservations. */
  linkTo: ((reservationId: string) => string) | null;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[44rem] space-y-3">
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <span />
            <div className="relative h-5 text-[11px] tabular-nums text-muted">
              {timeline.ticks.map((k) => (
                <span key={k.label} className="absolute -translate-x-1/2" style={{ left: `${k.left}%` }}>{k.label}</span>
              ))}
            </div>
          </div>
          {timeline.rooms.map((room) => (
            <div key={room.id ?? "none"} className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{room.name}</p>
              {room.tables.map((tb) => (
                <div key={tb.id} className="grid grid-cols-[8rem_1fr] items-center gap-2">
                  <p className={cn("truncate text-xs", tb.out ? "text-slate-400 line-through" : "text-slate-700")}>
                    {tb.label} <span className="text-muted">· {tb.capacity}</span>
                  </p>
                  <div className={cn("relative h-10 rounded-md border", tb.out ? "bg-slate-100" : "border-emerald-200 bg-emerald-50")}>
                    {timeline.ticks.map((k) => (
                      <span key={k.label} className="absolute inset-y-0 w-px bg-emerald-100" style={{ left: `${k.left}%` }} />
                    ))}
                    {tb.blocks.map((b) => {
                      const cls = cn("absolute inset-y-0.5 overflow-hidden rounded border px-1.5 text-[11px] leading-tight", BLOCK[b.type ?? "other"] ?? BLOCK.other);
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
        <span className="flex items-center gap-1"><span className="size-3 rounded border border-slate-400 bg-slate-200" />{t("Booked")}</span>
      </p>
    </div>
  );
}
