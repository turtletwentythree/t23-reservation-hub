import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { loadOccupancy } from "@/lib/domain/reservation-service";
import { buildAvailabilityBoard, summarizeRooms } from "@/lib/domain/availability-board";
import { shiftMonth } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";
import { loadAreas, loadCapacityMonth } from "@/lib/data/capacity";
import type { PlanMarker } from "@/components/floor-plan-map";
import { floorPlanFor } from "@/lib/floor-plans";
import { daysOfMonth } from "@/lib/domain/table-month";
import { EmptyState } from "@/components/ui/card";
import { LiveRefresh } from "@/components/live-refresh";
import { AvailabilityView, type DayBooking } from "./view";

export const metadata = { title: "Table availability" };

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

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
  // All queries run at once, to keep clicks fast.
  const [cap, occupancy, areas, { data: monthRes }] = await Promise.all([
    loadCapacityMonth(supabase, restaurantId, month),
    loadOccupancy(supabase, restaurantId, date, restaurant.timezone),
    loadAreas(supabase, restaurantId),
    supabase
      .from("reservations")
      .select("id, reservation_date, reservation_time, duration_minutes, customer_name, party_size, status, internal_notes, reservation_tables(table_id)")
      .eq("restaurant_id", restaurantId)
      .eq("reservation_date", date)
      .not("status", "in", "(cancelled,no_show)"),
  ]);
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
  const slotIdx = board.ok ? Math.max(0, board.slots.findIndex((s) => (timeParam ? s.time === timeParam : !s.past))) : 0;
  const slot = board.ok ? board.slots[slotIdx] : undefined;
  const rooms = board.ok ? summarizeRooms(board, new Map(cap.config.tables.map((x) => [x.id, x.area_id])), areas, slotIdx) : [];
  // The chosen day's bookings, with table and room names.
  const activeTables = cap.config.tables.filter((x) => x.is_active);
  const tableById = new Map(cap.config.tables.map((x) => [x.id, x]));
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const bookingsByDay: Record<string, DayBooking[]> = {};
  for (const r of monthRes ?? []) {
    const tbs = (r.reservation_tables ?? []).map((x: { table_id: string }) => tableById.get(x.table_id)).filter((x): x is NonNullable<typeof x> => !!x);
    const start = Number(r.reservation_time.slice(0, 2)) * 60 + Number(r.reservation_time.slice(3, 5));
    (bookingsByDay[r.reservation_date] ??= []).push({
      id: r.id,
      time: r.reservation_time.slice(0, 5),
      end: hhmm(start + (r.duration_minutes || 120)),
      name: r.customer_name,
      party: r.party_size,
      type: splitCustomerType(r.internal_notes).type,
      status: r.status,
      tables: tbs.map((x) => x.label).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(" + "),
      room: [...new Set(tbs.map((x) => (x.area_id ? areaName.get(x.area_id) : null)).filter(Boolean))].join(", "),
    });
  }
  for (const list of Object.values(bookingsByDay)) list.sort((a, b) => a.time.localeCompare(b.time) || a.tables.localeCompare(b.tables, undefined, { numeric: true }));

  const plan = floorPlanFor(restaurant.slug);
  const stateById = new Map(rooms.flatMap((r) => r.tables.map((x) => [x.id, x.state] as const)));
  const planMarkers: PlanMarker[] = activeTables
    .filter((x) => stateById.has(x.id))
    .map((x) => ({ id: x.id, label: x.label, capacity: x.max_capacity, x: x.pos_x, y: x.pos_y, w: x.width, h: x.height, state: stateById.get(x.id)! }));
  const canBook = roleCan(ctx.role, "reservation.write") && ctx.pages.includes("reservations");

  return (
    <>
      <LiveRefresh tables={["reservations", "reservation_tables", "booking_requests", "daily_capacity"]} />
      <AvailabilityView
        t={t}
        fmt={(d, o) => new Date(`${d}T12:00:00Z`).toLocaleDateString(dl, { timeZone: "UTC", ...o })}
        typeLabel={(k) => (k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k as keyof typeof CUSTOMER_TYPE_LABELS] ?? k)}
        restaurant={{ id: restaurant.id, name: restaurant.name }}
        restaurants={ctx.restaurants.map((r) => ({ id: r.id, name: r.name }))}
        today={today}
        date={date}
        month={month}
        party={party}
        prevMonth={shiftMonth(month, -1)}
        nextMonth={shiftMonth(month, 1)}
        monthEnd={daysOfMonth(month).at(-1)!}
        days={cap.rows}
        slots={board.ok ? board.slots : null}
        slot={slot}
        plan={plan ?? null}
        planMarkers={planMarkers}
        bookingsByDay={bookingsByDay}
        canBook={canBook}
        canRequest={roleCan(ctx.role, "request.create") && ctx.pages.includes("requests") && !canBook}
        canExport={roleCan(ctx.role, "reservation.view")}
        canOpenReservations={ctx.pages.includes("reservations") && roleCan(ctx.role, "reservation.view")}
      />
    </>
  );
}
