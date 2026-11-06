import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { estimateWaits } from "@/lib/domain/wait-estimate";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { WaitlistBoard } from "./waitlist-board";

export const metadata = { title: "Waitlist" };

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.view");
  const sp = await searchParams;
  const restaurantId = [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ctx.restaurants.some((r) => r.id === x)) ?? ctx.restaurants[0]?.id;
  if (!restaurantId) return <EmptyState title="No restaurant access" />;
  const restaurant = ctx.restaurants.find((r) => r.id === restaurantId)!;
  const date = pickParam(sp.date) ?? todayIn(restaurant.timezone);
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: entries }, { data: tables }, { data: occ }] = await Promise.all([
    supabase.from("waitlists").select("*").eq("restaurant_id", restaurantId).eq("queue_date", date).order("queue_number"),
    supabase.from("tables").select("id, label, min_capacity, max_capacity, service_status, is_active").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
    supabase.rpc("table_occupancy", { p_restaurant_id: restaurantId, p_from: nowIso, p_to: new Date(Date.now() + 6 * 3600_000).toISOString() }),
  ]);
  const active = (entries ?? []).filter((e) => e.status === "waiting" || e.status === "notified");
  const history = (entries ?? []).filter((e) => !(e.status === "waiting" || e.status === "notified"));
  const now = Date.now();
  // Busy = occupied now or starting within 90 min (so we don't seat a walk-in on a table about to be needed).
  const busyNow = (occ ?? []).filter((o) => new Date(o.starts).getTime() <= now + 90 * 60_000);
  const busyIds = new Set(busyNow.map((o) => o.table_id));
  const estimates = estimateWaits(
    active.map((e) => ({ id: e.id, party_size: e.party_size })),
    (tables ?? []).map((t) => ({ id: t.id, min_capacity: t.min_capacity, max_capacity: t.max_capacity, usable: t.service_status !== "out_of_service" })),
    busyNow.map((o) => ({ table_id: o.table_id, until: new Date(o.ends).getTime() })),
    now,
  );
  const freeTables = (tables ?? []).filter((t) => t.service_status === "available" && !busyIds.has(t.id));

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["waitlists", "reservations"]} />
      <PageHeader
        title={`${t("Walk-in & waitlist")} · ${restaurant.name}`}
        description={`${active.length} ${t("waiting")} · ${freeTables.length} ${t("tables free now")}`}
        actions={
          <form className="flex gap-2">
            {ctx.restaurants.length > 1 ? (
              <Select name="restaurant" defaultValue={restaurantId} className="w-44">{ctx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
            ) : null}
            <Input type="date" name="date" defaultValue={date} className="w-40" />
            <Button variant="outline">Show</Button>
          </form>
        }
      />
      <WaitlistBoard
        restaurantId={restaurantId}
        canWrite={roleCan(ctx.role, "waitlist.write") && date === todayIn(restaurant.timezone)}
        freeTables={freeTables.map((t) => ({ id: t.id, label: t.label, max_capacity: t.max_capacity }))}
        entries={active.map((e) => ({ ...e, estimate: estimates.get(e.id) ?? null }))}
      />
      <Card>
        <CardHeader><CardTitle>Queue history · {date}</CardTitle></CardHeader>
        <CardContent>
          <DataTable>
            <thead><tr><Th>#</Th><Th>Guest</Th><Th>Party</Th><Th>Joined</Th><Th>Outcome</Th><Th>Waited</Th></tr></thead>
            <tbody>
              {history.map((h) => {
                const endAt = h.seated_at ?? h.left_at;
                return (
                  <tr key={h.id}>
                    <Td>{h.queue_number}</Td>
                    <Td>{h.customer_name}</Td>
                    <Td>{h.party_size}</Td>
                    <Td className="text-xs">{new Date(h.joined_at).toLocaleTimeString("en-GB", { timeZone: restaurant.timezone, hour: "2-digit", minute: "2-digit" })}</Td>
                    <Td><Badge tone={h.status === "seated" ? "green" : "slate"}>{h.status}</Badge></Td>
                    <Td className="tabular-nums">{endAt ? `${Math.round((new Date(endAt).getTime() - new Date(h.joined_at).getTime()) / 60000)} min` : "—"}</Td>
                  </tr>
                );
              })}
              {history.length === 0 ? <tr><Td colSpan={6} className="py-6 text-center text-muted">No completed queue entries.</Td></tr> : null}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
