import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getBookingSources, pickParam, todayIn } from "@/lib/data/common";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, StatCard } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RESERVATION_STATUSES, STATUS_META } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";
import { BranchChart } from "./branch-chart";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff("dashboard.view");
  const sp = await searchParams;
  const date = pickParam(sp.date) ?? todayIn();
  const source = pickParam(sp.source) ?? "";
  const status = (pickParam(sp.status) ?? "") as ReservationStatus | "";
  const supabase = await createClient();
  const sources = await getBookingSources();

  let q = supabase
    .from("reservations")
    .select("id, reference, restaurant_id, customer_name, party_size, reservation_time, status, booking_source_id, is_walk_in, special_occasion, allergies, reservation_tables(tables(label))")
    .in("restaurant_id", ctx.branchIds)
    .eq("reservation_date", date)
    .order("reservation_time");
  if (source) q = q.eq("booking_source_id", source);
  if (status) q = q.eq("status", status);

  const nowIso = new Date().toISOString();
  const [{ data: reservations }, { data: tables }, { data: busy }, { data: queue }] = await Promise.all([
    q,
    supabase.from("tables").select("id, restaurant_id, service_status, is_active").in("restaurant_id", ctx.branchIds).eq("is_active", true),
    supabase.rpc("table_occupancy_now", { p_restaurant_ids: ctx.branchIds, p_at: nowIso }),
    supabase.from("waitlists").select("id, restaurant_id").in("restaurant_id", ctx.branchIds).eq("queue_date", date).in("status", ["waiting", "notified"]),
  ]);

  const rows = reservations ?? [];
  const live = rows.filter((r) => r.status !== "cancelled" && r.status !== "no_show");
  const count = (s: ReservationStatus) => rows.filter((r) => r.status === s).length;
  const busyIds = new Set((busy ?? []).map((b: { table_id: string }) => b.table_id));
  const availableTables = (tables ?? []).filter((t) => t.service_status === "available" && !busyIds.has(t.id)).length;
  const restaurantName = new Map(ctx.restaurants.map((r) => [r.id, r.name]));

  const branchData = ctx.branchIds.map((id) => {
    const rs = live.filter((r) => r.restaurant_id === id);
    return { name: restaurantName.get(id) ?? "?", reservations: rs.length, covers: rs.reduce((a, r) => a + r.party_size, 0) };
  });

  const upcoming = rows.filter((r) => r.status === "pending" || r.status === "confirmed" || r.status === "arrived").slice(0, 12);

  return (
    <div>
      <LiveRefresh tables={["reservations", "waitlists", "tables"]} />
      <PageHeader
        title="Dashboard"
        description={`${ctx.selectedBranch === "all" ? `All ${ctx.restaurants.length} branches` : restaurantName.get(ctx.selectedBranch)} · ${date}`}
        actions={
          <form className="flex flex-wrap items-center gap-2">
            <Input type="date" name="date" defaultValue={date} className="w-40" aria-label="Date" />
            <Select name="source" defaultValue={source} className="w-40" aria-label="Booking source">
              <option value="">All sources</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select name="status" defaultValue={status} className="w-36" aria-label="Status">
              <option value="">All statuses</option>
              {RESERVATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Reservations" value={live.length} hint="excl. cancelled & no-show" />
        <StatCard label="Total covers" value={live.reduce((a, r) => a + r.party_size, 0)} tone="accent" />
        <StatCard label="Arrived" value={count("arrived")} tone="slate" />
        <StatCard label="Seated" value={count("seated")} tone="slate" />
        <StatCard label="Pending confirmation" value={count("pending")} tone="accent" />
        <StatCard label="Cancelled" value={count("cancelled")} tone="red" />
        <StatCard label="No-shows" value={count("no_show")} tone="red" />
        <StatCard label="Available tables now" value={`${availableTables}/${(tables ?? []).length}`} />
        <StatCard label="Walk-in queue" value={(queue ?? []).length} tone="accent" />
        <StatCard label="Completed" value={count("completed")} tone="slate" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>Branch comparison</CardTitle></CardHeader>
          <CardContent><BranchChart data={branchData} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <Link href={`/reservations?date=${date}`} className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 ? <p className="py-6 text-center text-sm text-muted">No upcoming reservations.</p> : null}
            {upcoming.map((r) => (
              <Link key={r.id} href={`/reservations/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <span className="w-12 text-sm font-semibold tabular-nums text-slate-700">{r.reservation_time.slice(0, 5)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.customer_name} · {r.party_size}p</p>
                  <p className="truncate text-xs text-muted">
                    {restaurantName.get(r.restaurant_id)}
                    {r.reservation_tables?.length ? ` · ${r.reservation_tables.map((t) => t.tables?.label).join("+")}` : " · unassigned"}
                    {r.allergies ? " · ⚠ allergy" : ""}
                    {r.special_occasion ? ` · ${r.special_occasion}` : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
