"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/components/staff-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveCapacityAction } from "./actions";

type Day = { day: string; booked: number; waiting: number; capacity: number | null; note: string; closed: boolean };

const num = (s: string): number | null => (s.trim() === "" ? null : Math.max(0, Math.min(5000, Math.round(Number(s)) || 0)));

export function CapacityEditor({ restaurantId, month, today, locale, tableSeats, defaultCapacity, days, zones, zoneDays, tableList }: {
  restaurantId: string;
  month: string;
  today: string;
  locale: string;
  tableSeats: number;
  defaultCapacity: number | null;
  days: Day[];
  tableList: { id: string; label: string; zone: string; seats: number }[];
  zones: { id: string; name: string; defaultCapacity: number | null; tableSeats: number }[];
  zoneDays: { day: string; cells: Record<string, { value: number | null; booked: number }> }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [def, setDef] = useState(defaultCapacity === null ? "" : String(defaultCapacity));
  const [rows, setRows] = useState(days.map((d) => ({ ...d, value: d.capacity === null ? "" : String(d.capacity) })));
  const [fill, setFill] = useState("");
  const [tseats, setTseats] = useState<Record<string, string>>(Object.fromEntries(tableList.map((x) => [x.id, String(x.seats)])));
  const tableDirty = tableList.some((x) => tseats[x.id] !== String(x.seats));
  const closedNow = (r: { closed: boolean }) => r.closed;
  const str = (n: number | null) => (n === null ? "" : String(n));
  const [zdef, setZdef] = useState<Record<string, string>>(Object.fromEntries(zones.map((z) => [z.id, str(z.defaultCapacity)])));
  const [zval, setZval] = useState<Record<string, string>>(
    Object.fromEntries(zoneDays.flatMap((d) => zones.map((z) => [`${z.id}|${d.day}`, str(d.cells[z.id]?.value ?? null)]))),
  );
  const [activeZone, setActiveZone] = useState(zones[0]?.id ?? "");
  const [zfill, setZfill] = useState("");
  const az = zones.find((z) => z.id === activeZone) ?? zones[0];
  const zoneDirty =
    zones.some((z) => zdef[z.id] !== str(z.defaultCapacity)) ||
    zoneDays.some((d) => zones.some((z) => zval[`${z.id}|${d.day}`] !== str(d.cells[z.id]?.value ?? null)));
  const base = num(def) ?? tableSeats;
  const dirty = def !== (defaultCapacity === null ? "" : String(defaultCapacity)) || rows.some((r, i) => r.value !== (days[i].capacity === null ? "" : String(days[i].capacity)) || r.note !== days[i].note || r.closed !== days[i].closed) || zoneDirty || tableDirty;

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () =>
    start(async () => {
      const res = await saveCapacityAction({
        restaurant_id: restaurantId,
        month,
        default_capacity: num(def),
        days: rows.map((r) => ({ day: r.day, capacity: num(r.value), note: r.note.trim() || null })),
        closed_days: rows.filter(closedNow).map((r) => r.day),
        tables: tableDirty ? tableList.filter((x) => tseats[x.id] !== String(x.seats)).map((x) => ({ id: x.id, max_capacity: Math.max(1, num(tseats[x.id] ?? "") ?? x.seats) })) : [],
        zones: zoneDirty ? zones.map((z) => ({ area_id: z.id, default_capacity: num(zdef[z.id] ?? "") })) : [],
        zone_days: !zoneDirty ? [] : zoneDays.flatMap((d) => zones.map((z) => ({ area_id: z.id, day: d.day, capacity: num(zval[`${z.id}|${d.day}`] ?? "") }))),
      });
      if (res.ok) {
        toast.success(t("Saved"));
        router.refresh();
      } else toast.error(t(res.error));
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-700">{t("Guests per day (default)")}</span>
            <Input type="number" min={0} value={def} onChange={(e) => setDef(e.target.value)} placeholder={String(tableSeats)} className="w-32 text-lg font-semibold" />
          </label>
          <p className="max-w-md pb-2 text-xs text-muted">
            {t("Used for every day without its own number. Leave blank to use the table seats")} ({tableSeats}).
          </p>
          <div className="ml-auto flex items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium text-slate-700">{t("Set every day this month to")}</span>
              <Input type="number" min={0} value={fill} onChange={(e) => setFill(e.target.value)} className="w-28" />
            </label>
            <Button type="button" variant="outline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, value: fill })))}>{t("Apply to all")}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {rows.map((r, i) => {
          const cap = num(r.value) ?? base;
          const over = r.booked > cap;
          const full = !over && cap > 0 && r.booked === cap;
          const dt = new Date(`${r.day}T12:00:00Z`);
          return (
            <div
              key={r.day}
              className={cn(
                "rounded-xl border bg-white p-2",
                r.day < today && "opacity-60",
                r.day === today && "ring-2 ring-brand-400",
                r.value !== "" && "border-brand-300 bg-brand-50/40",
                r.closed && "border-red-300 bg-red-50"
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{dt.getUTCDate()}</span>
                <span className="text-[11px] text-muted">{dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
              </div>
              <Input
                type="number"
                min={0}
                value={r.value}
                onChange={(e) => setRow(i, { value: e.target.value })}
                placeholder={String(base)}
                aria-label={`${t("Guests per day")} ${r.day}`}
                className="mt-1 h-8 text-center tabular-nums"
              />
              <label className={cn("mt-1 flex cursor-pointer items-center justify-center gap-1 text-[11px]", r.closed ? "font-semibold text-red-700" : "text-muted")}>
                <input type="checkbox" checked={r.closed} onChange={(e) => setRow(i, { closed: e.target.checked })} />
                {t("Closed")}
              </label>
              <p className={cn("mt-1 text-center text-[11px] tabular-nums", over ? "font-semibold text-red-700" : full ? "text-amber-700" : "text-muted")}>
                {t("Booked")} {r.booked}/{cap}
                {r.waiting ? <span className="text-accent-700"> +{r.waiting}</span> : null}
              </p>
              <input
                value={r.note}
                onChange={(e) => setRow(i, { note: e.target.value })}
                placeholder={t("Remark")}
                maxLength={200}
                className="mt-1 w-full rounded border-0 bg-transparent px-1 text-[11px] text-slate-600 placeholder:text-slate-300 focus:bg-white focus:ring-1 focus:ring-brand-300"
              />
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <p className="font-semibold text-slate-900">{t("Seats per table")}</p>
            <p className="text-xs text-muted">{t("Set how many seats each table has. Blank capacity above uses these seats.")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...new Set(tableList.map((x) => x.zone))].map((zone) => (
              <div key={zone} className="space-y-1.5 rounded-xl border bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{zone}</p>
                {tableList.filter((x) => x.zone === zone).map((x) => (
                  <label key={x.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700">{x.label}</span>
                    <span className="flex items-center gap-1.5">
                      <Input type="number" min={1} max={200} value={tseats[x.id] ?? ""} onChange={(e) => setTseats((m) => ({ ...m, [x.id]: e.target.value }))} className="h-8 w-20 text-center tabular-nums" aria-label={`${x.label} ${t("seats")}`} />
                      <span className="text-xs text-muted">{t("seats")}</span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">{t("Total seats")}: <strong className="tabular-nums text-slate-800">{tableList.reduce((a, x) => a + (num(tseats[x.id] ?? "") ?? x.seats), 0)}</strong></p>
        </CardContent>
      </Card>

      {zones.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div>
              <p className="font-semibold text-slate-900">{t("Guests per zone")}</p>
              <p className="text-xs text-muted">{t("Each zone (room) can have its own limit. Blank = the zone's table seats. 0 = closed.")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {zones.map((z) => (
                <label key={z.id} className="space-y-1">
                  <span className="block text-xs font-medium text-slate-700">{z.name} · {t("default")}</span>
                  <Input type="number" min={0} value={zdef[z.id] ?? ""} onChange={(e) => setZdef((m) => ({ ...m, [z.id]: e.target.value }))} placeholder={String(z.tableSeats)} className="w-32 text-lg font-semibold" />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap rounded-lg border bg-white p-0.5">
                {zones.map((z) => (
                  <button key={z.id} type="button" onClick={() => setActiveZone(z.id)} className={cn("rounded-md px-3 py-1 text-sm", az?.id === z.id ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-slate-100")}>{z.name}</button>
                ))}
              </div>
              {az ? (
                <div className="ml-auto flex items-end gap-2">
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-700">{t("Set every day this month to")}</span>
                    <Input type="number" min={0} value={zfill} onChange={(e) => setZfill(e.target.value)} className="h-9 w-28" />
                  </label>
                  <Button type="button" variant="outline" onClick={() => setZval((m) => ({ ...m, ...Object.fromEntries(zoneDays.map((d) => [`${az.id}|${d.day}`, zfill])) }))}>{t("Apply to all")}</Button>
                </div>
              ) : null}
            </div>
            {az ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {zoneDays.map((d) => {
                  const key = `${az.id}|${d.day}`;
                  const v = zval[key] ?? "";
                  const zbase = num(zdef[az.id] ?? "") ?? az.tableSeats;
                  const capacity = num(v) ?? zbase;
                  const booked = d.cells[az.id]?.booked ?? 0;
                  const over = booked > capacity;
                  const full = !over && capacity > 0 && booked === capacity;
                  const dt = new Date(`${d.day}T12:00:00Z`);
                  return (
                    <div key={d.day} className={cn("rounded-xl border bg-white p-2", d.day < today && "opacity-60", d.day === today && "ring-2 ring-brand-400", v !== "" && "border-brand-300 bg-brand-50/40")}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{dt.getUTCDate()}</span>
                        <span className="text-[11px] text-muted">{dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
                      </div>
                      <Input type="number" min={0} value={v} onChange={(e) => setZval((m) => ({ ...m, [key]: e.target.value }))} placeholder={String(zbase)} aria-label={`${az.name} ${d.day}`} className="mt-1 h-8 text-center tabular-nums" />
                      <p className={cn("mt-1 text-center text-[11px] tabular-nums", over ? "font-semibold text-red-700" : full ? "text-amber-700" : "text-muted")}>{t("Booked")} {booked}/{capacity}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t bg-white/95 px-1 py-3 backdrop-blur">
        <p className="text-xs text-muted">{t("Blank day = default. 0 = closed / not taking bookings.")}</p>
        <Button onClick={save} disabled={pending || !dirty}>{pending ? t("Saving…") : t("Save")}</Button>
      </div>
    </div>
  );
}
