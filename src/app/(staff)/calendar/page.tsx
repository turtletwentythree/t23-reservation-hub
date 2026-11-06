import Link from "next/link";
import { getStaffT } from "@/lib/i18n/staff-server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addDays, pickParam, todayIn } from "@/lib/data/common";
import { dayOfWeek } from "@/lib/domain/availability";
import { STATUS_META } from "@/lib/domain/status";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendar" };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.view", "calendar");
  const sp = await searchParams;
  const view = (pickParam(sp.view) ?? "month") as "month" | "week" | "day";
  const today = todayIn();
  const anchor = pickParam(sp.date) ?? today;
  const supabase = await createClient();
  const names = new Map(ctx.restaurants.map((r) => [r.id, r.name]));

  let start: string, end: string, prev: string, next: string, title: string;
  if (view === "month") {
    const first = anchor.slice(0, 8) + "01";
    start = addDays(first, -dayOfWeek(first));
    const [y, m] = first.split("-").map(Number);
    const nextFirst = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const lastDay = addDays(nextFirst, -1);
    end = addDays(lastDay, 6 - dayOfWeek(lastDay));
    prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    next = nextFirst;
    title = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } else if (view === "week") {
    start = addDays(anchor, -dayOfWeek(anchor));
    end = addDays(start, 6);
    prev = addDays(start, -7);
    next = addDays(start, 7);
    title = `${start} → ${end}`;
  } else {
    start = end = anchor;
    prev = addDays(anchor, -1);
    next = addDays(anchor, 1);
    title = anchor;
  }

  const { data } = await supabase
    .from("reservations")
    .select("id, restaurant_id, reservation_date, reservation_time, customer_name, party_size, status, duration_minutes, reservation_tables(tables(label))")
    .in("restaurant_id", ctx.branchIds)
    .gte("reservation_date", start)
    .lte("reservation_date", end)
    .order("reservation_time")
    .limit(5000);
  const rows = data ?? [];
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) byDay.set(r.reservation_date, [...(byDay.get(r.reservation_date) ?? []), r]);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const link = (v: string, d: string) => `/calendar?view=${v}&date=${d}`;

  return (
    <div>
      <PageHeader
        title={t("Calendar")}
        description={ctx.selectedBranch === "all" ? t("All branches") : names.get(ctx.selectedBranch)}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-white p-0.5">
              {(["month", "week", "day"] as const).map((v) => (
                <Link key={v} href={link(v, anchor)} className={cn("rounded-md px-3 py-1 text-sm capitalize", view === v ? "bg-brand-500 text-white" : "text-slate-600")}>{v}</Link>
              ))}
            </div>
            <Button asChild variant="outline" size="icon"><Link href={link(view, prev)} aria-label={t("Previous")}><ChevronLeft /></Link></Button>
            <Button asChild variant="outline"><Link href={link(view, today)}>{t("Today")}</Link></Button>
            <Button asChild variant="outline" size="icon"><Link href={link(view, next)} aria-label={t("Next")}><ChevronRight /></Link></Button>
          </div>
        }
      />
      <h2 className="mb-3 font-semibold">{title}</h2>

      {view === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-white">
          {DOW.map((d) => <div key={d} className="border-b bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-500">{d}</div>)}
          {days.map((d) => {
            const list = (byDay.get(d) ?? []).filter((r) => r.status !== "cancelled" && r.status !== "no_show");
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <Link key={d} href={link("day", d)} className={cn("min-h-24 border-b border-r p-1.5 hover:bg-brand-50", !inMonth && "bg-slate-50/70 text-slate-400")}>
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", d === today && "bg-accent-500 font-bold text-white")}>{Number(d.slice(8))}</span>
                {list.length ? (
                  <div className="mt-1 space-y-0.5 text-xs">
                    <p className="font-semibold text-brand-700">{list.length} bookings</p>
                    <p className="text-muted">{list.reduce((a, r) => a + r.party_size, 0)} covers</p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : view === "week" ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => (
            <Card key={d} className="min-h-40 p-2">
              <Link href={link("day", d)} className={cn("mb-2 block text-sm font-semibold", d === today && "text-accent-600")}>{DOW[dayOfWeek(d)]} {d.slice(5)}</Link>
              <div className="space-y-1">
                {(byDay.get(d) ?? []).map((r) => (
                  <Link key={r.id} href={`/reservations/${r.id}`} className="block rounded border-l-4 bg-slate-50 px-1.5 py-1 text-xs hover:bg-slate-100" style={{ borderColor: STATUS_META[r.status].color }}>
                    <span className="font-semibold">{r.reservation_time.slice(0, 5)}</span> {r.customer_name} ({r.party_size})
                    {ctx.branchIds.length > 1 ? <span className="block text-muted">{names.get(r.restaurant_id)}</span> : null}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DayTimeline rows={rows} names={names} multi={ctx.branchIds.length > 1} />
      )}
    </div>
  );
}

async function DayTimeline({ rows, names, multi }: { rows: { id: string; restaurant_id: string; reservation_time: string; customer_name: string; party_size: number; status: keyof typeof STATUS_META; duration_minutes: number; reservation_tables: { tables: { label: string } | null }[] }[]; names: Map<string, string>; multi: boolean }) {
  const { t } = await getStaffT();
  const startH = 10, endH = 24, span = (endH - startH) * 60;
  const lanes = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${multi ? names.get(r.restaurant_id) + " · " : ""}${r.reservation_tables.map((t) => t.tables?.label).join("+") || "Unassigned"}`;
    lanes.set(key, [...(lanes.get(key) ?? []), r]);
  }
  const sorted = [...lanes.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <div className="min-w-[900px]">
        <div className="flex border-b text-xs text-muted">
          <div className="w-40 shrink-0 px-2 py-1">{t("Table")}</div>
          <div className="relative flex-1">
            {Array.from({ length: endH - startH }, (_, i) => <span key={i} className="absolute top-1" style={{ left: `${(i * 60 / span) * 100}%` }}>{startH + i}:00</span>)}
            &nbsp;
          </div>
        </div>
        {sorted.length === 0 ? <p className="p-6 text-center text-sm text-muted">{t("No bookings this day.")}</p> : null}
        {sorted.map(([lane, list]) => (
          <div key={lane} className="flex border-b">
            <div className="w-40 shrink-0 truncate px-2 py-2 text-xs font-medium">{lane}</div>
            <div className="relative h-10 flex-1">
              {list.map((r) => {
                const [h, m] = r.reservation_time.split(":").map(Number);
                const left = ((h * 60 + m - startH * 60) / span) * 100;
                const width = (r.duration_minutes / span) * 100;
                return (
                  <Link key={r.id} href={`/reservations/${r.id}`} title={`${r.reservation_time.slice(0, 5)} ${r.customer_name}`}
                    className={cn("absolute top-1 h-8 truncate rounded px-1.5 text-[11px] leading-8 text-white", (r.status === "cancelled" || r.status === "no_show") && "opacity-40 line-through")}
                    style={{ left: `${Math.max(0, left)}%`, width: `${width}%`, background: STATUS_META[r.status].color }}>
                    {r.reservation_time.slice(0, 5)} {r.customer_name} ({r.party_size})
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
