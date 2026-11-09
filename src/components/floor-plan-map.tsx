import { cn } from "@/lib/utils";
import type { FloorPlan } from "@/lib/floor-plans";

export type PlanMarker = {
  id: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  state: "free" | "booked" | "out";
  selected?: boolean;
};

const STATE = {
  free: "border-emerald-600 bg-emerald-400/70 text-emerald-950",
  booked: "border-red-600 bg-red-400/75 text-red-950",
  out: "border-slate-500 bg-slate-300/80 text-slate-600",
} as const;

/** The floor plan picture with a marker on each table. Pass onPick to make free tables clickable (client components only). */
export function FloorPlanMap({ plan, markers, onPick }: { plan: FloorPlan; markers: PlanMarker[]; onPick?: (id: string) => void }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-white" style={{ aspectRatio: `${plan.width} / ${plan.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.src} alt="" className="absolute inset-0 size-full select-none" draggable={false} />
      {markers.map((m) => {
        const cls = cn(
          "absolute flex flex-col items-center justify-center rounded-md border-2 text-center leading-none shadow-sm",
          STATE[m.state],
          m.selected && "ring-4 ring-brand-500 ring-offset-1",
        );
        const style = { left: `${(m.x / plan.width) * 100}%`, top: `${(m.y / plan.height) * 100}%`, width: `${(m.w / plan.width) * 100}%`, height: `${(m.h / plan.height) * 100}%` };
        const inner = (
          <>
            <span className="text-[9px] font-bold sm:text-[11px]">{m.label}</span>
            <span className="text-[8px] sm:text-[10px]">{m.capacity}</span>
          </>
        );
        return onPick && (m.state === "free" || m.selected) ? (
          <button key={m.id} type="button" onClick={() => onPick(m.id)} className={cn(cls, "cursor-pointer hover:brightness-110")} style={style} title={`${m.label} · ${m.capacity}`}>{inner}</button>
        ) : (
          <span key={m.id} className={cls} style={style} title={`${m.label} · ${m.capacity}`}>{inner}</span>
        );
      })}
    </div>
  );
}
