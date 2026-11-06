import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { addDays, pickParam, todayIn } from "@/lib/data/common";
import { buildReport } from "@/lib/data/reports";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, StatCard } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, cn } from "@/lib/utils";
import { PeakChart, TrendChart } from "./charts";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff("report.view");
  const sp = await searchParams;
  const today = todayIn();
  const preset = pickParam(sp.preset) ?? (pickParam(sp.from) ? "custom" : "month");
  let from = pickParam(sp.from) ?? addDays(today, -29);
  let to = pickParam(sp.to) ?? today;
  if (preset === "day") { from = to = pickParam(sp.date) ?? today; }
  if (preset === "week") { from = addDays(today, -6); to = today; }
  if (preset === "month") { from = addDays(today, -29); to = today; }
  const r = await buildReport(ctx.branchIds, from, to);
  const s = r.summary;
  const qs = `from=${from}&to=${to}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & analytics"
        description={`${from} → ${to} · ${ctx.selectedBranch === "all" ? "all branches" : ctx.restaurants.find((x) => x.id === ctx.selectedBranch)?.name} · calculated from ${r.rowCount} reservation records`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/export/report?${qs}&format=csv`}><Download /> CSV</a></Button>
            <Button asChild variant="outline"><a href={`/api/export/report?${qs}&format=xlsx`}><Download /> Excel</a></Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {[["day", "Daily"], ["week", "Weekly (7 days)"], ["month", "Monthly (30 days)"]].map(([k, l]) => (
          <Link key={k} href={`/reports?preset=${k}`} className={cn("rounded-full border px-3 py-1 text-sm", preset === k ? "border-brand-500 bg-brand-500 text-white" : "bg-white")}>{l}</Link>
        ))}
        <form className="flex items-center gap-2">
          <input type="hidden" name="preset" value="custom" />
          <Input type="date" name="from" defaultValue={from} className="w-40" />
          <Input type="date" name="to" defaultValue={to} className="w-40" />
          <Button variant="outline" size="sm">Apply</Button>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Total reservations" value={s.totalReservations} hint="all statuses" />
        <StatCard label="Total covers" value={s.covers} tone="accent" hint="excl. cancelled/no-show" />
        <StatCard label="Occupancy rate" value={`${s.occupancyRate}%`} hint="booked seat-min ÷ open seat-min" />
        <StatCard label="Avg party size" value={s.avgPartySize} tone="slate" />
        <StatCard label="Cancellation rate" value={`${s.cancellationRate}%`} tone="red" hint={`${s.cancelled} cancelled`} />
        <StatCard label="No-show rate" value={`${s.noShowRate}%`} tone="red" hint={`${s.noShows} of non-cancelled`} />
        <StatCard label="Repeat guest rate" value={`${s.repeatCustomerRate}%`} hint={`${s.uniqueGuests} guests; repeat = 2+ visits`} />
        <StatCard label="Recorded payments" value={formatMoney(r.payments.net)} tone="slate" hint="deposits/fees net of refunds" />
        <StatCard label="POS revenue" value="—" tone="slate" hint="Pending FoodStory integration — not estimated" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Daily trend</CardTitle></CardHeader><CardContent><TrendChart data={r.trend} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Peak booking hours</CardTitle></CardHeader><CardContent><PeakChart data={r.peaks} /></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Branch performance</CardTitle></CardHeader>
        <CardContent>
          <DataTable>
            <thead><tr><Th>Restaurant</Th><Th>Reservations</Th><Th>Covers</Th><Th>Occupancy</Th><Th>Avg party</Th><Th>Cancel %</Th><Th>No-show %</Th><Th>Repeat %</Th></tr></thead>
            <tbody>{r.branches.map((b) => (
              <tr key={b.restaurant}><Td className="font-medium">{b.restaurant}</Td><Td>{b.totalReservations}</Td><Td>{b.covers}</Td><Td>{b.occupancyRate}%</Td><Td>{b.avgPartySize}</Td><Td>{b.cancellationRate}%</Td><Td>{b.noShowRate}%</Td><Td>{b.repeatCustomerRate}%</Td></tr>
            ))}</tbody>
          </DataTable>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Booking source performance</CardTitle></CardHeader>
        <CardContent>
          <DataTable>
            <thead><tr><Th>Source</Th><Th>Reservations</Th><Th>Covers</Th><Th>Cancel %</Th><Th>No-show %</Th></tr></thead>
            <tbody>{r.sources.map((x) => <tr key={x.source}><Td className="font-medium">{x.source}</Td><Td>{x.reservations}</Td><Td>{x.covers}</Td><Td>{x.cancellationRate}%</Td><Td>{x.noShowRate}%</Td></tr>)}</tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
