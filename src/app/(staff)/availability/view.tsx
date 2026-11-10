import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import type { BoardSlot } from "@/lib/domain/availability-board";
import type { CapacityDay, CapacityStatus } from "@/lib/domain/capacity-check";
import type { FloorPlan } from "@/lib/floor-plans";
import { FloorPlanMap, type PlanMarker } from "@/components/floor-plan-map";
import { Card, CardContent, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

export type DayBooking = {
  id: string;
  time: string;
  end: string;
  name: string;
  party: number;
  type: string | null;
  status: string;
  tables: string;
  room: string;
};

export interface AvailabilityViewProps {
  t: (s: string) => string;
  fmt: (d: string, o: Intl.DateTimeFormatOptions) => string;
  typeLabel: (k: string) => string;
  restaurant: { id: string; name: string };
  restaurants: { id: string; name: string }[];
  today: string;
  date: string;
  month: string;
  party: number;
  prevMonth: string;
  nextMonth: string;
  monthEnd: string;
  days: CapacityDay[];
  /** Null when the restaurant is closed on the chosen day. */
  slots: BoardSlot[] | null;
  slot: BoardSlot | undefined;
  plan: FloorPlan | null;
  planMarkers: PlanMarker[];
  bookingsByDay: Record<string, DayBooking[]>;
  canBook: boolean;
  canRequest: boolean;
  canExport: boolean;
  canOpenReservations: boolean;
}

const DAY: Record<CapacityStatus, { label: string; cell: string; dot: string }> = {
  ok: { label: "Available", cell: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100", dot: "bg-emerald-500" },
  full: { label: "Full", cell: "bg-amber-100 text-amber-900 hover:bg-amber-200", dot: "bg-amber-500" },
  over: { label: "Full", cell: "bg-red-100 text-red-800 hover:bg-red-200", dot: "bg-red-500" },
  closed: { label: "Closed", cell: "bg-slate-100 text-slate-400", dot: "bg-slate-300" },
};
const SLOT_CLS = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500",
  busy: "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500",
  full: "border-red-200 bg-red-50 text-red-700",
  past: "border-slate-200 bg-slate-50 text-slate-400",
} as const;
const TYPE_DOT: Record<string, string> = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" };
const RES_STATUS: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", arrived: "Arrived", seated: "Seated", completed: "Completed" };

/**
 * Table availability, kept simple for front-of-house staff:
 * pick a day (left), pick a time (right), see which tables are free and book; below, who is booked that day.
 * Pure view, no data loading.
 */
export function AvailabilityView(p: AvailabilityViewProps) {
  const { t, fmt } = p;
  const q = (over: Record<string, string>) => `/availability?${new URLSearchParams({ restaurant: p.restaurant.id, month: p.month, date: p.date, party: String(p.party), ...over })}`;
  const day = p.days.find((d) => d.date === p.date);
  const bookings = p.bookingsByDay[p.date] ?? [];
  const guests = bookings.reduce((a, b) => a + b.party, 0);
  const firstDow = (new Date(`${p.month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (CapacityDay | null)[] = [...Array(firstDow).fill(null), ...p.days];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(`2026-11-${String(2 + i).padStart(2, "0")}`, { weekday: "narrow" })); // 2 Nov 2026 is a Monday
  const bookHref = (time: string) =>
    p.canBook
      ? `/reservations/new?restaurant=${p.restaurant.id}&date=${p.date}&time=${time}&party=${p.party}`
      : `/requests?restaurant=${p.restaurant.id}&rdate=${p.date}&time=${time}&party=${p.party}`;
  const closed = p.slots === null || !day || day.status === "closed";
  const freeAtSlot = p.planMarkers.filter((m) => m.state === "free");

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t("Table availability")} · ${p.restaurant.name}`}
        description={t("1. Pick a day  2. Pick a time  3. Book a free table")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {p.restaurants.length > 1 ? (
              <AutoSubmitForm className="flex items-center gap-2">
                <input type="hidden" name="month" value={p.month} />
                <Select name="restaurant" defaultValue={p.restaurant.id} className="w-48" aria-label={t("Restaurant")}>
                  {p.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </AutoSubmitForm>
            ) : null}
            {p.canExport ? (
              <Button asChild variant="outline">
                <a href={`/api/export/reservations?${new URLSearchParams({ format: "xlsx", restaurant: p.restaurant.id, from: `${p.month}-01`, to: p.monthEnd })}`}><Download />{" "}{t("Export Excel")}</a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* 1. Pick a day */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-1">
              <Button asChild size="sm" variant="ghost"><Link href={q({ month: p.prevMonth, date: `${p.prevMonth}-01` })} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
              <span className="font-semibold text-slate-900">{fmt(`${p.month}-01`, { month: "long", year: "numeric" })}</span>
              <Button asChild size="sm" variant="ghost"><Link href={q({ month: p.nextMonth, date: `${p.nextMonth}-01` })} aria-label={t("Next month")}><ChevronRight /></Link></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {weekdays.map((w, i) => <span key={i}>{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) =>
                d ? (
                  <Link
                    key={d.date}
                    href={q({ date: d.date })}
                    title={d.status === "closed" ? t("Closed") : `${d.total}/${d.seats} ${t("guests")}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition",
                      DAY[d.status].cell,
                      d.date < p.today && "opacity-50",
                      d.date === p.date && "ring-2 ring-brand-600",
                      d.date === p.today && "underline decoration-2 underline-offset-2",
                    )}
                  >
                    {Number(d.date.slice(8))}
                    <span className="text-[9px] font-normal leading-none">{d.status === "closed" ? t("Closed") : `${d.total}/${d.seats}`}</span>
                  </Link>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className={cn("size-2.5 rounded-full", DAY.ok.dot)} />{t("Available")}</span>
              <span className="flex items-center gap-1"><span className={cn("size-2.5 rounded-full", DAY.full.dot)} />{t("Almost full")}</span>
              <span className="flex items-center gap-1"><span className={cn("size-2.5 rounded-full", DAY.over.dot)} />{t("Full")}</span>
              <span className="flex items-center gap-1"><span className={cn("size-2.5 rounded-full", DAY.closed.dot)} />{t("Closed")}</span>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full"><Link href={q({ month: p.today.slice(0, 7), date: p.today })}>{t("Today")}</Link></Button>
          </CardContent>
        </Card>

        {/* 2. The chosen day: times, free tables, book */}
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-xl font-bold text-slate-900">{fmt(p.date, { weekday: "long", day: "numeric", month: "long" })}</p>
              {day && day.status !== "closed" ? (
                <span className="text-sm text-slate-600">
                  <strong className="text-slate-900">{day.total}</strong>/{day.seats} {t("guests")} · {bookings.length} {t("bookings")}
                </span>
              ) : null}
              <AutoSubmitForm className="ml-auto flex items-center gap-2">
                <input type="hidden" name="restaurant" value={p.restaurant.id} />
                <input type="hidden" name="month" value={p.month} />
                <input type="hidden" name="date" value={p.date} />
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  {t("Party size")}
                  <Input type="number" name="party" min={1} max={200} defaultValue={p.party} className="h-9 w-20 text-center text-base font-semibold" />
                </label>
              </AutoSubmitForm>
            </div>

            {closed ? (
              <p className="rounded-xl bg-slate-100 px-4 py-10 text-center text-lg font-medium text-slate-600">{t("Closed on this day")}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">{t("Pick a time")}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.slots!.map((s) => (
                      <Link key={s.time} href={q({ time: s.time })} className={cn("min-w-[5.5rem] rounded-xl border-2 px-3 py-1.5 text-center transition", SLOT_CLS[s.level], s.time === p.slot?.time && "ring-2 ring-brand-600 ring-offset-1")}>
                        <span className="block text-base font-bold tabular-nums">{s.time}</span>
                        <span className="block text-xs">{s.past ? t("Past") : s.fitsParty ? `${t("Free")} ${s.freeTables} ${t("tables")}` : t("Full")}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {p.slot ? (
                  <div className="space-y-3 rounded-xl border bg-slate-50/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {p.slot.time} · {freeAtSlot.length > 0 ? <span className="text-emerald-700">{t("Free")}: {freeAtSlot.map((m) => m.label).join(", ")}</span> : <span className="text-red-700">{t("No free table")}</span>}
                      </p>
                      {p.slot.level !== "past" && p.slot.fitsParty && (p.canBook || p.canRequest) ? (
                        <Button asChild><Link href={bookHref(p.slot.time)}><Plus />{" "}{p.canBook ? t("Book table") : t("Log a request")} · {p.slot.time}</Link></Button>
                      ) : null}
                    </div>
                    {p.plan && p.planMarkers.length > 0 ? (
                      <div className="mx-auto max-w-3xl">
                        <FloorPlanMap plan={p.plan} markers={p.planMarkers} />
                      </div>
                    ) : null}
                    <p className="flex flex-wrap justify-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-emerald-600 bg-emerald-400/70" />{t("Free")}</span>
                      <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-red-600 bg-red-400/75" />{t("Booked")}</span>
                      <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-slate-500 bg-slate-300/80" />{t("Out of service")}</span>
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Who is booked that day */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="font-semibold text-slate-900">
            {t("Bookings on this day")} <span className="font-normal text-muted">· {bookings.length} {t("bookings")} · {guests} {t("guests")}</span>
          </p>
          {bookings.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted">{t("No bookings yet. Every table is free.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("Time")}</th>
                    <th className="px-3 py-2 font-medium">{t("Guest")}</th>
                    <th className="px-3 py-2 text-center font-medium">{t("Guests")}</th>
                    <th className="px-3 py-2 font-medium">{t("Table")}</th>
                    <th className="px-3 py-2 font-medium">{t("Customer type")}</th>
                    <th className="px-3 py-2 font-medium">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">{b.time}<span className="font-normal text-muted">–{b.end}</span></td>
                      <td className="px-3 py-2">
                        {p.canOpenReservations ? <Link href={`/reservations/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{b.name}</Link> : <span className="font-medium">{b.name}</span>}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{b.party}</td>
                      <td className="px-3 py-2">{b.tables || <span className="text-amber-700">{t("No table yet")}</span>}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", TYPE_DOT[b.type ?? "other"])} />{p.typeLabel(b.type ?? "other")}</span></td>
                      <td className="px-3 py-2 text-slate-700">{t(RES_STATUS[b.status] ?? b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
