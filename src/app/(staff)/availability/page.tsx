import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { loadOccupancy, loadRestaurantConfig } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard } from "@/lib/domain/availability-board";
import { buildCapacityMonth, monthDays, type CapacityStatus } from "@/lib/domain/capacity-check";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Table availability" };

const STATUS: Record<CapacityStatus, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-100 text-emerald-800" },
  full: { label: "FULL", cls: "bg-amber-100 text-amber-800" },
  over: { label: "OVER CAP", cls: "bg-red-100 text-red-700" },
  closed: { label: "Closed", cls: "bg-slate-100 text-slate-500" },
};

const SLOT = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-800",
  busy: "border-amber-300 bg-amber-50 text-amber-800",
  full: "border-red-300 bg-red-50 text-red-700",
  past: "border-slate-200 bg-slate-50 text-slate-400",
} as const;

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

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
  const party = Math.min(200, Math.max(1, Number(pickParam(sp.party) ?? 2) || 2));
  const days = monthDays(month);

  const supabase = await createClient();
  const config = await loadRestaurantConfig(supabase, restaurantId);
  const [occupancy, { data: resRows }, requests] = await Promise.all([
    loadOccupancy(supabase, restaurantId, date, restaurant.timezone),
    supabase
      .from("reservations")
      .select("reservation_date, party_size, internal_notes")
      .eq("restaurant_id", restaurantId)
      .gte("reservation_date", days[0])
      .lte("reservation_date", days[days.length - 1])
      .not("status", "in", "(cancelled,no_show)"),
    supabase
      .from("booking_requests")
      .select("requested_date, party_size")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .gte("requested_date", days[0])
      .lte("requested_date", days[days.length - 1]),
  ]);

  const usableTables = config.tables.filter((tb) => tb.is_active && tb.service_status !== "out_of_service");
  const seats = usableTables.reduce((a, tb) => a + tb.max_capacity, 0);
  const rows = buildCapacityMonth({
    month,
    seats,
    hours: config.hours,
    reservations: (resRows ?? []).map((r) => ({ date: r.reservation_date, party: r.party_size, notes: r.internal_notes })),
    waiting: requests.error ? [] : (requests.data ?? []).map((r) => ({ date: r.requested_date, party: r.party_size })),
  });
  const sum = (k: "internal" | "kol" | "media" | "other") => rows.reduce((a, r) => a + r.pax[k], 0);
  const overDays = rows.filter((r) => r.status === "over").length;

  const board = buildAvailabilityBoard({
    date,
    partySize: party,
    timezone: restaurant.timezone,
    policy: config.policy,
    hours: config.hours,
    tables: config.tables,
    combinations: config.combinations,
    occupancy,
    now: new Date(),
  });
  const selected = rows.find((r) => r.date === date);

  const canBook = roleCan(ctx.role, "reservation.write") && ctx.pages.includes("reservations");
  const canRequest = roleCan(ctx.role, "request.create") && ctx.pages.includes("requests") && !canBook;
  const q = (over: Record<string, string | number>) =>
    `/availability?${new URLSearchParams({ restaurant: restaurantId, month, date, party: String(party), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) })}`;
  const actionHref = (time: string) =>
    canBook
      ? `/reservations/new?restaurant=${restaurantId}&date=${date}&time=${time}&party=${party}`
      : `/requests?restaurant=${restaurantId}&rdate=${date}&time=${time}&party=${party}`;
  const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...opts });

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["reservations", "reservation_tables", "booking_requests"]} />
      <PageHeader
        title={`${t("Table availability")} · ${restaurant.name}`}
        description={`${t("Seats per day")}: ${seats} · ${t("Tap a day to see free times.")}`}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link href={q({ month: shiftMonth(month, -1), date: `${shiftMonth(month, -1)}-01` })} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
        <span className="min-w-36 text-center font-semibold text-slate-900">{fmtDay(`${month}-01`, { month: "long", year: "numeric" })}</span>
        <Button asChild size="sm" variant="outline"><Link href={q({ month: shiftMonth(month, 1), date: `${shiftMonth(month, 1)}-01` })} aria-label={t("Next month")}><ChevronRight /></Link></Button>
        <Button asChild size="sm" variant="ghost"><Link href={q({ month: today.slice(0, 7), date: today })}>{t("Today")}</Link></Button>
        <span className="ml-auto text-xs text-muted">
          Internal {sum("internal")} · KOL {sum("kol")} · Media {sum("media")} · {t("Other")} {sum("other")}
          {overDays ? <span className="ml-2 font-medium text-red-700">· OVER CAP {overDays} {t("days")}</span> : null}
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 text-left font-medium">{t("Date")}</th>
                  <th className="px-2 py-2 text-right font-medium">Internal</th>
                  <th className="px-2 py-2 text-right font-medium">KOL</th>
                  <th className="px-2 py-2 text-right font-medium">Media</th>
                  <th className="px-2 py-2 text-right font-medium">{t("Other")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("Total")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("Seats left")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS[r.status];
                  const isSel = r.date === date;
                  const past = r.date < today;
                  return (
                    <tr key={r.date} className={cn("border-b last:border-0", isSel ? "bg-brand-50" : past ? "text-slate-400" : "hover:bg-slate-50")}>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <Link href={q({ date: r.date })} className="block font-medium tabular-nums">
                          {fmtDay(r.date, { day: "numeric", month: "short" })} <span className="font-normal text-muted">{fmtDay(r.date, { weekday: "short" })}</span>
                          {r.date === today ? <span className="ml-1 rounded bg-brand-500 px-1 text-[10px] text-white">{t("Today")}</span> : null}
                        </Link>
                      </td>
                      {(["internal", "kol", "media", "other"] as const).map((k) => (
                        <td key={k} className="px-2 py-1.5 text-right tabular-nums">{r.pax[k] || <span className="text-slate-300">0</span>}</td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {r.total}
                        {r.waiting ? <span className="ml-1 text-xs font-normal text-accent-700" title={t("Waiting to be keyed in")}>+{r.waiting}</span> : null}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right tabular-nums", r.left < 0 ? "font-semibold text-red-700" : "")}>{r.status === "closed" ? "—" : r.left}</td>
                      <td className="px-3 py-1.5">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", st.cls)}>{t(st.label)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t px-3 py-2 text-xs text-muted">{t("+N = guests in requests still waiting for the store to key them in.")}</p>
        </Card>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardContent className="space-y-3 pt-4">
            <div>
              <p className="font-semibold text-slate-900">{fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
              {selected && selected.status !== "closed" ? (
                <p className="text-sm text-muted">
                  {t("Booked")} {selected.total}/{seats} · {t("Seats left")} {selected.left}
                </p>
              ) : null}
            </div>
            <AutoSubmitForm className="flex items-center gap-2">
              <input type="hidden" name="restaurant" value={restaurantId} />
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="date" value={date} />
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
                    const cls = cn("rounded-lg border px-1 py-1.5 text-center text-sm tabular-nums", SLOT[s.level]);
                    return s.level !== "past" && (canBook || canRequest) ? (
                      <Link key={s.time} href={actionHref(s.time)} className={cn(cls, "hover:ring-2 hover:ring-brand-300")}>{s.time}</Link>
                    ) : (
                      <span key={s.time} className={cls}>{s.time}</span>
                    );
                  })}
                </div>
                <p className="text-xs text-muted">
                  {t("green = table free, red = full")}
                  {canBook ? ` · ${t("Tap a time to make a booking.")}` : canRequest ? ` · ${t("Tap a time to log a booking request for the store.")}` : ""}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
