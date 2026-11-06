import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam } from "@/lib/data/common";
import { Badge, PageHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CustomerForm } from "./customer-form";
import { MergeButton } from "./merge-button";

export const metadata = { title: "Customers" };
const SEGMENTS = { all: "All guests", vip: "VIP", repeat: "Repeat (2+ visits)", new: "New (≤1 visit)", lapsed: "Lapsed (no visit 90 days)", noshow: "No-show history", birthday: "Birthday this month" } as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff("customer.view");
  const sp = await searchParams;
  const q = (pickParam(sp.q) ?? "").trim();
  const segment = (pickParam(sp.segment) ?? "all") as keyof typeof SEGMENTS;
  const tag = pickParam(sp.tag) ?? "";
  const showDupes = pickParam(sp.view) === "duplicates";
  const supabase = await createClient();
  const { data: tags } = await supabase.from("customer_tags").select("*").order("name");

  if (showDupes) {
    const { data: dupes } = await supabase.rpc("find_duplicate_customers", { p_limit: 100 });
    return (
      <div>
        <PageHeader title="Possible duplicate guests" description="Matched by phone, email or very similar name." actions={<Button asChild variant="outline"><Link href="/customers">Back to guests</Link></Button>} />
        <DataTable>
          <thead><tr><Th>Guest A</Th><Th>Guest B</Th><Th>Reason</Th><Th></Th></tr></thead>
          <tbody>
            {(dupes ?? []).map((d) => (
              <tr key={d.customer_a + d.customer_b}>
                <Td><Link className="font-medium hover:text-brand-700" href={`/customers/${d.customer_a}`}>{d.name_a}</Link><div className="text-xs text-muted">{d.phone_a}</div></Td>
                <Td><Link className="font-medium hover:text-brand-700" href={`/customers/${d.customer_b}`}>{d.name_b}</Link><div className="text-xs text-muted">{d.phone_b}</div></Td>
                <Td><Badge tone="orange">{d.reason}</Badge></Td>
                <Td><MergeButton primaryId={d.customer_a} duplicateId={d.customer_b} label={`Merge B into A`} /></Td>
              </tr>
            ))}
            {(dupes ?? []).length === 0 ? <tr><Td colSpan={4} className="py-8 text-center text-muted">No duplicates detected.</Td></tr> : null}
          </tbody>
        </DataTable>
      </div>
    );
  }

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, email, is_vip, total_visits, total_no_shows, last_visit_at, preferred_language, allergies, customer_tag_assignments(tag_id)", { count: "exact" })
    .is("anonymized_at", null);
  if (q) {
    const digits = q.replace(/[^0-9]/g, "");
    const safe = q.replace(/[%_,()]/g, " ");
    query = digits.length >= 4 ? query.ilike("phone_normalized", `%${digits.replace(/^0/, "")}%`) : query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const ninety = new Date(Date.now() - 90 * 86400_000).toISOString();
  if (segment === "vip") query = query.eq("is_vip", true);
  if (segment === "repeat") query = query.gte("total_visits", 2);
  if (segment === "new") query = query.lte("total_visits", 1);
  if (segment === "lapsed") query = query.lt("last_visit_at", ninety);
  if (segment === "noshow") query = query.gt("total_no_shows", 0);
  if (tag) {
    const { data: ids } = await supabase.from("customer_tag_assignments").select("customer_id").eq("tag_id", tag);
    query = query.in("id", (ids ?? []).map((i) => i.customer_id));
  }
  let { data, count } = await query.order("last_visit_at", { ascending: false, nullsFirst: false }).limit(segment === "birthday" ? 2000 : 200);
  if (segment === "birthday") {
    const { data: bdays } = await supabase.from("customers").select("id, birthday").is("anonymized_at", null).not("birthday", "is", null);
    const month = new Date().toISOString().slice(5, 7);
    const ids = new Set((bdays ?? []).filter((b) => b.birthday!.slice(5, 7) === month).map((b) => b.id));
    data = (data ?? []).filter((c) => ids.has(c.id));
    count = data.length;
  }
  const tagMap = new Map((tags ?? []).map((t) => [t.id, t]));

  return (
    <div>
      <PageHeader
        title="Guests"
        description={`${count ?? 0} guest profiles shared across all branches`}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/customers?view=duplicates">Find duplicates</Link></Button>
            {roleCan(ctx.role, "customer.edit") ? (
              <Dialog>
                <DialogTrigger asChild><Button>Add guest</Button></DialogTrigger>
                <DialogContent title="New guest profile" className="max-w-2xl"><CustomerForm /></DialogContent>
              </Dialog>
            ) : null}
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by phone or name" className="w-64" />
        <Select name="segment" defaultValue={segment} className="w-52">
          {Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="tag" defaultValue={tag} className="w-40">
          <option value="">All tags</option>
          {(tags ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Button variant="outline">Search</Button>
      </form>
      <DataTable>
        <thead><tr><Th>Guest</Th><Th>Contact</Th><Th>Visits</Th><Th>No-shows</Th><Th>Last visit</Th><Th>Tags</Th></tr></thead>
        <tbody>
          {(data ?? []).map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/customers/${c.id}`} className="font-medium hover:text-brand-700">{c.is_vip ? "★ " : ""}{c.full_name}</Link>
                {c.allergies ? <div className="text-xs text-amber-700">⚠ {c.allergies}</div> : null}
              </Td>
              <Td className="text-xs">{c.phone}<div className="text-muted">{c.email}</div></Td>
              <Td className="tabular-nums">{c.total_visits}</Td>
              <Td className="tabular-nums">{c.total_no_shows}</Td>
              <Td className="text-xs">{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("en-GB") : "—"}</Td>
              <Td><div className="flex flex-wrap gap-1">{c.customer_tag_assignments.map((a) => { const t = tagMap.get(a.tag_id); return t ? <span key={t.id} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: t.color }}>{t.name}</span> : null; })}</div></Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
