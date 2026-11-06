"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveHoursAction } from "../actions";

type Row = { day_of_week: number | null; specific_date: string | null; service_name: string; open_time: string | null; close_time: string | null; last_seating_time: string | null; is_closed: boolean };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const t5 = (t: string | null) => (t ? t.slice(0, 5) : null);

export function HoursEditor({ restaurantId, initial, readOnly }: { restaurantId: string; initial: Row[]; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ...r, open_time: t5(r.open_time), close_time: t5(r.close_time), last_seating_time: t5(r.last_seating_time) })));
  const [pending, start] = useTransition();
  const router = useRouter();
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const weekly = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.day_of_week !== null).sort((a, b) => a.r.day_of_week! - b.r.day_of_week! || (a.r.open_time ?? "").localeCompare(b.r.open_time ?? ""));
  const special = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.specific_date !== null);

  // ---- Lunch / Dinner planner: set each service's times once, then tick the days it runs. ----
  type Svc = { open: string; close: string; last: string };
  const find = (name: string) => rows.find((r) => r.day_of_week !== null && !r.is_closed && r.service_name.toLowerCase().includes(name));
  const fromRow = (r: Row | undefined, d: Svc): Svc => (r ? { open: r.open_time ?? d.open, close: r.close_time ?? d.close, last: r.last_seating_time ?? d.last } : d);
  const [lunch, setLunch] = useState<Svc>(() => fromRow(find("lunch"), { open: "11:30", close: "14:30", last: "13:45" }));
  const [dinner, setDinner] = useState<Svc>(() => fromRow(find("dinner"), { open: "17:30", close: "22:30", last: "21:00" }));
  const daysWith = (name: string) => DAYS.map((_, d) => rows.some((r) => r.day_of_week === d && !r.is_closed && r.service_name.toLowerCase().includes(name)));
  const [lunchDays, setLunchDays] = useState<boolean[]>(() => daysWith("lunch"));
  const [dinnerDays, setDinnerDays] = useState<boolean[]>(() => daysWith("dinner"));
  const applyPlan = () => {
    const weeklyRows: Row[] = [];
    DAYS.forEach((_, d) => {
      if (lunchDays[d]) weeklyRows.push({ day_of_week: d, specific_date: null, service_name: "Lunch", open_time: lunch.open, close_time: lunch.close, last_seating_time: lunch.last || null, is_closed: false });
      if (dinnerDays[d]) weeklyRows.push({ day_of_week: d, specific_date: null, service_name: "Dinner", open_time: dinner.open, close_time: dinner.close, last_seating_time: dinner.last || null, is_closed: false });
      if (!lunchDays[d] && !dinnerDays[d]) weeklyRows.push({ day_of_week: d, specific_date: null, service_name: "Closed", open_time: null, close_time: null, last_seating_time: null, is_closed: true });
    });
    setRows([...weeklyRows, ...rows.filter((r) => r.specific_date !== null)]);
    toast.message("Weekly hours updated below. Press Save opening hours to apply.");
  };
  const svcRow = (label: string, s: Svc, set: (s: Svc) => void, days: boolean[], setDays: (d: boolean[]) => void) => (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="w-16 font-medium">{label}</span>
      <Input type="time" className="h-8 w-28" value={s.open} onChange={(e) => set({ ...s, open: e.target.value })} aria-label={`${label} opens`} />
      –
      <Input type="time" className="h-8 w-28" value={s.close} onChange={(e) => set({ ...s, close: e.target.value })} aria-label={`${label} closes`} />
      <span className="text-xs text-muted">last seating</span>
      <Input type="time" className="h-8 w-28" value={s.last} onChange={(e) => set({ ...s, last: e.target.value })} aria-label={`${label} last seating`} />
      <div className="flex flex-wrap gap-1">
        {DAYS.map((d, i) => (
          <label key={d} className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs ${days[i] ? "border-brand-500 bg-brand-50 text-brand-800" : "bg-white text-slate-500"}`}>
            <input type="checkbox" className="sr-only" checked={days[i]} onChange={(e) => setDays(days.map((v, j) => (j === i ? e.target.checked : v)))} />
            {d}
          </label>
        ))}
      </div>
    </div>
  );

  const line = ({ r, i }: { r: Row; i: number }) => (
    <div key={i} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
      <span className="w-24 font-medium">{r.day_of_week !== null ? DAYS[r.day_of_week] : <Input type="date" className="h-8 w-36" value={r.specific_date ?? ""} onChange={(e) => upd(i, { specific_date: e.target.value })} />}</span>
      <Input className="h-8 w-28" value={r.service_name} onChange={(e) => upd(i, { service_name: e.target.value })} aria-label="Service" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.is_closed} onChange={(e) => upd(i, { is_closed: e.target.checked })} /> Closed</label>
      {!r.is_closed ? (
        <>
          <Input type="time" className="h-8 w-28" value={r.open_time ?? ""} onChange={(e) => upd(i, { open_time: e.target.value })} aria-label="Opens" />
          –
          <Input type="time" className="h-8 w-28" value={r.close_time ?? ""} onChange={(e) => upd(i, { close_time: e.target.value })} aria-label="Closes" />
          <span className="text-xs text-muted">last seating</span>
          <Input type="time" className="h-8 w-28" value={r.last_seating_time ?? ""} onChange={(e) => upd(i, { last_seating_time: e.target.value || null })} aria-label="Last seating" />
        </>
      ) : null}
      {!readOnly ? <button className="ml-auto p-1 text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="size-4" /></button> : null}
    </div>
  );

  return (
    <fieldset disabled={readOnly || pending} className="space-y-4">
      <div className="rounded-lg border bg-slate-50 p-3">
        <h4 className="text-sm font-semibold">Lunch & Dinner</h4>
        <p className="text-xs text-muted">Set the times for each service and tick the days it runs. Days with neither are closed.</p>
        {svcRow("Lunch", lunch, setLunch, lunchDays, setLunchDays)}
        {svcRow("Dinner", dinner, setDinner, dinnerDays, setDinnerDays)}
        {!readOnly ? <Button type="button" size="sm" variant="outline" onClick={applyPlan}>Apply to weekly hours</Button> : null}
      </div>
      <div>
        <h4 className="text-sm font-semibold">Weekly services (detail)</h4>
        {weekly.map(line)}
        {!readOnly ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <Button key={d} size="sm" variant="outline" type="button" onClick={() => setRows([...rows, { day_of_week: i, specific_date: null, service_name: "Dinner", open_time: "17:30", close_time: "22:30", last_seating_time: "21:00", is_closed: false }])}>
                <Plus /> {d}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <h4 className="text-sm font-semibold">Date overrides (holidays, events)</h4>
        <p className="text-xs text-muted">An override replaces the weekly hours for that date.</p>
        {special.map(line)}
        {!readOnly ? (
          <Button className="mt-2" size="sm" variant="outline" type="button" onClick={() => setRows([...rows, { day_of_week: null, specific_date: new Date().toISOString().slice(0, 10), service_name: "Closed", open_time: null, close_time: null, last_seating_time: null, is_closed: true }])}>
            <Plus /> Add date override
          </Button>
        ) : null}
      </div>
      {!readOnly ? (
        <Button
          onClick={() =>
            start(async () => {
              const res = await saveHoursAction(restaurantId, rows);
              if (res.ok) { toast.success("Opening hours saved"); router.refresh(); } else toast.error(res.error);
            })
          }
        >
          Save opening hours
        </Button>
      ) : null}
    </fieldset>
  );
}
