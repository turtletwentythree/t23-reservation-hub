import { getStaffT } from "@/lib/i18n/staff-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/utils";
import { CustomerForm } from "../customer-form";
import { ConsentPanel, PrivacyPanel, TagPicker } from "./customer-panels";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("customer.view", "customers");
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: reservations }, { data: tags }, { data: assigned }, { data: consents }] = await Promise.all([
    supabase.from("reservations").select("id, reference, restaurant_id, reservation_date, reservation_time, party_size, status, special_occasion, restaurants(name)").eq("customer_id", id).order("starts_at", { ascending: false }).limit(200),
    supabase.from("customer_tags").select("*").order("name"),
    supabase.from("customer_tag_assignments").select("tag_id").eq("customer_id", id),
    supabase.from("customer_consents").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  // Payments via reservations visible to this user (RLS restricts to their branches)
  const resIds = (reservations ?? []).map((r) => r.id);
  const { data: pays } = resIds.length ? await supabase.from("payments").select("amount, currency, status, kind").in("reservation_id", resIds).eq("status", "succeeded") : { data: [] as { amount: number }[] };
  const paid = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
  const branches = new Set((reservations ?? []).filter((r) => r.status === "completed" || r.status === "seated").map((r) => r.restaurant_id));
  const latest = new Map<string, { granted: boolean; created_at: string }>();
  for (const k of consents ?? []) if (!latest.has(k.consent_type)) latest.set(k.consent_type, k);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-slate-800"><ArrowLeft className="size-4" />{" "}{t("Guests")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{c.is_vip ? "★ " : ""}{c.full_name} {c.anonymized_at ? <Badge tone="red">{t("Anonymized")}</Badge> : null}</h1>
          <p className="text-sm text-muted">{c.phone} · {c.email} · {c.preferred_language.toUpperCase()}</p>
        </div>
        <div className="flex gap-2">
          {roleCan(ctx.role, "reservation.write") && !c.anonymized_at ? <Button asChild><Link href={`/reservations/new?customer=${c.id}`}>{t("New booking")}</Link></Button> : null}
          {roleCan(ctx.role, "customer.privacy") ? <Button asChild variant="outline"><a href={`/api/export/customer/${c.id}`}><Download />{" "}{t("Export data (PDPA)")}</a></Button> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={t("Visits")} value={c.total_visits} />
        <StatCard label={t("No-shows")} value={c.total_no_shows} tone="red" />
        <StatCard label={t("Cancellations")} value={c.total_cancellations} tone="slate" />
        <StatCard label={t("Branches visited")} value={branches.size} tone="accent" />
        <StatCard label={t("Payments recorded")} value={formatMoney(paid)} tone="slate" hint={t("Deposits/prepayments only. POS spend: pending FoodStory integration")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardHeader><CardTitle>{t("Profile")}</CardTitle></CardHeader><CardContent><CustomerForm customer={c} readOnly={!roleCan(ctx.role, "customer.edit") || Boolean(c.anonymized_at)} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>{t("Reservation & visit history (all branches you can access)")}</CardTitle></CardHeader>
            <CardContent>
              <DataTable>
                <thead><tr><Th>{t("Date")}</Th><Th>{t("Restaurant")}</Th><Th>{t("Pax")}</Th><Th>{t("Status")}</Th><Th>{t("Ref")}</Th></tr></thead>
                <tbody>
                  {(reservations ?? []).map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap"><Link className="hover:text-brand-700" href={`/reservations/${r.id}`}>{r.reservation_date} {r.reservation_time.slice(0, 5)}</Link>{r.special_occasion ? <div className="text-xs text-accent-600">{r.special_occasion}</div> : null}</Td>
                      <Td>{r.restaurants?.name}</Td>
                      <Td>{r.party_size}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td className="font-mono text-xs">{r.reference}</Td>
                    </tr>
                  ))}
                  {(reservations ?? []).length === 0 ? <tr><Td colSpan={5} className="py-6 text-center text-muted">{t("No reservations yet.")}</Td></tr> : null}
                </tbody>
              </DataTable>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>{t("Tags")}</CardTitle></CardHeader><CardContent><TagPicker customerId={c.id} tags={tags ?? []} assigned={(assigned ?? []).map((a) => a.tag_id)} canEdit={roleCan(ctx.role, "customer.edit")} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>{t("Consent (PDPA)")}</CardTitle></CardHeader>
            <CardContent>
              <ConsentPanel customerId={c.id} canEdit={roleCan(ctx.role, "customer.edit") && !c.anonymized_at} current={Object.fromEntries([...latest.entries()].map(([k, v]) => [k, v.granted]))} />
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted">{t("Consent ledger")} ({(consents ?? []).length})</summary>
                <ul className="mt-2 space-y-1">
                  {(consents ?? []).map((k) => <li key={k.id}>{new Date(k.created_at).toLocaleString("en-GB")} · {k.consent_type} · {k.granted ? "granted" : "withdrawn"} · {k.source} · v{k.policy_version}</li>)}
                </ul>
              </details>
            </CardContent>
          </Card>
          {roleCan(ctx.role, "customer.privacy") && !c.anonymized_at ? (
            <Card><CardHeader><CardTitle>{t("Data deletion")}</CardTitle></CardHeader><CardContent><PrivacyPanel customerId={c.id} /></CardContent></Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
