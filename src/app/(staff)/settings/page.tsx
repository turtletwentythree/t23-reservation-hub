import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { ApiKeys, Retention, SourceRow, Webhooks } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireStaff("settings.manage");
  const supabase = await createClient();
  const [{ data: org }, { data: sources }, { data: keys }, { data: hooks }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", ctx.organizationId).single(),
    supabase.from("booking_sources").select("*").order("name"),
    supabase.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, revoked_at, restaurants(name)").order("created_at", { ascending: false }),
    supabase.from("webhook_endpoints").select("id, url, events, is_active, webhook_deliveries(status)").order("created_at"),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Settings" description={`${org?.name} · default time zone ${org?.default_timezone} · ${org?.default_currency}`} />
      <Card><CardHeader><CardTitle>Booking sources</CardTitle></CardHeader><CardContent>{(sources ?? []).map((s) => <SourceRow key={s.id} s={s} />)}<SourceRow /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>REST API keys</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted">For external booking channels. Base URL <code>{base}/api/v1</code> · docs in <code>docs/API.md</code>.</p>
          <ApiKeys keys={(keys ?? []).map((k) => ({ ...k, restaurant: k.restaurants?.name ?? null }))} restaurants={ctx.restaurants.map((r) => ({ id: r.id, name: r.name }))} />
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Outbound webhooks</CardTitle></CardHeader><CardContent><Webhooks hooks={(hooks ?? []).map((h) => ({ ...h, deliveries: h.webhook_deliveries }))} /></CardContent></Card>
      <Card><CardHeader><CardTitle>PDPA data retention</CardTitle></CardHeader><CardContent><Retention /></CardContent></Card>
    </div>
  );
}
