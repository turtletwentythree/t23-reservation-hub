import Link from "next/link";
import type { StaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayIn } from "@/lib/data/common";
import { loadAreas, loadCapacityMonth, loadZoneMonth } from "@/lib/data/capacity";
import { loadOccupancy } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard, summarizeRooms } from "@/lib/domain/availability-board";
import { RoomStatus } from "@/components/room-status";
import { shiftMonth, type CapacityDay } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

const TYPE_COLORS = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" } as const;
const STATUS_CLS = {
  ok: "bg-emerald-100 text-emerald-800",
  full: "bg-amber-100 text-amber-800",
  over: "bg-red-100 text-red-700",
  closed: "bg-slate-100 text-slate-500",
} as const;
const STATUS_LABEL = { ok: "OK", full: "FULL", over: "OVER CAP", closed: "Closed" } as const;

function Bar({ day }: { day: CapacityDay }) {
  const cap = Math.max(day.seats, day.total, 1);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {(["internal", "kol", "media", "other"] as const).map((k) =>
        day.pax[k] ? <span key={k} className={TYPE_COLORS[k]} style={{ width: `${(day.pax[k] / cap) * 100}%` }} /> : null,
      )}
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

  // This month plus next month, so "next 14 days" works at month end.
  const [cur, next, pendingRes] = await Promise.all([
    loadCapacityMonth(supabase, restaurantId, month),
    loadCapacityMonth(supabase, restaurantId, shiftMonth(month, 1)),
    supabase
      .from("booking_requests")
      .select("id, customer_name, channel, party_size, requested_date, requested_time, notes")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .order("requested_date")
      .order("requested_time")
      .limit(8),
  ]);
  const [occupancy, areas] = await Promise.all([loadOccupancy(supabase, restaurantId, today, restaurant.timezone), loadAreas(supabase, restaurantId)]);
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
  const zm = await loadZoneMonth(supabase, restaurantId, month, cur.config);
  const zoneGuests = new Map(zm.zones.map((z) => [z.id, { pax: zm.paxOf(z.id, today), cap: zm.capacityOf(z.id, today) }]));
  const all = [...cur.rows, ...next.rows];
  const todayRow = all.find((r) => r.date === today)!;
  const coming = all.filter((r) => r.date >= today && r.date <= addDays(today, 13));
  const sum = (k: "internal" | "kol" | "media" | "other") => cur.rows.reduce((a, r) => a + r.pax[k], 0);
  const monthTotal = cur.rows.reduce((a, r) => a + r.total, 0);
  const overDays = cur.rows.filter((r) => r.status === "over").length;
  const fullDays = cur.rows.filter((r) => r.status === "full").length;
  const peak = cur.rows.reduce((a, r) => (r.total > a.total ? r : a), cur.rows[0]);
  const pending = pendingRes.error ? [] : (pendingRes.data ?? []);
  const canHandle = roleCan(ctx.role, "request.handle");
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...o });
  const pct = todayRow.seats ? Math.min(100, Math.round((todayRow.total / todayRow.seats) * 100)) : 0;

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["reservations", "booking_requests", "daily_capacity"]} />
      <PageHeader
        title={`${t("Dashboard")} · ${restaurant.name}`}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("Today")}</p>
                <p className="text-4xl font-semibold tabular-nums text-slate-900">
                  {todayRow.total}<span className="text-xl font-normal text-muted"> / {todayRow.seats} {t("guests")}</span>
                </p>
                <p className="text-sm text-muted">
                  {todayRow.status === "closed" ? t("Closed") : `${t("Seats left")} ${todayRow.left}`}
                  {todayRow.waiting ? <span className="text-accent-700"> · +{todayRow.waiting} {t("waiting to be keyed in")}</span> : null}
                </p>
              </div>
              <span className={cn("rounded-lg px-3 py-1 text-sm font-semibold", STATUS_CLS[todayRow.status])}>{t(STATUS_LABEL[todayRow.status])}</span>
            </div>
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={cn("h-full rounded-full", todayRow.status === "over" ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["internal", "kol", "media", "other"] as const).map((k) => (
                <div key={k} className="rounded-lg bg-slate-50 py-2">
                  <p className="text-xl font-semibold tabular-nums text-slate-900">{todayRow.pax[k]}</p>
                  <p className="flex items-center justify-center gap-1 text-xs text-muted">
                    <span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />
                    {k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Waiting to be keyed in")}</CardTitle>
            <Link href="/requests" className="text-sm font-medium text-brand-600 hover:underline">{t("View all")}</Link>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">{t("No requests here.")}</p>
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
                          {tag.type ? ` · ${CUSTOMER_TYPE_LABELS[tag.type]}` : ""} · {p.channel === "line" ? "LINE" : "Phone"}
                        </span>
                      </span>
                      {canHandle ? (
                        <Button asChild size="sm"><Link href={`/reservations/new?request=${p.id}`}>{t("Book table")}</Link></Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("Rooms and tables")}{board.ok ? ` · ${t("Today")} ${board.slots[nowIdx]?.time ?? ""}` : ""}</CardTitle>
          <Link href={`/availability?restaurant=${restaurantId}`} className="text-sm font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>
        </CardHeader>
        <CardContent>
          {board.ok ? <RoomStatus rooms={rooms} t={t} guests={zoneGuests} /> : <p className="py-3 text-center text-sm text-muted">{t("Closed on this day")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("Next 14 days")}</CardTitle>
          <Link href={`/availability?restaurant=${restaurantId}`} className="text-sm font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {coming.map((d) => (
              <li key={d.date}>
                <Link href={`/availability?restaurant=${restaurantId}&month=${d.date.slice(0, 7)}&date=${d.date}`} className="grid grid-cols-[6.5rem_1fr_6rem_5.5rem] items-center gap-3 rounded-lg px-1 py-1 text-sm hover:bg-slate-50">
                  <span className="tabular-nums text-slate-700">{fmt(d.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <Bar day={d} />
                  <span className="text-right tabular-nums text-slate-900">
                    {d.total}/{d.seats}
                    {d.waiting ? <span className="text-xs text-accent-700"> +{d.waiting}</span> : null}
                  </span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-center text-xs font-semibold", STATUS_CLS[d.status])}>{t(STATUS_LABEL[d.status])}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            {(["internal", "kol", "media", "other"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1"><span className={cn("size-2 rounded-full", TYPE_COLORS[k])} />{k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("This month")} · {fmt(`${month}-01`, { month: "long", year: "numeric" })}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            ["Internal", sum("internal")],
            ["KOL", sum("kol")],
            ["Media", sum("media")],
            [t("Other"), sum("other")],
            [t("Total"), monthTotal],
            [t("Peak day"), peak ? `${peak.total} (${fmt(peak.date, { day: "numeric" })})` : "—"],
            ["FULL", `${fullDays} ${t("days")}`],
            ["OVER CAP", `${overDays} ${t("days")}`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-muted">{label}</p>
              <p className={cn("text-lg font-semibold tabular-nums text-slate-900", label === "OVER CAP" && overDays ? "text-red-700" : "")}>{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
