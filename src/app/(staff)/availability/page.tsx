import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { loadOccupancy } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard, summarizeRooms } from "@/lib/domain/availability-board";
import { shiftMonth, type CapacityStatus } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS } from "@/lib/domain/request-tags";
import { loadAreas, loadCapacityMonth, loadZoneMonth } from "@/lib/data/capacity";
import { RoomStatus } from "@/components/room-status";
import { FloorPlanMap, type PlanMarker } from "@/components/floor-plan-map";
import { floorPlanFor } from "@/lib/floor-plans";
import { TableTimeline } from "@/components/table-timeline";
import { buildTimeline } from "@/lib/domain/table-timeline";
import { buildTableMonth } from "@/lib/domain/table-month";
import { TableMonthCalendar } from "@/components/table-month-calendar";
import { splitCustomerType } from "@/lib/domain/request-tags";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Table availability" };

const DAY_CLS: Record<CapacityStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-400",
  full: "border-amber-300 bg-amber-50 hover:border-amber-500",
  over: "border-red-300 bg-red-50 hover:border-red-500",
  closed: "border-slate-200 bg-slate-50 text-slate-400",
};
const BADGE: Record<CapacityStatus, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-100 text-emerald-800" },
  full: { label: "FULL", cls: "bg-amber-100 text-amber-800" },
  over: { label: "OVER CAP", cls: "bg-red-100 text-red-700" },
  closed: { label: "Closed", cls: "bg-slate-100 text-slate-500" },
};
const TYPE_COLORS = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" } as const;
const SLOT = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-800",
  busy: "border-amber-300 bg-amber-50 text-amber-800",
  full: "border-red-300 bg-red-50 text-red-700",
  past: "border-slate-200 bg-slate-50 text-slate-400",
} as const;

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getStaffT();
  const dl = STAFF_DATE_LOCALES[locale];
  const ctx = await requireStaff("availability.view", "availability");
  const sp = await searchParams;
  const restaurantId = [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const dateParam = pickParam(sp.date);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const monthParam = pickParam(sp.month);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : date.slice(0, 7);
  const timeParam = pickParam(sp.time);
  const tlView = pickParam(sp.tl) === "month" ? "month" : "day";
  const party = Math.min(200, Math.max(1, Number(pickParam(sp.party) ?? 2) || 2));

  const supabase = await createClient();
  // Everything that does not depend on another query is fetched at once, to keep clicks fast.
  const [cap, occupancy, areas, { data: monthRes }] = await Promise.all([
    loadCapacityMonth(supabase, restaurantId, month),
    loadOccupancy(supabase, restaurantId, date, restaurant.timezone),
    loadAreas(supabase, restaurantId),
    supabase
      .from("reservations")
      .select("id, reservation_date, reservation_time, customer_name, party_size, status, internal_notes, reservation_tables(table_id)")
      .eq("restaurant_id", restaurantId)
      .gte("reservation_date", `${month}-01`)
      .lte("reservation_date", `${month}-31`)
      .not("status", "in", "(cancelled,no_show)"),
  ]);
  // Booking details for the day's timeline come from the month list; only the rest (e.g. a late booking from the day before) is fetched.
  const known = new Set((monthRes ?? []).map((r) => r.id));
  const missing = [...new Set(occupancy.map((o) => o.reservation_id))].filter((id) => !known.has(id));
  const [zm, { data: extraDetail }] = await Promise.all([
    loadZoneMonth(supabase, restaurantId, month, cap.config),
    missing.length
      ? supabase.from("reservations").select("id, customer_name, party_size, status, internal_notes").in("id", missing)
      : Promise.resolve({ data: [] as { id: string; customer_name: string; party_size: number; status: string; internal_notes: string | null }[] }),
  ]);
  const zoneGuests = new Map(zm.zones.map((z) => [z.id, { pax: zm.paxOf(z.id, date), cap: zm.capacityOf(z.id, date) }]));
  const rows = cap.rows;
  const board = buildAvailabilityBoard({
    date,
    partySize: party,
    timezone: restaurant.timezone,
    policy: cap.config.policy,
    hours: cap.config.hours,
    tables: cap.config.tables,
    combinations: cap.config.combinations,
    occupancy,
    now: new Date(),
  });
  const slotIdx = board.ok
    ? Math.max(0, board.slots.findIndex((s) => (timeParam ? s.time === timeParam : !s.past)))
    : 0;
  const slot = board.ok ? board.slots[slotIdx] : undefined;
  const rooms = board.ok ? summarizeRooms(board, new Map(cap.config.tables.map((x) => [x.id, x.area_id])), areas, slotIdx) : [];
  // Who is booked on which table, and when.
  const details = new Map([...(monthRes ?? []), ...(extraDetail ?? [])].map((r) => [r.id, { name: r.customer_name, party: r.party_size, type: splitCustomerType(r.internal_notes).type, status: r.status }]));
  const timeline =
    board.ok && board.slots.length
      ? buildTimeline({
          date,
          timezone: restaurant.timezone,
          firstSlot: board.slots[0].time,
          lastSlot: board.slots[board.slots.length - 1].time,
          durationMinutes: board.durationMinutes,
          tables: board.rows.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, areaId: cap.config.tables.find((x) => x.id === r.id)?.area_id ?? null, out: !r.usable })),
          areas,
          occupancy,
          details,
        })
      : null;
  // Month view of the same card: bookings per table per day.
  const tableMonth = buildTableMonth({
    month,
    tables: cap.config.tables
      .filter((x) => x.is_active)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .map((x) => ({ id: x.id, label: x.label, capacity: x.max_capacity, areaId: x.area_id ?? null, out: false })),
    areas,
    bookings: (monthRes ?? []).map((r) => ({
      id: r.id,
      date: r.reservation_date,
      time: r.reservation_time,
      name: r.customer_name,
      party: r.party_size,
      type: splitCustomerType(r.internal_notes).type,
      status: r.status,
      tableIds: (r.reservation_tables ?? []).map((x: { table_id: string }) => x.table_id),
    })),
  });
  const closedDays = new Set(rows.filter((r) => r.status === "closed").map((r) => r.date));
  let nowLeft: number | null = null;
  if (timeline && date === today) {
    const nowHm = new Date().toLocaleTimeString("en-GB", { timeZone: restaurant.timezone, hour: "2-digit", minute: "2-digit", hour12: false });
    const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
    const span = m(timeline.end) - m(timeline.start) || 1440 - m(timeline.start);
    const pos = ((m(nowHm) - m(timeline.start)) / span) * 100;
    nowLeft = pos >= 0 && pos <= 100 ? pos : null;
  }
  const plan = floorPlanFor(restaurant.slug);
  const stateById = new Map(rooms.flatMap((r) => r.tables.map((x) => [x.id, x.state] as const)));
  const planMarkers: PlanMarker[] = cap.config.tables
    .filter((x) => x.is_active && stateById.has(x.id))
    .map((x) => ({ id: x.id, label: x.label, capacity: x.max_capacity, x: x.pos_x, y: x.pos_y, w: x.width, h: x.height, state: stateById.get(x.id)! }));
  const selected = rows.find((r) => r.date === date);
  const overDays = rows.filter((r) => r.status === "over").length;
  const fullDays = rows.filter((r) => r.status === "full").length;

  const canBook = roleCan(ctx.role, "reservation.write") && ctx.pages.includes("reservations");
  const canRequest = roleCan(ctx.role, "request.create") && ctx.pages.includes("requests") && !canBook;
  const q = (over: Record<string, string>) => `/availability?${new URLSearchParams({ restaurant: restaurantId, month, date, party: String(party), ...over })}`;
  const actionHref = (time: string) =>
    canBook
      ? `/reservations/new?restaurant=${restaurantId}&date=${date}&time=${time}&party=${party}`
      : `/requests?restaurant=${restaurantId}&rdate=${date}&time=${time}&party=${party}`;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...o });

  const typeLabel = (k: string) => (k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k as keyof typeof CUSTOMER_TYPE_LABELS] ?? k);
  // Per room and day: tables booked out of tables in the room.
  const roomDay = (d: string) =>
    tableMonth.rooms.map((room) => {
      const live = room.tables.filter((x) => !x.out);
      const zone = zm.zones.find((z) => z.id === room.id);
      return {
        id: room.id ?? "none",
        name: room.name,
        booked: live.filter((x) => (x.days[d] ?? []).length > 0).length,
        total: live.length,
        pax: zone ? zm.paxOf(zone.id, d) : null,
        cap: zone ? zm.capacityOf(zone.id, d) : null,
      };
    });
  const bookingsOn = (d: string) => new Set(tableMonth.rooms.flatMap((r) => r.tables.flatMap((x) => (x.days[d] ?? []).map((b) => b.id)))).size;
  // Calendar grid, weeks start on Monday.
  const firstDow = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (typeof rows[number] | null)[] = [...Array(firstDow).fill(null), ...rows];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(`2026-11-${String(2 + i).padStart(2, "0")}`, { weekday: "short" })); // 2 Nov 2026 is a Monday

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["reservations", "reservation_tables", "booking_requests", "daily_capacity"]} />
      <PageHeader
        title={`${t("Table availability")} · ${restaurant.name}`}
        description={t("Tap a day to see free times.")}
        actions={
          ctx.restaurants.length > 1 ? (
            <AutoSubmitForm className="flex items-center gap-2">
              <input type="hidden" name="month" value={month} />
              <Select name="restaurant" defaultValue={restaurantId} className="w-48" aria-label={t("Restaurant")}>
                {ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </AutoSubmitForm>
          ) : null
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline"><Link href={q({ month: shiftMonth(month, -1), date: `${shiftMonth(month, -1)}-01` })} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
              <span className="min-w-36 text-center text-lg font-semibold text-slate-900">{fmt(`${month}-01`, { month: "long", year: "numeric" })}</span>
              <Button asChild size="sm" variant="outline"><Link href={q({ month: shiftMonth(month, 1), date: `${shiftMonth(month, 1)}-01` })} aria-label={t("Next month")}><ChevronRight /></Link></Button>
              <Button asChild size="sm" variant="ghost"><Link href={q({ month: today.slice(0, 7), date: today })}>{t("Today")}</Link></Button>
              <div className="ml-auto flex gap-1.5 text-xs">
                <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-800">FULL {fullDays}</span>
                <span className="rounded-md bg-red-100 px-2 py-0.5 font-medium text-red-700">OVER CAP {overDays}</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted">
              {weekdays.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((r, i) =>
                r ? (
                  <Link
                    key={r.date}
                    href={q({ date: r.date })}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[8.5rem]",
                      DAY_CLS[r.status],
                      r.date < today && "opacity-50",
                      r.date === date && "ring-2 ring-brand-500",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={cn("text-sm font-semibold tabular-nums", r.date === today && "rounded bg-brand-500 px-1 text-white")}>{Number(r.date.slice(8))}</span>
                      {r.waiting ? <span className="text-[10px] font-medium text-accent-700">+{r.waiting}</span> : null}
                    </span>
                    {r.status === "closed" ? (
                      <span className="mt-auto text-[11px]">{t("Closed")}</span>
                    ) : (
                      <>
                        <span className={cn("mt-0.5 w-fit rounded px-1 text-[10px] font-semibold", BADGE[r.status].cls)}>{t(BADGE[r.status].label)}</span>
                        <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                          {roomDay(r.date).map((z) => (
                            <span key={z.id} className="flex items-center gap-1 text-[10px] leading-3 text-slate-700">
                              <span className="truncate">{z.name}</span>
                              <span className={cn("ml-auto shrink-0 tabular-nums font-medium", z.booked >= z.total && z.total > 0 ? "text-red-700" : "text-slate-800")}>{z.booked}/{z.total}</span>
                            </span>
                          ))}
                        </span>
                        <span className="mt-auto pt-1 text-xs tabular-nums text-slate-800">
                          <strong>{r.total}</strong>/{r.seats} {t("guests")}
                          {bookingsOn(r.date) ? <span className="text-muted"> · {bookingsOn(r.date)} {t("bookings")}</span> : null}
                        </span>
                        <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-white">
                          {(["internal", "kol", "media", "other"] as const).map((k) =>
                            r.pax[k] ? <span key={k} className={TYPE_COLORS[k]} style={{ width: `${(r.pax[k] / Math.max(r.seats, r.total, 1)) * 100}%` }} /> : null,
                          )}
                        </span>
                      </>
                    )}
                  </Link>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted">
              {(["internal", "kol", "media", "other"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1"><span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />{k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]}</span>
              ))}
              <span>· {t("Room rows = tables booked / tables in the room")}</span>
              <span>· {t("+N = guests in requests still waiting for the store to key them in.")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{fmt(date, { weekday: "long", day: "numeric", month: "long" })}</p>
                {selected && selected.status !== "closed" ? (
                  <p className="text-sm text-muted">
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">{selected.total}</span> / {selected.seats} {t("guests")} · {t("Seats left")} {selected.left}
                  </p>
                ) : null}
              </div>
              {selected ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[selected.status].cls)}>{t(BADGE[selected.status].label)}</span> : null}
            </div>

            {selected && selected.status !== "closed" ? (
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {(["internal", "kol", "media", "other"] as const).map((k) => (
                  <div key={k} className="rounded-lg bg-slate-50 py-1.5">
                    <p className="font-semibold tabular-nums">{selected.pax[k]}</p>
                    <p className="text-[11px] text-muted">{k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-3">
              <AutoSubmitForm className="flex items-center justify-between gap-2">
                <input type="hidden" name="restaurant" value={restaurantId} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="date" value={date} />
                <span className="text-sm font-medium text-slate-800">{t("Free times")}</span>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  {t("Guests")}
                  <Input type="number" name="party" min={1} max={200} defaultValue={party} className="h-8 w-20" />
                </label>
              </AutoSubmitForm>
              {!board.ok ? (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-muted">{t("Closed on this day")}</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {board.slots.map((s) => {
                      const cls = cn("rounded-lg border px-1 py-1.5 text-center text-sm tabular-nums", SLOT[s.level], s.time === slot?.time && "ring-2 ring-brand-500");
                      return (
                        <Link key={s.time} href={q({ time: s.time })} className={cn(cls, "hover:ring-2 hover:ring-brand-300")}>{s.time}</Link>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted">
                    {t("green = table free, red = full")} · {t("Tap a time to see the rooms.")}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{t("Rooms and tables")}</p>
              <p className="text-sm text-muted">
                {fmt(date, { weekday: "short", day: "numeric", month: "short" })}{slot ? ` · ${slot.time}` : ""}
              </p>
            </div>
            {slot && slot.level !== "past" && (canBook || canRequest) ? (
              <Button asChild size="sm"><Link href={actionHref(slot.time)}>{canBook ? t("Book table") : t("Log a request")} · {slot.time}</Link></Button>
            ) : null}
          </div>
          {board.ok && plan && planMarkers.length > 0 ? (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <FloorPlanMap plan={plan} markers={planMarkers} />
              <RoomStatus rooms={rooms} t={t} guests={zoneGuests} />
            </div>
          ) : board.ok ? <RoomStatus rooms={rooms} t={t} guests={zoneGuests} /> : <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-muted">{t("Closed on this day")}</p>}
        </CardContent>
      </Card>

      <Card id="by-table">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{t("Bookings by table")}</p>
              <p className="text-sm text-muted">
                {tlView === "month"
                  ? t("Bookings per table per day. Pick a month to look further ahead.")
                  : `${fmt(date, { weekday: "long", day: "numeric", month: "long" })} · ${t("Green = free, coloured block = booked time")}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border p-0.5 text-sm">
                <Link href={`${q({ tl: "day" })}#by-table`} className={cn("rounded-md px-3 py-1", tlView === "day" ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}>{t("Day")}</Link>
                <Link href={`${q({ tl: "month" })}#by-table`} className={cn("rounded-md px-3 py-1", tlView === "month" ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}>{t("Month")}</Link>
              </div>
              {tlView === "month" ? (
                <>
                  <Button asChild size="sm" variant="outline"><Link href={`${q({ tl: "month", month: shiftMonth(month, -1), date: `${shiftMonth(month, -1)}-01` })}#by-table`} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
                  <AutoSubmitForm className="flex items-center gap-2">
                    <input type="hidden" name="restaurant" value={restaurantId} />
                    <input type="hidden" name="party" value={party} />
                    <input type="hidden" name="tl" value="month" />
                    <Input type="month" name="month" defaultValue={month} className="h-8 w-40" aria-label={t("Month")} />
                  </AutoSubmitForm>
                  <Button asChild size="sm" variant="outline"><Link href={`${q({ tl: "month", month: shiftMonth(month, 1), date: `${shiftMonth(month, 1)}-01` })}#by-table`} aria-label={t("Next month")}><ChevronRight /></Link></Button>
                </>
              ) : (
                <>
                  <Button asChild size="sm" variant="outline"><Link href={`${q({ tl: "day", date: addDays(date, -1), month: addDays(date, -1).slice(0, 7) })}#by-table`} aria-label={t("Previous day")}><ChevronLeft /></Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link href={`${q({ tl: "day", date: today, month: today.slice(0, 7) })}#by-table`}>{t("Today")}</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`${q({ tl: "day", date: addDays(date, 1), month: addDays(date, 1).slice(0, 7) })}#by-table`} aria-label={t("Next day")}><ChevronRight /></Link></Button>
                </>
              )}
            </div>
          </div>
          {tlView === "month" ? (
            <TableMonthCalendar
              data={tableMonth}
              today={today}
              selected={date}
              closed={closedDays}
              dayHref={(d) => `${q({ tl: "day", date: d, month: d.slice(0, 7) })}#by-table`}
              weekdays={weekdays}
              typeLabel={typeLabel}
              t={t}
            />
          ) : timeline ? (
            <TableTimeline
              timeline={timeline}
              nowLeft={nowLeft}
              t={t}
              typeLabel={typeLabel}
              linkTo={ctx.pages.includes("reservations") && roleCan(ctx.role, "reservation.view") ? (id) => `/reservations/${id}` : null}
            />
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-muted">{t("Closed on this day")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
