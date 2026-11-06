import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { ApiKeys, Retention, SourceRow, Webhooks } from "./settings-client";
import { PageAccessMatrix } from "./page-access";
import { allowedPages, parsePageAccess, possiblePages } from "@/components/layout/nav";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { t } = await getStaffT();
  const ctx = await requireStaff("settings.manage", "settings");
  const supabase = await createClient();
  const [{ data: org }, { data: sources }, { data: keys }, { data: hooks }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", ctx.organizationId).single(),
    supabase.from("booking_sources").select("*").order("name"),
    supabase.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, revoked_at, restaurants(name)").order("created_at", { ascending: false }),
    supabase.from("webhook_endpoints").select("id, url, events, is_active, webhook_deliveries(status)").order("created_at"),
  ]);
  const access = parsePageAccess(org?.page_access);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title={t("Settings")} description={`${org?.name} · ${t("default time zone")} ${org?.default_timezone} · ${org?.default_currency}`} />
      <Card>
        <CardHeader><CardTitle>{t("Page access by role")}</CardTitle></CardHeader>
        <CardContent>
          <PageAccessMatrix
            possible={{ host: possiblePages("host"), viewer: possiblePages("viewer") }}
            current={{ host: allowedPages("host", access), viewer: allowedPages("viewer", access) }}
          />
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>{t("Booking sources")}</CardTitle></CardHeader><CardContent>{(sources ?? []).map((s) => <SourceRow key={s.id} s={s} />)}<SourceRow /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>{t("REST API keys")}</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted">{t("For external booking channels. Base URL")}{" "}<code>{base}/api/v1</code>{" "}{t("· docs in")}{" "}<code>{t("docs/API.md")}</code>.</p>
          <ApiKeys keys={(keys ?? []).map((k) => ({ ...k, restaurant: k.restaurants?.name ?? null }))} restaurants={ctx.restaurants.map((r) => ({ id: r.id, name: r.name }))} />
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>{t("Outbound webhooks")}</CardTitle></CardHeader><CardContent><Webhooks hooks={(hooks ?? []).map((h) => ({ ...h, deliveries: h.webhook_deliveries }))} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("PDPA data retention")}</CardTitle></CardHeader><CardContent><Retention /></CardContent></Card>
    </div>
  );
}
