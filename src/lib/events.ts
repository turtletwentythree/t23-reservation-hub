import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueReservationNotification } from "@/lib/integrations/notifications/service";
import { emitWebhook } from "@/lib/integrations/webhooks";

const NOTIFY = { created: "booking_confirmation", updated: "booking_modification", cancelled: "booking_cancellation" } as const;

/** Side effects after a reservation change: guest notifications + outbound webhooks. Never throws. */
export async function reservationEvent(reservationId: string, kind: keyof typeof NOTIFY) {
  await queueReservationNotification(reservationId, NOTIFY[kind]);
  const { data: r } = await createAdminClient()
    .from("reservations")
    .select("id, reference, organization_id, restaurant_id, reservation_date, reservation_time, party_size, status, booking_source_id, created_at, updated_at, restaurants(slug, name)")
    .eq("id", reservationId)
    .maybeSingle();
  // Webhook payloads deliberately exclude guest contact details (data minimisation).
  if (r) await emitWebhook(r.organization_id, r.restaurant_id, `reservation.${kind}`, { ...r, reservation_time: r.reservation_time.slice(0, 5) });
}
