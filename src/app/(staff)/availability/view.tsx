import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Download, Inbox, Plus, Users, UtensilsCrossed } from "lucide-react";
import type { BoardSlot, RoomSummary } from "@/lib/domain/availability-board";
import type { CapacityDay, CapacityStatus } from "@/lib/domain/capacity-check";
import type { Timeline } from "@/lib/domain/table-timeline";
import type { FloorPlan } from "@/lib/floor-plans";
import { FloorPlanMap, type PlanMarker } from "@/components/floor-plan-map";
import { RoomStatus } from "@/components/room-status";
import { TableTimeline } from "@/components/table-timeline";
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
export type RoomDay = { id: string; name: string; booked: number; total: number };

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
  prevDay: string;
  nextDay: string;
  monthEnd: string;
  days: CapacityDay[];
  /** Null when the restaurant is closed on the chosen day. */
  slots: BoardSlot[] | null;
  slot: BoardSlot | undefined;
  rooms: RoomSummary[];
  zoneGuests: Map<string, { pax: number; cap: number }>;
  plan: FloorPlan | null;
  planMarkers: PlanMarker[];
  timeline: Timeline | null;
  nowLeft: number | null;
  roomDays: Record<string, RoomDay[]>;
  bookingsByDay: Record<string, DayBooking[]>;
  canBook: boolean;
  canRequest: boolean;
  canExport: boolean;
  canOpenReservations: boolean;
}

const STATUS: Record<CapacityStatus, { label: string; cell: string; badge: string; bar: string }> = {
  ok: { label: "Available", cell: "border-emerald-200 bg-white hover:border-emerald-400", badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  full: { label: "Full", cell: "border-amber-300 bg-amber-50/70 hover:border-amber-500", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  over: { label: "Over capacity", cell: "border-red-300 bg-red-50/70 hover:border-red-500", badge: "bg-red-100 text-red-700", bar: "bg-red-500" },
  closed: { label: "Closed", cell: "border-slate-200 bg-slate-100 text-slate-400", badge: "bg-slate-200 text-slate-600", bar: "bg-slate-300" },
};
const TYPE_LINE: Record<string, string> = {
  internal: "border-slate-400 bg-slate-100 text-slate-900",
  kol: "border-purple-400 bg-purple-50 text-purple-900",
  media: "border-sky-400 bg-sky-50 text-sky-900",
  other: "border-amber-400 bg-amber-50 text-amber-900",
};
const TYPE_BADGE: Record<string, string> = {
  internal: "bg-slate-200 text-slate-800",
  kol: "bg-purple-100 text-purple-800",
  media: "bg-sky-100 text-sky-800",
  other: "bg-amber-100 text-amber-800",
};
const TYPE_DOT: Record<string, string> = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" };
const RES_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-800" },
  arrived: { label: "Arrived", cls: "bg-sky-100 text-sky-800" },
  seated: { label: "Seated", cls: "bg-brand-100 text-brand-800" },
  completed: { label: "Completed", cls: "bg-slate-100 text-slate-600" },
};
const SLOT_CLS = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500",
  busy: "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500",
  full: "border-red-300 bg-red-50 text-red-800 hover:border-red-500",
  past: "border-slate-200 bg-slate-50 text-slate-400",
} as const;
const TYPES = ["internal", "kol", "media", "other"] as const;
const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));

/** Table availability for staff: the month at a glance, then everything about the chosen day. Pure view, no data loading. */
export function AvailabilityView(p: AvailabilityViewProps) {
  const { t, fmt } = p;
  const q = (over: Record<string, string>) => `/availability?${new URLSearchParams({ restaurant: p.restaurant.id, month: p.month, date: p.date, party: String(p.party), ...over })}`;
  const day = p.days.find((d) => d.date === p.date);
  const bookings = p.bookingsByDay[p.date] ?? [];
  const firstDow = (new Date(`${p.month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (CapacityDay | null)[] = [...Array(firstDow).fill(null), ...p.days];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(`2026-11-${String(2 + i).padStart(2, "0")}`, { weekday: "short" })); // 2 Nov 2026 is a Monday
  const actionHref = (time: string) =>
    p.canBook
      ? `/reservations/new?restaurant=${p.restaurant.id}&date=${p.date}&time=${time}&party=${p.party}`
      : `/requests?restaurant=${p.restaurant.id}&rdate=${p.date}&time=${time}&party=${p.party}`;
  const atSlot = (b: DayBooking) => p.slot && toMin(b.time) <= toMin(p.slot.time) && toMin(p.slot.time) < toMin(b.end);
  const counts = (list: DayBooking[]) => ({ bookings: list.length, guests: list.reduce((a, b) => a + b.party, 0) });
  const monthTotals = p.days.reduce((a, d) => ({ guests: a.guests + d.total, full: a.full + (d.status === "full" ? 1 : 0), over: a.over + (d.status === "over" ? 1 : 0) }), { guests: 0, full: 0, over: 0 });
  const st = day ? STATUS[day.status] : STATUS.closed;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t("Table availability")} · ${p.restaurant.name}`}
        description={t("Pick a day on the calendar to see free tables, free times and who is booked.")}
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

      {/* 1. Month at a glance */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-5 text-brand-700" />
            <Button asChild size="sm" variant="outline"><Link href={q({ month: p.prevMonth, date: `${p.prevMonth}-01` })} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
            <span className="min-w-40 text-center text-lg font-semibold text-slate-900">{fmt(`${p.month}-01`, { month: "long", year: "numeric" })}</span>
            <Button asChild size="sm" variant="outline"><Link href={q({ month: p.nextMonth, date: `${p.nextMonth}-01` })} aria-label={t("Next month")}><ChevronRight /></Link></Button>
            <Button asChild size="sm" variant="ghost"><Link href={q({ month: p.today.slice(0, 7), date: p.today })}>{t("Today")}</Link></Button>
            <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{t("Guests this month")} <strong className="tabular-nums">{monthTotals.guests}</strong></span>
              <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-800">{t("Full days")} <strong className="tabular-nums">{monthTotals.full}</strong></span>
              <span className="rounded-md bg-red-100 px-2 py-1 font-medium text-red-700">{t("Over capacity")} <strong className="tabular-nums">{monthTotals.over}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[60rem] space-y-1">
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500">
                {weekdays.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const s = STATUS[d.status];
                  const list = p.bookingsByDay[d.date] ?? [];
                  const pct = d.seats > 0 ? Math.min(100, (d.total / d.seats) * 100) : 0;
                  return (
                    <Link
                      key={d.date}
                      href={`${q({ date: d.date })}#day`}
                      className={cn(
                        "flex min-h-44 flex-col gap-1 rounded-xl border p-2 text-left transition hover:shadow-md",
                        s.cell,
                        d.date < p.today && "opacity-55",
                        d.date === p.date && "ring-2 ring-brand-600 ring-offset-1",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums", d.date === p.today ? "bg-brand-600 text-white" : "text-slate-900")}>{Number(d.date.slice(8))}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", s.badge)}>{t(s.label)}</span>
                        {d.waiting ? <span className="ml-auto rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-800" title={t("Guests in requests waiting to be keyed in")}>+{d.waiting}</span> : null}
                      </span>
                      {d.status === "closed" ? (
                        <span className="m-auto text-xs font-medium text-slate-500">{t("Closed")}</span>
                      ) : (
                        <>
                          <span className="flex items-baseline justify-between gap-1 tabular-nums">
                            <span className="text-xs text-slate-600"><strong className="text-base text-slate-900">{d.total}</strong>/{d.seats} {t("guests")}</span>
                            {list.length ? <span className="text-[11px] text-slate-500">{list.length} {t("bookings")}</span> : <span className="text-[11px] text-emerald-700">{t("No bookings")}</span>}
                          </span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                            <span className={cn("block h-full rounded-full", s.bar)} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {(p.roomDays[d.date] ?? []).map((z) => (
                              <span key={z.id} className={cn("rounded px-1.5 text-[10px] font-medium leading-4 tabular-nums", z.total > 0 && z.booked >= z.total ? "bg-red-100 text-red-700" : z.booked > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                                {z.name} {z.total - z.booked}/{z.total}
                              </span>
                            ))}
                          </span>
                          <span className="flex flex-col gap-0.5">
                            {list.slice(0, 4).map((b) => (
                              <span key={b.id} className={cn("flex items-center gap-1 truncate rounded border-l-[3px] px-1 text-[10px] leading-4", TYPE_LINE[b.type ?? "other"])}>
                                <span className="font-semibold tabular-nums">{b.time}</span>
                                <span className="shrink-0">{b.tables || "—"}</span>
                                <span className="ml-auto shrink-0 tabular-nums font-semibold">{b.party}</span>
                              </span>
                            ))}
                            {list.length > 4 ? <span className="text-[10px] font-semibold text-brand-700">+{list.length - 4} {t("more")}</span> : null}
                          </span>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <Legend t={t} typeLabel={p.typeLabel} />
        </CardContent>
      </Card>

      {/* 2. The chosen day */}
      <Card id="day" className="scroll-mt-4 border-brand-200">
        <CardContent className="space-y-5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline"><Link href={`${q({ date: p.prevDay, month: p.prevDay.slice(0, 7) })}#day`} aria-label={t("Previous day")}><ChevronLeft /></Link></Button>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{fmt(p.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <Button asChild size="sm" variant="outline"><Link href={`${q({ date: p.nextDay, month: p.nextDay.slice(0, 7) })}#day`} aria-label={t("Next day")}><ChevronRight /></Link></Button>
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", st.badge)}>{t(st.label)}</span>
            <AutoSubmitForm className="ml-auto flex items-center gap-2">
              <input type="hidden" name="restaurant" value={p.restaurant.id} />
              <input type="hidden" name="month" value={p.month} />
              <input type="hidden" name="date" value={p.date} />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Users className="size-4" />
                {t("Party size")}
                <Input type="number" name="party" min={1} max={200} defaultValue={p.party} className="h-9 w-20 text-center text-base font-semibold" />
              </label>
            </AutoSubmitForm>
          </div>

          {/* Key numbers */}
          {day && day.status !== "closed" ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat icon={<Users className="size-4" />} label={t("Guests booked")} value={`${day.total}`} sub={`${t("of")} ${day.seats} · ${t("Seats left")} ${Math.max(0, day.left)}`} tone={day.status === "ok" ? "green" : day.status === "full" ? "amber" : "red"} bar={day.seats ? day.total / day.seats : 0} />
              <Stat icon={<CalendarDays className="size-4" />} label={t("Bookings")} value={`${counts(bookings).bookings}`} sub={TYPES.filter((k) => day.pax[k]).map((k) => `${p.typeLabel(k)} ${day.pax[k]}`).join(" · ") || t("No bookings")} />
              <Stat icon={<UtensilsCrossed className="size-4" />} label={p.slot ? `${t("Free tables at")} ${p.slot.time}` : t("Free tables")} value={p.slot ? `${p.slot.freeTables}` : "–"} sub={p.slot ? `${t("of")} ${p.slot.totalTables} ${t("tables")}` : ""} tone={!p.slot ? undefined : p.slot.freeTables === 0 ? "red" : p.slot.level === "busy" ? "amber" : "green"} />
              <Stat icon={<Clock className="size-4" />} label={t("Times still open")} value={`${(p.slots ?? []).filter((s) => !s.past && s.fitsParty).length}`} sub={`${t("for")} ${p.party} ${t("guests")}`} />
              <Stat icon={<Inbox className="size-4" />} label={t("Requests waiting")} value={day.waiting ? `+${day.waiting}` : "0"} sub={t("guests not keyed in yet")} tone={day.waiting ? "amber" : undefined} />
            </div>
          ) : null}

          {p.slots === null || !day || day.status === "closed" ? (
            <p className="rounded-xl bg-slate-100 px-4 py-6 text-center font-medium text-slate-600">{t("Closed on this day")}</p>
          ) : (
            <>
              {/* Times */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">{t("Pick a time")} <span className="font-normal text-muted">· {t("number = tables free for this party size")}</span></p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                  {p.slots.map((s) => (
                    <Link key={s.time} href={`${q({ time: s.time })}#day`} className={cn("rounded-xl border-2 px-2 py-1.5 text-center transition", SLOT_CLS[s.level], s.time === p.slot?.time && "ring-2 ring-brand-600 ring-offset-1")}>
                      <span className="block text-base font-bold tabular-nums">{s.time}</span>
                      <span className="block text-[11px] font-medium">{s.past ? t("Past") : s.fitsParty ? `${t("Free")} ${s.freeTables}/${s.totalTables}` : t("Full")}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                {/* Floor plan and rooms at the chosen time */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{t("Tables at")} {p.slot?.time}</p>
                    {p.slot && p.slot.level !== "past" && (p.canBook || p.canRequest) ? (
                      <Button asChild size="sm"><Link href={actionHref(p.slot.time)}><Plus />{" "}{p.canBook ? t("Book table") : t("Log a request")} · {p.slot.time}</Link></Button>
                    ) : null}
                  </div>
                  {p.plan && p.planMarkers.length > 0 ? <FloorPlanMap plan={p.plan} markers={p.planMarkers} /> : null}
                  <p className="flex flex-wrap gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-emerald-600 bg-emerald-400/70" />{t("Free")}</span>
                    <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-red-600 bg-red-400/75" />{t("Booked")}</span>
                    <span className="flex items-center gap-1"><span className="size-3 rounded border-2 border-slate-500 bg-slate-300/80" />{t("Out of service")}</span>
                  </p>
                  <RoomStatus rooms={p.rooms} t={t} guests={p.zoneGuests} />
                </div>

                {/* Who is booked */}
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">{t("Bookings on this day")} <span className="font-normal text-muted">· {counts(bookings).bookings} {t("bookings")} · {counts(bookings).guests} {t("guests")}</span></p>
                  {bookings.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted">{t("No bookings yet. Every table is free.")}</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500">
                          <tr>
                            <th className="px-2 py-2 font-medium">{t("Time")}</th>
                            <th className="px-2 py-2 font-medium">{t("Guest")}</th>
                            <th className="px-2 py-2 text-center font-medium">{t("Guests")}</th>
                            <th className="px-2 py-2 font-medium">{t("Table")}</th>
                            <th className="px-2 py-2 font-medium">{t("Status")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bookings.map((b) => {
                            const rs = RES_STATUS[b.status] ?? { label: b.status, cls: "bg-slate-100 text-slate-600" };
                            const name = p.canOpenReservations ? <Link href={`/reservations/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{b.name}</Link> : <span className="font-medium text-slate-900">{b.name}</span>;
                            return (
                              <tr key={b.id} className={cn(atSlot(b) && "bg-brand-50/70")}>
                                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums"><span className="font-semibold">{b.time}</span><span className="text-muted">–{b.end}</span></td>
                                <td className="px-2 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[b.type ?? "other"])} />
                                    <span className="truncate">{name}</span>
                                  </div>
                                  {b.type ? <span className={cn("mt-0.5 inline-block rounded px-1 text-[10px] font-medium", TYPE_BADGE[b.type])}>{p.typeLabel(b.type)}</span> : null}
                                </td>
                                <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{b.party}</td>
                                <td className="px-2 py-1.5 text-xs">{b.tables ? <><span className="font-medium text-slate-800">{b.tables}</span><span className="block text-muted">{b.room}</span></> : <span className="text-amber-700">{t("No table yet")}</span>}</td>
                                <td className="px-2 py-1.5"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", rs.cls)}>{t(rs.label)}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {p.slot ? <p className="text-xs text-muted">{t("Highlighted rows are at the table at")} {p.slot.time}</p> : null}
                </div>
              </div>

              {/* Time line per table */}
              {p.timeline ? (
                <div className="space-y-2 border-t pt-4">
                  <p className="font-semibold text-slate-900">{t("Bookings by table")} <span className="font-normal text-muted">· {t("Green = free, coloured block = booked time")}</span></p>
                  <TableTimeline timeline={p.timeline} nowLeft={p.nowLeft} t={t} typeLabel={p.typeLabel} linkTo={p.canOpenReservations ? (id) => `/reservations/${id}` : null} />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone, bar }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "green" | "amber" | "red"; bar?: number }) {
  const toneCls = tone === "green" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "red" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white";
  const barCls = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={cn("rounded-xl border p-3", toneCls)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">{icon}{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {bar != null ? (
        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-white">
          <span className={cn("block h-full rounded-full", barCls)} style={{ width: `${Math.min(100, bar * 100)}%` }} />
        </span>
      ) : null}
      {sub ? <p className="mt-1 truncate text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

function Legend({ t, typeLabel }: { t: (s: string) => string; typeLabel: (k: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">{t("How to read")}:</span>
      {(Object.keys(STATUS) as CapacityStatus[]).map((k) => (
        <span key={k} className="flex items-center gap-1"><span className={cn("rounded-full px-1.5 text-[10px] font-semibold", STATUS[k].badge)}>{t(STATUS[k].label)}</span></span>
      ))}
      <span>· {t("Room tag = tables free / tables in the room")}</span>
      <span>· {t("+N = guests in requests waiting to be keyed in")}</span>
      <span className="flex items-center gap-2">· {TYPES.map((k) => <span key={k} className="flex items-center gap-1"><span className={cn("size-2 rounded-full", TYPE_DOT[k])} />{typeLabel(k)}</span>)}</span>
    </div>
  );
}
