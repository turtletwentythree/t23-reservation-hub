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

type Day = { day: string; booked: number; waiting: number; capacity: number | null; note: string };

const num = (s: string): number | null => (s.trim() === "" ? null : Math.max(0, Math.min(5000, Math.round(Number(s)) || 0)));

export function CapacityEditor({ restaurantId, month, today, locale, tableSeats, defaultCapacity, days, zones, zoneDays }: {
  restaurantId: string;
  month: string;
  today: string;
  locale: string;
  tableSeats: number;
  defaultCapacity: number | null;
  days: Day[];
  zones: { id: string; name: string; defaultCapacity: number | null; tableSeats: number }[];
  zoneDays: { day: string; cells: Record<string, { value: number | null; booked: number }> }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [def, setDef] = useState(defaultCapacity === null ? "" : String(defaultCapacity));
  const [rows, setRows] = useState(days.map((d) => ({ ...d, value: d.capacity === null ? "" : String(d.capacity) })));
  const [fill, setFill] = useState("");
  const str = (n: number | null) => (n === null ? "" : String(n));
  const [zdef, setZdef] = useState<Record<string, string>>(Object.fromEntries(zones.map((z) => [z.id, str(z.defaultCapacity)])));
  const [zval, setZval] = useState<Record<string, string>>(
    Object.fromEntries(zoneDays.flatMap((d) => zones.map((z) => [`${z.id}|${d.day}`, str(d.cells[z.id]?.value ?? null)]))),
  );
  const zoneDirty =
    zones.some((z) => zdef[z.id] !== str(z.defaultCapacity)) ||
    zoneDays.some((d) => zones.some((z) => zval[`${z.id}|${d.day}`] !== str(d.cells[z.id]?.value ?? null)));
  const base = num(def) ?? tableSeats;
  const dirty = def !== (defaultCapacity === null ? "" : String(defaultCapacity)) || rows.some((r, i) => r.value !== (days[i].capacity === null ? "" : String(days[i].capacity)) || r.note !== days[i].note) || zoneDirty;

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () =>
    start(async () => {
      const res = await saveCapacityAction({
        restaurant_id: restaurantId,
        month,
        default_capacity: num(def),
        days: rows.map((r) => ({ day: r.day, capacity: num(r.value), note: r.note.trim() || null })),
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
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("Date")}</th>
                    {zones.map((z) => <th key={z.id} className="px-3 py-2 text-left font-medium">{z.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {zoneDays.map((d) => {
                    const dt = new Date(`${d.day}T12:00:00Z`);
                    return (
                      <tr key={d.day} className={cn(d.day < today && "opacity-60", d.day === today && "bg-brand-50/50")}>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-700">
                          {dt.getUTCDate()} <span className="text-xs text-muted">{dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
                        </td>
                        {zones.map((z) => {
                          const v = zval[`${z.id}|${d.day}`] ?? "";
                          const capacity = num(v) ?? num(zdef[z.id] ?? "") ?? z.tableSeats;
                          const booked = d.cells[z.id]?.booked ?? 0;
                          return (
                            <td key={z.id} className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <Input type="number" min={0} value={v} onChange={(e) => setZval((m) => ({ ...m, [`${z.id}|${d.day}`]: e.target.value }))} placeholder={String(num(zdef[z.id] ?? "") ?? z.tableSeats)} aria-label={`${z.name} ${d.day}`} className="h-8 w-20 text-center tabular-nums" />
                                <span className={cn("text-xs tabular-nums", booked > capacity ? "font-semibold text-red-700" : booked === capacity && capacity > 0 ? "text-amber-700" : "text-muted")}>{booked}/{capacity}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
