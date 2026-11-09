import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, pickParam, todayIn } from "@/lib/data/common";
import { loadDayTotals, loadOccupancy, loadRestaurantConfig } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard } from "@/lib/domain/availability-board";
import { Card, CardContent, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { cn } from "@/lib/utils";
import { AutoSubmitForm } from "@/components/auto-submit-form";

export const metadata = { title: "Table availability" };

const LEVEL = {
  open: { label: "Available", cls: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  busy: { label: "Almost full", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  full: { label: "Full", cls: "border-red-300 bg-red-50 text-red-700" },
  past: { label: "Passed", cls: "border-slate-200 bg-slate-50 text-slate-400" },
} as const;

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getStaffT();
  const ctx = await requireStaff("availability.view", "availability");
  const sp = await searchParams;
  const restaurantId = [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const dateParam = pickParam(sp.date);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const party = Math.min(200, Math.max(1, Number(pickParam(sp.party) ?? 2) || 2));

  const supabase = await createClient();
  const config = await loadRestaurantConfig(supabase, restaurantId);
  const [occupancy, totals, { data: areaRows }, requests] = await Promise.all([
    loadOccupancy(supabase, restaurantId, date, restaurant.timezone),
    loadDayTotals(supabase, restaurantId, date),
    supabase.from("restaurant_areas").select("id, name, sort_order").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("booking_requests").select("id").eq("restaurant_id", restaurantId).eq("requested_date", date).eq("status", "pending"),
  ]);
  // Next 14 days from the chosen week start: bookings and guests per day, for the quick date picker.
  const stripStart = date < today ? date : addDays(date, -Math.min(3, Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)));
  const stripDays = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));
  const { data: stripRows } = await supabase
    .from("reservations")
    .select("reservation_date, party_size")
    .eq("restaurant_id", restaurantId)
    .gte("reservation_date", stripDays[0])
    .lte("reservation_date", stripDays[13])
    .not("status", "in", "(cancelled,no_show)");
  const perDay = new Map<string, { b: number; g: number }>();
  for (const r of stripRows ?? []) {
    const d = perDay.get(r.reservation_date) ?? { b: 0, g: 0 };
    d.b += 1;
    d.g += r.party_size;
    perDay.set(r.reservation_date, d);
  }
  const areaName = new Map((areaRows ?? []).map((a) => [a.id, a.name]));
  const areaOrder = new Map((areaRows ?? []).map((a, i) => [a.id, i]));
  const tables = [...config.tables]
    .filter((tb) => tb.is_active)
    .sort((a, b) => (areaOrder.get(a.area_id ?? "") ?? 99) - (areaOrder.get(b.area_id ?? "") ?? 99) || a.sort_order - b.sort_order)
    .map((tb) => ({ ...tb, area: tb.area_id ? (areaName.get(tb.area_id) ?? null) : null }));

  const board = buildAvailabilityBoard({
    date,
    partySize: party,
    timezone: restaurant.timezone,
    policy: config.policy,
    hours: config.hours,
    tables,
    combinations: config.combinations,
    occupancy,
    now: new Date(),
  });

  const canBook = roleCan(ctx.role, "reservation.write") && ctx.pages.includes("reservations");
  const canRequest = roleCan(ctx.role, "request.create") && ctx.pages.includes("requests") && !canBook;
  const pendingRequests = requests.error ? null : (requests.data ?? []).length;
  const capB = config.policy.max_online_bookings_per_day;
  const capC = config.policy.max_online_covers_per_day;
  const link = (d: string) => `/availability?restaurant=${restaurantId}&date=${d}&party=${party}`;
  const actionHref = (time: string) =>
    canBook
      ? `/reservations/new?restaurant=${restaurantId}&date=${date}&time=${time}&party=${party}`
      : `/requests?restaurant=${restaurantId}&rdate=${date}&time=${time}&party=${party}`;

  // Group slots by service (Lunch / Dinner) for the summary strip.
  const services = board.ok ? [...new Set(board.slots.map((s) => s.service))] : [];

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["reservations", "reservation_tables", "booking_requests"]} />
      <PageHeader
        title={`${t("Table availability")} · ${restaurant.name}`}
        description={t("Green: a table is free for this party size. Red: full. Both the Call Center and the store see the same live view.")}
        actions={
          <AutoSubmitForm className="flex flex-wrap items-center gap-2">
            {ctx.restaurants.length > 1 ? (
              <Select name="restaurant" defaultValue={restaurantId} className="w-44" aria-label={t("Restaurant")}>
                {ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            ) : null}
            <Input type="date" name="date" defaultValue={date} className="w-40" aria-label={t("Date")} />
            <label className="flex items-center gap-1 text-sm text-slate-700">
              {t("Guests")}
              <Input type="number" name="party" min={1} max={200} defaultValue={party} className="w-20" />
            </label>
            <Button variant="outline">{t("Show")}</Button>
          </AutoSubmitForm>
        }
      />

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link href={link(addDays(date, -1))} aria-label={t("Previous day")}><ChevronLeft /></Link></Button>
        <Button asChild size="sm" variant={date === today ? "default" : "outline"}><Link href={link(today)}>{t("Today")}</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={link(addDays(date, 1))} aria-label={t("Next day")}><ChevronRight /></Link></Button>
        <span className="ml-2 text-sm font-medium text-slate-800">{new Date(`${date}T12:00:00Z`).toLocaleDateString(STAFF_DATE_LOCALES[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {stripDays.map((d) => {
          const c = perDay.get(d);
          const [yy, mm, dd] = d.split("-").map(Number);
          const dt = new Date(Date.UTC(yy, mm - 1, dd, 12));
          return (
            <Link
              key={d}
              href={link(d)}
              className={cn(
                "min-w-[4.25rem] shrink-0 rounded-lg border px-2 py-1.5 text-center text-xs",
                d === date ? "border-brand-500 bg-brand-500 text-white" : d < today ? "bg-slate-50 text-slate-400" : "bg-white text-slate-700 hover:border-brand-400",
              )}
            >
              <span className="block">{dt.toLocaleDateString(STAFF_DATE_LOCALES[locale], { weekday: "short", timeZone: "UTC" })}</span>
              <span className="block text-base font-semibold tabular-nums">{dd}</span>
              <span className="block text-[10px] opacity-80">{dt.toLocaleDateString(STAFF_DATE_LOCALES[locale], { month: "short", timeZone: "UTC" })}</span>
              <span className="block text-[10px] tabular-nums opacity-90">{c ? `${c.b} ${t("bookings")} · ${c.g} ${t("guests")}` : "—"}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label={t("Bookings this day")} value={totals.bookings} hint={capB ? `${t("online limit")} ${capB}` : undefined} tone="brand" />
        <StatCard label={t("Guests this day")} value={totals.covers} hint={capC ? `${t("online limit")} ${capC}` : undefined} tone="brand" />
        <StatCard label={t("Tables")} value={board.ok ? (board.slots[0]?.totalTables ?? tables.length) : tables.length} tone="slate" />
        <StatCard
          label={t("Requests waiting to be keyed in")}
          value={pendingRequests ?? "—"}
          tone={pendingRequests ? "accent" : "slate"}
        />
      </div>

      {!board.ok ? (
        <EmptyState title={board.reason === "closed" ? t("Closed on this day") : t("Invalid date")} description={t("Check another date, or the opening hours in Restaurants.")} />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-medium text-slate-700">{t("Party of")} {party}:</span>
                {(["open", "busy", "full", "past"] as const).map((k) => (
                  <span key={k} className={cn("rounded-md border px-2 py-0.5", LEVEL[k].cls)}>{t(LEVEL[k].label)}</span>
                ))}
                <span className="text-muted">· {t("seating time")} {board.durationMinutes} {t("min")}</span>
              </div>
              {services.map((svc) => (
                <div key={svc}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t(svc)}</p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
                    {board.slots.filter((s) => s.service === svc).map((s) => {
                      const cell = (
                        <>
                          <span className="block font-semibold tabular-nums">{s.time}</span>
                          <span className="block text-[11px]">{t(LEVEL[s.level].label)}</span>
                          <span className="block text-[11px] opacity-80">{t("free")} {s.freeTables}/{s.totalTables}</span>
                        </>
                      );
                      const cls = cn("rounded-lg border px-2 py-1.5 text-center text-sm", LEVEL[s.level].cls);
                      return s.level !== "past" && (canBook || canRequest) ? (
                        <Link key={s.time} href={actionHref(s.time)} className={cn(cls, "hover:ring-2 hover:ring-brand-300")} title={s.fitsParty ? s.bestLabels.join(" + ") : t("Full")}>
                          {cell}
                        </Link>
                      ) : (
                        <div key={s.time} className={cls} title={s.fitsParty ? s.bestLabels.join(" + ") : undefined}>{cell}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {canBook || canRequest ? (
                <p className="text-xs text-muted">{canBook ? t("Tap a time to make a booking.") : t("Tap a time to log a booking request for the store.")}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 text-sm font-medium text-slate-800">{t("Tables by time")}</p>
              <p className="mb-3 text-xs text-muted">{t("Filled cells are booked. Each column is one booking interval.")}</p>
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white pr-3 text-left font-medium text-muted">{t("Table")}</th>
                      {board.slots.map((s) => (
                        <th key={s.time} className="px-0.5 pb-1 text-center font-normal tabular-nums text-muted">
                          <span className="inline-block w-9">{s.time}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {board.rows.map((r, ri) => {
                      const newArea = ri === 0 || board.rows[ri - 1].area !== r.area;
                      return [
                        newArea && r.area ? (
                          <tr key={`area-${r.id}`}>
                            <td colSpan={board.slots.length + 1} className="sticky left-0 bg-white pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{r.area}</td>
                          </tr>
                        ) : null,
                        <tr key={r.id}>
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-0.5 pr-3 font-medium text-slate-800">
                            {r.label} <span className="font-normal text-muted">({r.capacity})</span>
                            {!r.usable ? <span className="ml-1 text-red-600">{t("out of service")}</span> : null}
                          </td>
                          {r.busy.map((b, i) => (
                            <td key={i} className="px-0.5 py-0.5">
                              <span
                                className={cn(
                                  "block h-5 w-9 rounded",
                                  !r.usable ? "bg-slate-200" : b ? "bg-red-400" : board.slots[i].past ? "bg-slate-100" : "bg-emerald-100",
                                )}
                                title={`${r.label} ${board.slots[i].time}: ${!r.usable ? t("out of service") : b ? t("Booked") : t("Free")}`}
                              />
                            </td>
                          ))}
                        </tr>,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
