import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { PROVIDERS } from "@/lib/integrations/notifications/registry";
import { GATEWAYS } from "@/lib/integrations/payments/registry";
import { foodstory } from "@/lib/integrations/pos/foodstory";

export const metadata = { title: "Integrations" };

/** Live status comes from whether server-side credentials exist — never from a stored flag alone. */
function liveStatus(provider: string): { label: string; tone: "green" | "slate" | "orange" } | null {
  const map: Record<string, boolean | undefined> = {
    resend: PROVIDERS.email.isConfigured(), twilio: PROVIDERS.sms.isConfigured(), line: PROVIDERS.line.isConfigured(), whatsapp: PROVIDERS.whatsapp.isConfigured(),
    stripe: GATEWAYS.stripe.isConfigured(), omise: GATEWAYS.omise.isConfigured(),
  };
  if (provider === "foodstory") return { label: foodstory.status().label, tone: "orange" };
  if (provider === "google_business") return { label: "Use booking links", tone: "slate" };
  if (!(provider in map)) return null;
  return map[provider] ? { label: "Credentials configured", tone: "green" } : { label: "Not configured", tone: "slate" };
}

const ENV_HINT: Record<string, string> = {
  resend: "RESEND_API_KEY, EMAIL_FROM", twilio: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER", line: "LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET",
  whatsapp: "WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID", stripe: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (webhook: /api/webhooks/payments/stripe)",
  omise: "OMISE_SECRET_KEY (webhook: /api/webhooks/payments/omise)", foodstory: "FOODSTORY_API_BASE_URL, FOODSTORY_API_KEY — after vendor confirms API access",
  google_business: "Add each restaurant's /book/<slug> URL as the reservation link in Google Business Profile",
};

export default async function IntegrationsPage() {
  const { t } = await getStaffT();
  await requireStaff("integration.view", "integrations");
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("*").order("category");
  return (
    <div>
      <PageHeader title={t("Integrations")} description={t("Providers are adapters; credentials live only in server environment variables. Nothing reports success unless the provider actually confirms it.")} />
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((i) => {
          const s = liveStatus(i.provider);
          return (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{i.display_name}</p><p className="text-xs uppercase text-muted">{i.category}</p></div>
                {s ? <Badge tone={s.tone}>{t(s.label)}</Badge> : <Badge>{i.status}</Badge>}
              </div>
              {i.notes ? <p className="mt-2 text-sm text-slate-600">{t(i.notes)}</p> : null}
              <p className="mt-2 text-xs text-muted">{t("Setup")}: {ENV_HINT[i.provider] ?? "—"}</p>
            </Card>
          );
        })}
        <Card className="p-4">
          <div className="flex items-start justify-between"><p className="font-semibold">{t("REST API & webhooks")}</p><Badge tone="green">{t("Available")}</Badge></div>
          <p className="mt-2 text-sm text-slate-600">{t("External channels can check availability and create/cancel bookings with scoped API keys. Manage keys and webhooks in Settings.")}</p>
        </Card>
      </div>
    </div>
  );
}
