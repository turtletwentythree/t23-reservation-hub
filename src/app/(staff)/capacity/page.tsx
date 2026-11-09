import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { STAFF_DATE_LOCALES } from "@/lib/i18n/staff";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { loadCapacityMonth, loadZoneMonth } from "@/lib/data/capacity";
import { shiftMonth } from "@/lib/domain/capacity-check";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { CapacityEditor } from "./capacity-editor";

export const metadata = { title: "Daily capacity" };

export default async function CapacityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getStaffT();
  const ctx = await requireStaff("restaurant.manage", "capacity");
  const sp = await searchParams;
  const restaurantId = [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title={t("No restaurant access")} />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const today = todayIn(restaurant.timezone);
  const monthParam = pickParam(sp.month);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const supabase = await createClient();
  const data = await loadCapacityMonth(supabase, restaurantId, month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
  const { data: holidayRows } = await supabase.from("operating_hours").select("specific_date").eq("restaurant_id", restaurantId).eq("is_closed", true).gte("specific_date", monthStart).lte("specific_date", monthEnd);
  const holidays = new Set((holidayRows ?? []).map((h) => h.specific_date as string));
  const zm = await loadZoneMonth(supabase, restaurantId, month, data.config);
  const link = (m: string) => `/capacity?restaurant=${restaurantId}&month=${m}`;
  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(STAFF_DATE_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t("Daily capacity")} · ${restaurant.name}`}
        description={t("How many guests this restaurant accepts each day. The Call Center and the store see FULL / OVER CAP against this number.")}
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
      {!zm.installed && zm.zones.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("Zone capacity is not set up yet. Ask the Admin to run the latest database update (zone-capacity.sql) in Supabase.")}
        </p>
      ) : null}
      {!data.settings.installed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("Daily capacity is not set up yet. Ask the Admin to run the latest database update (daily-capacity.sql) in Supabase.")}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link href={link(shiftMonth(month, -1))} aria-label={t("Previous month")}><ChevronLeft /></Link></Button>
        <span className="min-w-36 text-center font-semibold text-slate-900">{monthLabel}</span>
        <Button asChild size="sm" variant="outline"><Link href={link(shiftMonth(month, 1))} aria-label={t("Next month")}><ChevronRight /></Link></Button>
      </div>
      <CapacityEditor
        key={`${restaurantId}-${month}`}
        restaurantId={restaurantId}
        month={month}
        today={today}
        locale={STAFF_DATE_LOCALES[locale]}
        zones={zm.zones.map((z) => ({ id: z.id, name: z.name, defaultCapacity: z.defaultCapacity, tableSeats: z.tableSeats }))}
        zoneDays={data.rows.map((r) => ({
          day: r.date,
          cells: Object.fromEntries(zm.zones.map((z) => [z.id, { value: zm.overrides.get(`${z.id}|${r.date}`) ?? null, booked: zm.paxOf(z.id, r.date) }])),
        }))}
        tableList={data.config.tables
          .filter((x) => x.is_active)
          .map((x) => ({ id: x.id, label: x.label, zone: zm.zones.find((z) => z.id === x.area_id)?.name ?? "—", seats: x.max_capacity }))}
        tableSeats={data.seatsFromTables}
        defaultCapacity={data.settings.defaultCapacity}
        days={data.rows.map((r) => ({
          day: r.date,
          booked: r.total,
          waiting: r.waiting,
          closed: holidays.has(r.date),
          capacity: data.settings.overrides.get(r.date)?.capacity ?? null,
          note: data.settings.overrides.get(r.date)?.note ?? "",
        }))}
      />
    </div>
  );
}
