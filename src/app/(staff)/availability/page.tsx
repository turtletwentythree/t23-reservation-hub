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
import { loadAreas, loadCapacityMonth } from "@/lib/data/capacity";
import { RoomStatus } from "@/components/room-status";
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
  const party = Math.min(200, Math.max(1, Number(pickParam(sp.party) ?? 2) || 2));

  const supabase = await createClient();
  const cap = await loadCapacityMonth(supabase, restaurantId, month);
  const [occupancy, areas] = await Promise.all([loadOccupancy(supabase, restaurantId, date, restaurant.timezone), loadAreas(supabase, restaurantId)]);
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
                      "flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[5.5rem]",
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
                        <span className="mt-auto text-xs tabular-nums text-slate-800">
                          <strong>{r.total}</strong>/{r.seats}
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
          {board.ok ? <RoomStatus rooms={rooms} t={t} /> : <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-muted">{t("Closed on this day")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
