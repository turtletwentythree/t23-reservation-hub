import Link from "next/link";
import { PhoneCall } from "lucide-react";
import type { StaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayIn } from "@/lib/data/common";
import { loadAreas, loadCapacityMonth, loadZoneMonth } from "@/lib/data/capacity";
import { loadOccupancy } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard, summarizeRooms } from "@/lib/domain/availability-board";
import { shiftMonth, type CapacityDay, type CapacityStatus } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
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

export async function InterimDashboard({ ctx, restaurantParam }: { ctx: StaffContext; restaurantParam?: string }) {
  const { t, locale } = await getStaffT();
  const dl = STAFF_DATE_LOCALES[locale];
  const restaurantId = [restaurantParam, ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const month = today.slice(0, 7);
  const supabase = await createClient();

  // This month plus next month, so the next 14 days work at month end.
  const [cur, next, pendingRes, pendingCount] = await Promise.all([
    loadCapacityMonth(supabase, restaurantId, month),
    loadCapacityMonth(supabase, restaurantId, shiftMonth(month, 1)),
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
  const [occupancy, areas, zm] = await Promise.all([
    loadOccupancy(supabase, restaurantId, today, restaurant.timezone),
    loadAreas(supabase, restaurantId),
    loadZoneMonth(supabase, restaurantId, month, cur.config),
  ]);
  const board = buildAvailabilityBoard({
    date: today,
    partySize: 1,
    timezone: restaurant.timezone,
    policy: cur.config.policy,
    hours: cur.config.hours,
    tables: cur.config.tables,
    combinations: cur.config.combinations,
    occupancy,
    now: new Date(),
  });
  const nowIdx = board.ok ? Math.max(0, board.slots.findIndex((s) => !s.past)) : 0;
  const rooms = board.ok ? summarizeRooms(board, new Map(cur.config.tables.map((x) => [x.id, x.area_id])), areas, nowIdx) : [];
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const all = [...cur.rows, ...next.rows];
  const todayRow = all.find((r) => r.date === today)!;
  const coming: CapacityDay[] = all.filter((r) => r.date > today && r.date <= addDays(today, 14));
  const monthTotal = cur.rows.reduce((a, r) => a + r.total, 0);
  const overDays = cur.rows.filter((r) => r.status === "over").length;
  const fullDays = cur.rows.filter((r) => r.status === "full").length;
  const peak = cur.rows.reduce((a, r) => (r.total > a.total ? r : a), cur.rows[0]);
  const pending = pendingRes.error ? [] : (pendingRes.data ?? []);
  const waitingCount = pendingRes.error ? 0 : (pendingCount.count ?? pending.length);
  const canHandle = roleCan(ctx.role, "request.handle");
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...o });
  const typeName = (k: (typeof TYPES)[number]) => (k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]);

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["reservations", "booking_requests", "daily_capacity", "daily_zone_capacity"]} />
      <PageHeader
        title={restaurant.name}
        description={fmt(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          ctx.restaurants.length > 1 ? (
            <AutoSubmitForm>
              <Select name="restaurant" defaultValue={restaurantId} className="w-48" aria-label={t("Restaurant")}>
                {ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </AutoSubmitForm>
          ) : null
        }
      />

      {/* 1. Today at a glance + what is waiting for the store */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("Today")}</p>
                <p className="text-5xl font-semibold tabular-nums text-slate-900">
                  {todayRow.total}<span className="text-xl font-normal text-muted"> / {todayRow.seats} {t("guests")}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {todayRow.status === "closed" ? t("Closed") : `${t("Seats left")} ${Math.max(0, todayRow.left)}`}
                </p>
              </div>
              <span className={cn("rounded-lg px-3 py-1 text-sm font-semibold", BADGE[todayRow.status])}>{t(LABEL[todayRow.status])}</span>
            </div>
            <Meter pax={todayRow.total} cap={todayRow.seats} />
            <div className="flex flex-wrap gap-2">
              {TYPES.map((k) => (
                <span key={k} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm">
                  <span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />
                  <span className="text-muted">{typeName(k)}</span>
                  <strong className="tabular-nums text-slate-900">{todayRow.pax[k]}</strong>
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

      {/* 2. Zones today */}
      {zm.zones.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t("Zones")} · {t("Today")}{board.ok ? ` ${board.slots[nowIdx]?.time ?? ""}` : ""}</h2>
            <Link href={`/availability?restaurant=${restaurantId}`} className="text-sm font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {zm.zones.map((z) => {
              const pax = zm.paxOf(z.id, today);
              const cap = zm.capacityOf(z.id, today);
              const st = statusOf(pax, cap);
              const room = roomById.get(z.id);
              return (
                <Card key={z.id}>
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{z.name}</p>
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[st])}>{t(LABEL[st])}</span>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums text-slate-900">{pax}<span className="text-base font-normal text-muted"> / {cap} {t("guests")}</span></p>
                    <Meter pax={pax} cap={cap} />
                    {room ? <p className="text-xs text-muted">{t("Free tables")} <strong className="text-slate-800">{room.free}/{room.total}</strong></p> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 3. Next two weeks */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{t("Next 14 days")}</h2>
          <Link href={`/availability?restaurant=${restaurantId}`} className="text-sm font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {coming.map((d) => (
            <Link
              key={d.date}
              href={`/availability?restaurant=${restaurantId}&month=${d.date.slice(0, 7)}&date=${d.date}`}
              className={cn("rounded-xl border p-2.5 transition hover:ring-2 hover:ring-brand-300", TILE[d.status])}
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

      {/* 4. This month */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-900">{t("This month")} · {fmt(`${month}-01`, { month: "long", year: "numeric" })}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-muted">{t("Total")}</p><p className="text-2xl font-semibold tabular-nums text-slate-900">{monthTotal}</p></div>
          <div className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-muted">{t("Peak day")}</p><p className="text-2xl font-semibold tabular-nums text-slate-900">{peak ? peak.total : "—"}{peak ? <span className="text-sm font-normal text-muted"> · {fmt(peak.date, { day: "numeric", month: "short" })}</span> : null}</p></div>
          <div className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-muted">FULL</p><p className="text-2xl font-semibold tabular-nums text-amber-700">{fullDays}<span className="text-sm font-normal text-muted"> {t("days")}</span></p></div>
          <div className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-muted">OVER CAP</p><p className={cn("text-2xl font-semibold tabular-nums", overDays ? "text-red-700" : "text-slate-900")}>{overDays}<span className="text-sm font-normal text-muted"> {t("days")}</span></p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((k) => (
            <span key={k} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm">
              <span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />
              <span className="text-muted">{typeName(k)}</span>
              <strong className="tabular-nums text-slate-900">{cur.rows.reduce((a, r) => a + r.pax[k], 0)}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
