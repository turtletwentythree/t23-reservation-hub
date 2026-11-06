import Link from "next/link";
import { getStaffT } from "@/lib/i18n/staff-server";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn, DEFAULT_TZ } from "@/lib/data/common";
import { localToUtc } from "@/lib/domain/availability";
import { formatInTimeZone } from "date-fns-tz";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LiveRefresh } from "@/components/live-refresh";
import { FloorPlan, type FPTable } from "./floor-plan";

export const metadata = { title: "Floor plan" };

export default async function FloorPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.view", "floor-plan");
  const sp = await searchParams;
  const restaurantId = [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const tz = restaurant.timezone ?? DEFAULT_TZ;
  const date = pickParam(sp.date) ?? todayIn(tz);
  const time = pickParam(sp.time) ?? (date === todayIn(tz) ? formatInTimeZone(new Date(), tz, "HH:mm") : "19:00");
  const at = localToUtc(date, time, tz).getTime();
  const editMode = pickParam(sp.edit) === "1" && roleCan(ctx.role, "table.layout");

  const supabase = await createClient();
  const [{ data: areas }, { data: tables }, { data: combos }, { data: res }] = await Promise.all([
    supabase.from("restaurant_areas").select("id, name, canvas_width, canvas_height").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
    supabase.from("tables").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("table_combinations").select("id, name, min_capacity, max_capacity, table_combination_members(table_id)").eq("restaurant_id", restaurantId),
    supabase
      .from("reservations")
      .select("id, reference, customer_name, party_size, reservation_time, status, starts_at, ends_at, allergies, customers(is_vip), reservation_tables(table_id)")
      .eq("restaurant_id", restaurantId)
      .eq("reservation_date", date)
      .not("status", "in", "(cancelled,no_show)")
      .order("reservation_time"),
  ]);

  return (
    <div>
      <LiveRefresh tables={["reservations", "reservation_tables", "tables"]} />
      <PageHeader
        title={`${t("Floor plan")} · ${restaurant.name}`}
        description={t("Live table status. Click a table to seat, check in or change its status.")}
        actions={
          <form className="flex flex-wrap items-center gap-2">
            {ctx.restaurants.length > 1 ? (
              <Select name="restaurant" defaultValue={restaurantId} className="w-44">
                {ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            ) : null}
            <Input type="date" name="date" defaultValue={date} className="w-40" />
            <Input type="time" name="time" defaultValue={time} className="w-28" />
            {editMode ? <input type="hidden" name="edit" value="1" /> : null}
            <Button type="submit" variant="outline">{t("Show")}</Button>
            {roleCan(ctx.role, "table.layout") ? (
              <Button asChild variant={editMode ? "default" : "outline"}>
                <Link href={`/floor-plan?restaurant=${restaurantId}&date=${date}&time=${time}${editMode ? "" : "&edit=1"}`}>{editMode ? t("Done editing") : t("Edit layout")}</Link>
              </Button>
            ) : null}
          </form>
        }
      />
      {(areas ?? []).length === 0 ? (
        <EmptyState title={t("No dining areas yet")} description={t("Add an area in the layout editor to start placing tables.")} />
      ) : (
        <FloorPlan
          key={(tables ?? []).map((t) => t.id + t.updated_at).join() + (areas ?? []).length}
          restaurantId={restaurantId}
          areas={areas ?? []}
          tables={(tables ?? []) as FPTable[]}
          combinations={(combos ?? []).map((c) => ({ id: c.id, name: c.name, min_capacity: c.min_capacity, max_capacity: c.max_capacity, table_ids: c.table_combination_members.map((m) => m.table_id) }))}
          reservations={(res ?? []).map((r) => ({
            id: r.id, reference: r.reference, customer_name: r.customer_name, party_size: r.party_size, time: r.reservation_time.slice(0, 5), status: r.status,
            starts: new Date(r.starts_at).getTime(), ends: new Date(r.ends_at).getTime(), table_ids: r.reservation_tables.map((t) => t.table_id), allergies: r.allergies, is_vip: Boolean(r.customers?.is_vip),
          }))}
          at={at}
          date={date}
          canLayout={roleCan(ctx.role, "table.layout")}
          canOperate={roleCan(ctx.role, "table.status")}
          editMode={editMode}
        />
      )}
    </div>
  );
}
