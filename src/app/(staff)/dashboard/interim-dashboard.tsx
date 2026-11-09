import Link from "next/link";
import { ChevronLeft, ChevronRight, PhoneCall } from "lucide-react";
import type { StaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/data/common";
import { monthsBetween, resolveRange, type RangeView } from "@/lib/domain/date-range";
import { loadAreas, loadCapacityMonth, loadZoneMonth } from "@/lib/data/capacity";
import { loadOccupancy, loadRestaurantConfig } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard, summarizeRooms } from "@/lib/domain/availability-board";
import { type CapacityDay, type CapacityStatus } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

const TYPES = ["internal", "kol", "media", "other"] as const;
const TYPE_COLORS = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" } as const;
const BADGE: Record<CapacityStatus, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  full: "bg-amber-100 text-amber-800",
  over: "bg-red-100 text-red-700",
  closed: "bg-slate-100 text-slate-500",
};
const TILE: Record<CapacityStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50/60",
  full: "border-amber-300 bg-amber-50",
  over: "border-red-300 bg-red-50",
  closed: "border-slate-200 bg-slate-50 text-slate-400",
};
const LABEL: Record<CapacityStatus, string> = { ok: "OK", full: "FULL", over: "OVER CAP", closed: "Closed" };
const statusOf = (pax: number, cap: number): CapacityStatus => (cap === 0 ? "closed" : pax > cap ? "over" : pax === cap ? "full" : "ok");
const barColor = (s: CapacityStatus, pct: number) => (s === "over" ? "bg-red-500" : s === "full" || pct >= 80 ? "bg-amber-500" : "bg-emerald-500");

function Meter({ pax, cap }: { pax: number; cap: number }) {
  const s = statusOf(pax, cap);
  const pct = cap ? Math.min(100, Math.round((pax / cap) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", barColor(s, pct))} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type DashboardParams = { restaurant?: string; view?: string; date?: string; from?: string; to?: string };

export async function InterimDashboard({ ctx, params }: { ctx: StaffContext; params: DashboardParams }) {
  const { t, locale } = await getStaffT();
  const dl = STAFF_DATE_LOCALES[locale];
  const restaurantId = [params.restaurant, ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const range = resolveRange({ view: params.view, date: params.date, from: params.from, to: params.to, today });
  const months = monthsBetween(range.from, range.to);
  const supabase = await createClient();

  const config = await loadRestaurantConfig(supabase, restaurantId);
  const [capMonths, zoneMonths, pendingRes, pendingCount] = await Promise.all([
    Promise.all(months.map((m) => loadCapacityMonth(supabase, restaurantId, m, config))),
    Promise.all(months.map((m) => loadZoneMonth(supabase, restaurantId, m, config))),
    supabase
      .from("booking_requests")
      .select("id, customer_name, channel, party_size, requested_date, requested_time, notes")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .order("requested_date")
      .order("requested_time")
      .limit(5),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("status", "pending"),
  ]);
  const zoneIn = (date: string) => zoneMonths[months.indexOf(date.slice(0, 7))];

  const showNow = range.from <= today && today <= range.to;
  const [occupancy, areas] = showNow
    ? await Promise.all([loadOccupancy(supabase, restaurantId, today, restaurant.timezone), loadAreas(supabase, restaurantId)])
    : [[], []];
  const board = showNow
    ? buildAvailabilityBoard({ date: today, partySize: 1, timezone: restaurant.timezone, policy: config.policy, hours: config.hours, tables: config.tables, combinations: config.combinations, occupancy, now: new Date() })
    : null;
  const nowIdx = board?.ok ? Math.max(0, board.slots.findIndex((s) => !s.past)) : 0;
  const rooms = board?.ok ? summarizeRooms(board, new Map(config.tables.map((x) => [x.id, x.area_id])), areas, nowIdx) : [];
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const inRange: CapacityDay[] = capMonths.flatMap((c) => c.rows).filter((r) => r.date >= range.from && r.date <= range.to);
  const openRows = inRange.filter((r) => r.status !== "closed");
  const total = inRange.reduce((a, r) => a + r.total, 0);
  const seats = inRange.reduce((a, r) => a + r.seats, 0);
  const overDays = inRange.filter((r) => r.status === "over").length;
  const fullDays = inRange.filter((r) => r.status === "full").length;
  const peak = inRange.reduce((a, r) => (r.total > a.total ? r : a), inRange[0]);
  const single = range.days === 1 ? inRange[0] : null;
  const typeSum = (k: (typeof TYPES)[number]) => inRange.reduce((a, r) => a + r.pax[k], 0);
  const zones = zoneMonths[0]?.zones ?? [];
  const zoneRows = zones.map((z) => {
    let pax = 0, cap = 0, over = 0, full = 0;
    for (const d of inRange) {
      const zm = zoneIn(d.date);
      const p = zm.paxOf(z.id, d.date);
      const c = zm.capacityOf(z.id, d.date);
      pax += p; cap += c;
      if (c > 0 && p > c) over++;
      else if (c > 0 && p === c) full++;
    }
    return { z, pax, cap, over, full };
  });
  const pending = pendingRes.error ? [] : (pendingRes.data ?? []);
  const waitingCount = pendingRes.error ? 0 : (pendingCount.count ?? pending.length);
  const canHandle = roleCan(ctx.role, "request.handle");
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...o });
  const typeName = (k: (typeof TYPES)[number]) => (k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]);
  const href = (over: Record<string, string>) => `/dashboard?${new URLSearchParams({ restaurant: restaurantId, ...over })}`;
  const rangeLabel =
    range.days === 1
      ? fmt(range.from, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : range.view === "month"
        ? fmt(range.from, { month: "long", year: "numeric" })
        : `${fmt(range.from, { day: "numeric", month: "short" })} – ${fmt(range.to, { day: "numeric", month: "short", year: "numeric" })}`;
  const views: [RangeView, string][] = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["custom", "Custom"]];
  const viewHref = (v: RangeView) => (v === "custom" ? href({ view: "custom", from: range.from, to: range.to }) : href({ view: v, date: range.view === "custom" ? range.from : range.date }));

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["reservations", "booking_requests", "daily_capacity", "daily_zone_capacity"]} />
      <PageHeader
        title={restaurant.name}
        description={rangeLabel}
        actions={
          ctx.restaurants.length > 1 ? (
            <AutoSubmitForm>
              <input type="hidden" name="view" value={range.view} />
              <input type="hidden" name="date" value={range.date} />
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
              <Select name="restaurant" defaultValue={restaurantId} className="w-48" aria-label={t("Restaurant")}>
                {ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </AutoSubmitForm>
          ) : null
        }
      />

      {/* Period filter */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="flex rounded-lg border bg-white p-0.5">
            {views.map(([v, label]) => (
              <Link key={v} href={viewHref(v)} className={cn("rounded-md px-3 py-1 text-sm", range.view === v ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-slate-100")}>{t(label)}</Link>
            ))}
          </div>
          {range.view !== "custom" && range.prev && range.next ? (
            <div className="flex items-center gap-1">
              <Button asChild size="sm" variant="outline"><Link href={href({ view: range.view, date: range.prev })} aria-label={t("Previous")}><ChevronLeft /></Link></Button>
              <Button asChild size="sm" variant="outline"><Link href={href({ view: range.view, date: range.next })} aria-label={t("Next")}><ChevronRight /></Link></Button>
              <Button asChild size="sm" variant="ghost"><Link href={href({ view: range.view, date: today })}>{t("Today")}</Link></Button>
            </div>
          ) : (
            <form action="/dashboard" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="restaurant" value={restaurantId} />
              <input type="hidden" name="view" value="custom" />
              <label className="flex items-center gap-1.5 text-sm text-slate-700">{t("From")}<Input type="date" name="from" defaultValue={range.from} className="h-9 w-40" /></label>
              <label className="flex items-center gap-1.5 text-sm text-slate-700">{t("To")}<Input type="date" name="to" defaultValue={range.to} className="h-9 w-40" /></label>
              <Button type="submit" size="sm" variant="outline">{t("Apply")}</Button>
            </form>
          )}
          <span className="ml-auto text-sm font-medium text-slate-700">{rangeLabel}</span>
        </CardContent>
      </Card>

      {/* 1. Period summary + what is waiting for the store */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{range.days === 1 && range.from === today ? t("Today") : t("Guests")}</p>
                <p className="text-5xl font-semibold tabular-nums text-slate-900">
                  {total}<span className="text-xl font-normal text-muted"> / {seats} {t("guests")}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {single
                    ? single.status === "closed" ? t("Closed") : `${t("Seats left")} ${Math.max(0, single.left)}`
                    : `${t("Average per day")} ${openRows.length ? Math.round(total / openRows.length) : 0}${peak && peak.total ? ` · ${t("Peak day")} ${peak.total} (${fmt(peak.date, { day: "numeric", month: "short" })})` : ""}`}
                </p>
              </div>
              {single ? (
                <span className={cn("rounded-lg px-3 py-1 text-sm font-semibold", BADGE[single.status])}>{t(LABEL[single.status])}</span>
              ) : (
                <div className="flex gap-1.5 text-sm">
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">FULL {fullDays}</span>
                  <span className={cn("rounded-lg px-2.5 py-1 font-semibold", overDays ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500")}>OVER CAP {overDays}</span>
                </div>
              )}
            </div>
            <Meter pax={total} cap={seats} />
            <div className="flex flex-wrap gap-2">
              {TYPES.map((k) => (
                <span key={k} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm">
                  <span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />
                  <span className="text-muted">{typeName(k)}</span>
                  <strong className="tabular-nums text-slate-900">{typeSum(k)}</strong>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-50 text-accent-700"><PhoneCall className="size-4" /></span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("Waiting to be keyed in")}</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{waitingCount}</p>
                </div>
              </div>
              <Link href="/requests" className="text-sm font-medium text-brand-600 hover:underline">{t("View all")}</Link>
            </div>
            {pending.length === 0 ? (
              <p className="rounded-lg bg-slate-50 py-3 text-center text-sm text-muted">{t("No requests here.")}</p>
            ) : (
              <ul className="divide-y">
                {pending.map((p) => {
                  const tag = splitCustomerType(p.notes);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">{p.customer_name}</span>
                        <span className="text-xs text-muted">
                          {fmt(p.requested_date, { day: "numeric", month: "short" })} {p.requested_time.slice(0, 5)} · {p.party_size} {t("guests")}
                          {tag.type ? ` · ${CUSTOMER_TYPE_LABELS[tag.type]}` : ""}
                        </span>
                      </span>
                      {canHandle ? <Button asChild size="sm"><Link href={`/reservations/new?request=${p.id}`}>{t("Book table")}</Link></Button> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Zones */}
      {zoneRows.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t("Zones")}</h2>
            <Link href={`/availability?restaurant=${restaurantId}`} className="text-sm font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {zoneRows.map(({ z, pax, cap, over, full }) => {
              const st = single ? statusOf(pax, cap) : null;
              const room = roomById.get(z.id);
              return (
                <Card key={z.id}>
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{z.name}</p>
                      {st ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[st])}>{t(LABEL[st])}</span> : null}
                    </div>
                    <p className="text-2xl font-semibold tabular-nums text-slate-900">{pax}<span className="text-base font-normal text-muted"> / {cap} {t("guests")}</span></p>
                    <Meter pax={pax} cap={cap} />
                    <p className="text-xs text-muted">
                      {!single ? <>FULL <strong className="text-slate-800">{full}</strong> · OVER CAP <strong className={over ? "text-red-700" : "text-slate-800"}>{over}</strong> {t("days")}</> : null}
                      {single && room && range.from === today ? <>{t("Free tables")} <strong className="text-slate-800">{room.free}/{room.total}</strong></> : null}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 3. Day by day */}
      {range.days > 1 ? (
        <section className="space-y-2">
          <h2 className="font-semibold text-slate-900">{t("Day by day")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {inRange.map((d) => (
              <Link
                key={d.date}
                href={`/availability?restaurant=${restaurantId}&month=${d.date.slice(0, 7)}&date=${d.date}`}
                className={cn("rounded-xl border p-2.5 transition hover:ring-2 hover:ring-brand-300", TILE[d.status], d.date === today && "ring-2 ring-brand-500")}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-900">{fmt(d.date, { day: "numeric", month: "short" })}</span>
                  <span className="text-[11px] text-muted">{fmt(d.date, { weekday: "short" })}</span>
                </div>
                {d.status === "closed" ? (
                  <p className="mt-2 text-xs">{t("Closed")}</p>
                ) : (
                  <>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                      {d.total}<span className="text-xs font-normal text-muted">/{d.seats}</span>
                      {d.waiting ? <span className="text-xs font-medium text-accent-700"> +{d.waiting}</span> : null}
                    </p>
                    <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold", BADGE[d.status])}>{t(LABEL[d.status])}</span>
                  </>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
