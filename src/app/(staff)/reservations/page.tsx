import Link from "next/link";
import { getStaffT } from "@/lib/i18n/staff-server";
import { Plus, Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, getBookingSources, pickParam, todayIn } from "@/lib/data/common";
import { DataTable, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { RESERVATION_STATUSES, STATUS_META } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Reservations" };
const PAGE_SIZE = 50;
const SORTS = { time: "starts_at", created: "created_at", party: "party_size", name: "customer_name" } as const;

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.view");
  const sp = await searchParams;
  const from = pickParam(sp.from) ?? pickParam(sp.date) ?? todayIn();
  const to = pickParam(sp.to) ?? pickParam(sp.date) ?? addDays(from, 6);
  const status = pickParam(sp.status) ?? "";
  const source = pickParam(sp.source) ?? "";
  const q = (pickParam(sp.q) ?? "").trim();
  const sortKey = (pickParam(sp.sort) ?? "time") as keyof typeof SORTS;
  const dir = pickParam(sp.dir) === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(pickParam(sp.page) ?? 1));

  const supabase = await createClient();
  const sources = await getBookingSources();
  let query = supabase
    .from("reservations")
    .select("id, reference, restaurant_id, customer_name, phone, party_size, reservation_date, reservation_time, status, booking_source_id, allergies, special_occasion, deposit_amount, payment_status, customers(is_vip), reservation_tables(tables(label))", { count: "exact" })
    .in("restaurant_id", ctx.branchIds)
    .gte("reservation_date", from)
    .lte("reservation_date", to);
  if (status) query = query.eq("status", status as ReservationStatus);
  if (source) query = query.eq("booking_source_id", source);
  if (q) {
    const safe = q.replace(/[%_,()]/g, " ");
    query = query.or(`customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,reference.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data, count } = await query
    .order(SORTS[sortKey] ?? "starts_at", { ascending: dir === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const names = new Map(ctx.restaurants.map((r) => [r.id, r.name]));
  const sourceNames = new Map(sources.map((s) => [s.id, s.name]));
  const params = new URLSearchParams(Object.entries({ from, to, status, source, q, sort: sortKey, dir }).filter(([, v]) => v) as [string, string][]);
  const sortLink = (k: string) => {
    const p = new URLSearchParams(params);
    p.set("sort", k);
    p.set("dir", sortKey === k && dir === "asc" ? "desc" : "asc");
    return `?${p}`;
  };
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div>
      <LiveRefresh tables={["reservations"]} />
      <PageHeader
        title={t("Reservations")}
        description={`${count ?? 0} ${t("reservations")} · ${from} → ${to}`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/export/reservations?${params}`}><Download /> CSV</a></Button>
            {roleCan(ctx.role, "reservation.write") ? (
              <Button asChild><Link href="/reservations/new"><Plus /> New reservation</Link></Button>
            ) : null}
          </>
        }
      />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Input name="q" defaultValue={q} placeholder="Name, phone, reference…" className="col-span-2" />
        <Input type="date" name="from" defaultValue={from} aria-label="From" />
        <Input type="date" name="to" defaultValue={to} aria-label="To" />
        <Select name="status" defaultValue={status} aria-label="Status">
          <option value="">All statuses</option>
          {RESERVATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
        <div className="flex gap-2">
          <Select name="source" defaultValue={source} aria-label="Source">
            <option value="">All sources</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button type="submit" variant="outline">Filter</Button>
        </div>
      </form>

      {(data ?? []).length === 0 ? (
        <EmptyState title="No reservations match" description="Try a different date range or clear filters." />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th><Link href={sortLink("time")}>Date / time</Link></Th>
              <Th><Link href={sortLink("name")}>Guest</Link></Th>
              <Th><Link href={sortLink("party")}>Pax</Link></Th>
              {ctx.branchIds.length > 1 ? <Th>Restaurant</Th> : null}
              <Th>Table</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Ref</Th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td className="whitespace-nowrap tabular-nums">
                  <Link href={`/reservations/${r.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                    {r.reservation_date} <span className="text-brand-700">{r.reservation_time.slice(0, 5)}</span>
                  </Link>
                </Td>
                <Td>
                  <Link href={`/reservations/${r.id}`} className="font-medium hover:text-brand-700">
                    {r.customers?.is_vip ? "★ " : ""}{r.customer_name}
                  </Link>
                  <div className="text-xs text-muted">
                    {r.phone}
                    {r.allergies ? <span className="ml-1 text-amber-700">⚠ {r.allergies}</span> : null}
                    {r.special_occasion ? <span className="ml-1 text-accent-600">· {r.special_occasion}</span> : null}
                  </div>
                </Td>
                <Td className="tabular-nums">{r.party_size}</Td>
                {ctx.branchIds.length > 1 ? <Td className="whitespace-nowrap">{names.get(r.restaurant_id)}</Td> : null}
                <Td>{r.reservation_tables?.map((t) => t.tables?.label).join("+") || <span className="text-xs text-amber-700">Unassigned</span>}</Td>
                <Td className="whitespace-nowrap text-xs">{sourceNames.get(r.booking_source_id ?? "") ?? "—"}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td className="font-mono text-xs">{r.reference}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? <Link className="rounded border bg-white px-3 py-1" href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page - 1) })}`}>Previous</Link> : null}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="rounded border bg-white px-3 py-1" href={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page + 1) })}`}>Next</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
