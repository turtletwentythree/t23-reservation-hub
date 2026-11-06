import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Signing secret is derived (never stored): HMAC(pepper, endpoint id). Shown to admins on demand. */
export function webhookSecret(endpointId: string) {
  return "whsec_" + createHmac("sha256", process.env.TOKEN_PEPPER ?? "").update(`webhook:${endpointId}`).digest("base64url");
}

export function signPayload(secret: string, body: string, timestamp: number) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

async function deliver(deliveryId: string) {
  const admin = createAdminClient();
  const { data: d } = await admin.from("webhook_deliveries").select("*, webhook_endpoints(id, url, is_active)").eq("id", deliveryId).maybeSingle();
  if (!d?.webhook_endpoints?.is_active) return;
  const body = JSON.stringify({ id: d.id, type: d.event, created_at: d.created_at, data: d.payload });
  const ts = Math.floor(Date.now() / 1000);
  const attempts = d.attempts + 1;
  try {
    const res = await fetch(d.webhook_endpoints.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-T23-Event": d.event, "X-T23-Signature": signPayload(webhookSecret(d.webhook_endpoints.id), body, ts) },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    const okStatus = res.status >= 200 && res.status < 300;
    await admin.from("webhook_deliveries").update({
      status: okStatus ? "delivered" : "failed", response_status: res.status, attempts, delivered_at: okStatus ? new Date().toISOString() : null,
      error: okStatus ? null : `HTTP ${res.status}`, next_attempt_at: okStatus || attempts >= 5 ? null : new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
    }).eq("id", d.id);
  } catch (e) {
    await admin.from("webhook_deliveries").update({
      status: "failed", attempts, error: e instanceof Error ? e.message : String(e), next_attempt_at: attempts >= 5 ? null : new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
    }).eq("id", d.id);
  }
}

export async function emitWebhook(organizationId: string, restaurantId: string | null, event: string, payload: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const { data: endpoints } = await admin.from("webhook_endpoints").select("id, restaurant_id, events").eq("organization_id", organizationId).eq("is_active", true);
    for (const ep of endpoints ?? []) {
      if (ep.restaurant_id && ep.restaurant_id !== restaurantId) continue;
      if (!ep.events.includes(event)) continue;
      const { data } = await admin.from("webhook_deliveries").insert({ endpoint_id: ep.id, event, payload: payload as never }).select("id").single();
      if (data) await deliver(data.id);
    }
  } catch (e) {
    console.error("emitWebhook failed", e);
  }
}

export async function retryDueWebhooks() {
  const admin = createAdminClient();
  const { data } = await admin.from("webhook_deliveries").select("id").eq("status", "failed").not("next_attempt_at", "is", null).lte("next_attempt_at", new Date().toISOString()).limit(50);
  for (const d of data ?? []) await deliver(d.id);
  return { webhooks: (data ?? []).length };
}
