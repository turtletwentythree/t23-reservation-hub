import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { pickParam } from "@/lib/data/common";
import { Badge, PageHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Audit logs" };
const ENTITIES = ["reservations", "customers", "customer_consents", "restaurants", "tables", "booking_policies", "operating_hours", "user_roles", "restaurant_user_access", "payments", "refunds", "waitlists", "integrations", "api_keys", "webhook_endpoints", "data_subject_requests", "notification_templates"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("audit.view");
  const sp = await searchParams;
  const entity = pickParam(sp.entity) ?? "";
  const action = pickParam(sp.action) ?? "";
  const date = pickParam(sp.date) ?? "";
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  if (entity) q = q.eq("entity_type", entity);
  if (action) q = q.eq("action", action);
  if (date) q = q.gte("created_at", `${date}T00:00:00+07:00`).lte("created_at", `${date}T23:59:59+07:00`);
  const [{ data }, { data: users }, { data: restaurants }] = await Promise.all([q, supabase.from("users").select("id, full_name, email"), supabase.from("restaurants").select("id, name")]);
  const who = new Map((users ?? []).map((u) => [u.id, u.full_name ?? u.email]));
  const rest = new Map((restaurants ?? []).map((r) => [r.id, r.name]));
  return (
    <div>
      <PageHeader title="Audit logs" description="Every create, update and delete on key records — written by database triggers, not the app." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="entity" defaultValue={entity} className="w-56"><option value="">All records</option>{ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}</Select>
        <Select name="action" defaultValue={action} className="w-40"><option value="">All actions</option>{["insert", "update", "delete", "merge", "grant_access", "revoke_access"].map((a) => <option key={a}>{a}</option>)}</Select>
        <Input type="date" name="date" defaultValue={date} className="w-40" />
        <Button variant="outline">Filter</Button>
      </form>
      <DataTable>
        <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Record</Th><Th>Branch</Th><Th>Changes</Th></tr></thead>
        <tbody>
          {(data ?? []).map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}</Td>
              <Td className="text-xs">{l.actor_id ? who.get(l.actor_id) ?? "staff" : <span className="text-muted">{l.actor_label ?? "system"}</span>}</Td>
              <Td><Badge tone={l.action === "delete" ? "red" : l.action === "insert" ? "green" : "slate"}>{l.action}</Badge></Td>
              <Td className="text-xs">{l.entity_type}<div className="font-mono text-[10px] text-muted">{l.entity_id?.slice(0, 8)}</div></Td>
              <Td className="text-xs">{l.restaurant_id ? rest.get(l.restaurant_id) ?? "—" : "—"}</Td>
              <Td className="max-w-md text-xs">
                {l.action === "update" && l.new_data ? Object.entries(l.new_data as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
                  <div key={k}><span className="font-medium">{k}</span>: {JSON.stringify((l.old_data as Record<string, unknown>)?.[k])} → {JSON.stringify(v)}</div>
                )) : <span className="text-muted">{l.action === "insert" ? "created" : l.action === "delete" ? "deleted" : JSON.stringify(l.new_data)?.slice(0, 120)}</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
