import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { manageUrl } from "@/lib/tokens";
import { PROVIDERS } from "./registry";
import { renderTemplate, retryDelayMinutes } from "./render";
import type { Channel } from "./types";

type Event = Database["public"]["Enums"]["notification_event"];
type LogRow = Database["public"]["Tables"]["notification_logs"]["Row"];

async function findTemplate(orgId: string, restaurantId: string | null, event: Event, channel: Channel, locale: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_templates")
    .select("*")
    .eq("organization_id", orgId)
    .eq("event", event)
    .eq("channel", channel)
    .eq("is_active", true)
    .in("locale", [locale, "en"]);
  const rows = data ?? [];
  const score = (t: (typeof rows)[number]) => (t.restaurant_id === restaurantId ? 2 : t.restaurant_id === null ? 1 : -10) * 10 + (t.locale === locale ? 1 : 0);
  return rows.filter((t) => t.restaurant_id === null || t.restaurant_id === restaurantId).sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * Queues and immediately attempts a reservation notification on every channel the guest
 * can be reached on and for which a template exists. Never throws: notification failures
 * must not break bookings. Unconfigured providers are logged as `not_configured`.
 */
export async function queueReservationNotification(reservationId: string, event: Event): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("reservations")
      .select("*, restaurants(name, timezone), customers(line_user_id)")
      .eq("id", reservationId)
      .maybeSingle();
    if (!r) return;
    const vars = {
      customer_name: r.customer_name,
      restaurant_name: r.restaurants?.name,
      reference: r.reference,
      date: r.reservation_date,
      time: r.reservation_time.slice(0, 5),
      party_size: r.party_size,
      manage_url: manageUrl(r.reference, r.id),
    };
    const targets: { channel: Channel; to: string }[] = [];
    if (r.email) targets.push({ channel: "email", to: r.email });
    if (r.phone) targets.push({ channel: "sms", to: r.phone });
    if (r.customers?.line_user_id) targets.push({ channel: "line", to: r.customers.line_user_id });

    for (const t of targets) {
      const tpl = await findTemplate(r.organization_id, r.restaurant_id, event, t.channel, r.language);
      if (!tpl) continue;
      const { data: log } = await admin
        .from("notification_logs")
        .insert({
          organization_id: r.organization_id,
          restaurant_id: r.restaurant_id,
          reservation_id: r.id,
          customer_id: r.customer_id,
          template_id: tpl.id,
          event,
          channel: t.channel,
          recipient: t.to,
          locale: tpl.locale,
          subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
          body: renderTemplate(tpl.body, vars),
          status: "queued",
        })
        .select("*")
        .single();
      if (log) await dispatch(log);
    }
  } catch (e) {
    console.error("queueReservationNotification failed", e);
  }
}

export async function queueWaitlistNotification(waitlistId: string): Promise<{ queued: number }> {
  const admin = createAdminClient();
  const { data: w } = await admin
    .from("waitlists")
    .select("*, restaurants(name, organization_id), customers(line_user_id, preferred_language)")
    .eq("id", waitlistId)
    .maybeSingle();
  if (!w || !w.restaurants) return { queued: 0 };
  const vars = { customer_name: w.customer_name, restaurant_name: w.restaurants.name, queue_number: w.queue_number };
  const targets: { channel: Channel; to: string }[] = [];
  if (w.customers?.line_user_id) targets.push({ channel: "line", to: w.customers.line_user_id });
  if (w.phone) targets.push({ channel: "sms", to: w.phone });
  let queued = 0;
  for (const t of targets) {
    const tpl = await findTemplate(w.restaurants.organization_id, w.restaurant_id, "waitlist_ready", t.channel, w.customers?.preferred_language ?? "en");
    if (!tpl) continue;
    const { data: log } = await admin
      .from("notification_logs")
      .insert({
        organization_id: w.restaurants.organization_id,
        restaurant_id: w.restaurant_id,
        waitlist_id: w.id,
        customer_id: w.customer_id,
        template_id: tpl.id,
        event: "waitlist_ready",
        channel: t.channel,
        recipient: t.to,
        locale: tpl.locale,
        body: renderTemplate(tpl.body, vars),
        status: "queued",
      })
      .select("*")
      .single();
    if (log) {
      await dispatch(log);
      queued++;
    }
  }
  return { queued };
}

/** Sends one log entry through its channel's provider and records the real outcome. */
export async function dispatch(log: LogRow): Promise<LogRow["status"]> {
  const admin = createAdminClient();
  const provider = PROVIDERS[log.channel as Channel];
  if (!provider.isConfigured()) {
    await admin
      .from("notification_logs")
      .update({ status: "not_configured", provider: provider.name, error: `No ${log.channel} provider configured; message was not sent.`, next_attempt_at: null })
      .eq("id", log.id);
    return "not_configured";
  }
  await admin.from("notification_logs").update({ status: "sending", provider: provider.name }).eq("id", log.id);
  const attempts = log.attempts + 1;
  const result = await provider.send({ to: log.recipient, subject: log.subject, body: log.body });
  if (result.ok) {
    await admin
      .from("notification_logs")
      .update({ status: "sent", attempts, sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId, error: null, next_attempt_at: null })
      .eq("id", log.id);
    return "sent";
  }
  const canRetry = result.retryable && attempts < log.max_attempts;
  await admin
    .from("notification_logs")
    .update({
      status: "failed",
      attempts,
      error: result.error.slice(0, 1000),
      next_attempt_at: canRetry ? new Date(Date.now() + retryDelayMinutes(attempts) * 60_000).toISOString() : null,
    })
    .eq("id", log.id);
  return "failed";
}

/** Cron: retry failed messages whose backoff elapsed. */
export async function processDueNotifications(limit = 50) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_logs")
    .select("*")
    .in("status", ["queued", "failed"])
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(limit);
  const results: Record<string, number> = {};
  for (const log of data ?? []) {
    if (log.attempts >= log.max_attempts) continue;
    const s = await dispatch(log);
    results[s] = (results[s] ?? 0) + 1;
  }
  return results;
}

/**
 * Cron: queue reminders for confirmed bookings starting between LEAD and LEAD+WINDOW hours from now.
 * Defaults (14h lead, 24h window) suit a once-a-day cron at 03:00 UTC: each run covers all of the next
 * Bangkok day, and consecutive runs neither overlap nor leave gaps. For an hourly cron use 20 and 8 (or 1).
 * reminder_sent_at prevents duplicates either way.
 */
export async function queueDueReminders() {
  const admin = createAdminClient();
  const lead = Number(process.env.REMINDER_LEAD_HOURS ?? 14);
  const window = Number(process.env.REMINDER_WINDOW_HOURS ?? 24);
  const from = new Date(Date.now() + lead * 3600_000).toISOString();
  const to = new Date(Date.now() + (lead + window) * 3600_000).toISOString();
  const { data } = await admin
    .from("reservations")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .limit(200);
  for (const r of data ?? []) {
    await queueReservationNotification(r.id, "booking_reminder");
    await admin.from("reservations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
  }
  return { reminders: (data ?? []).length };
}
