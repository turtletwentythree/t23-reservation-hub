import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { reservationEvent } from "@/lib/events";

type Admin = SupabaseClient<Database>;

/** Must match release_expired_payment_holds() in the prepaid_booking migration. */
export const EXPIRED_REASON = "Online payment not completed in time";

/**
 * Records the outcome of a gateway payment, once. Used by the webhook, by the payment page
 * when it checks the gateway itself, and by the simulator.
 *
 * A successful deposit confirms the booking, unless the restaurant reviews online bookings
 * by hand or the party is large enough to need manual confirmation. Either way the payment
 * hold ends, so the booking is no longer cancelled automatically.
 */
export async function settlePayment(admin: Admin, paymentId: string, outcome: "succeeded" | "failed"): Promise<"settled" | "already_settled"> {
  // Conditional update: only the first caller moves a pending payment, so the side effects run once.
  const { data: moved } = await admin
    .from("payments")
    .update(outcome === "succeeded" ? { status: "succeeded", paid_at: new Date().toISOString() } : { status: "failed" })
    .eq("id", paymentId)
    // A payment cancelled when its hold ran out can still be paid late (money taken): record it.
    .in("status", outcome === "succeeded" ? ["pending", "cancelled"] : ["pending"])
    .select("reservation_id")
    .maybeSingle();
  if (!moved) return "already_settled";
  if (outcome !== "succeeded" || !moved.reservation_id) return "settled";

  const { data: r } = await admin.from("reservations").select("id, status, restaurant_id, party_size, payment_due_at, payment_status, cancellation_reason, internal_notes").eq("id", moved.reservation_id).maybeSingle();
  if (!r) return "settled";
  const { data: pol } = await admin.from("booking_policies").select("auto_confirm_online, large_party_threshold").eq("restaurant_id", r.restaurant_id).maybeSingle();
  const autoConfirm = Boolean(pol?.auto_confirm_online) && !(pol?.large_party_threshold && r.party_size >= pol.large_party_threshold);

  // Paid after the hold ran out (e.g. a PromptPay QR scanned late): put the booking back if its
  // table is still free. If it is not, keep it cancelled and flag it so staff refund or rebook.
  if (r.status === "cancelled" && r.cancellation_reason === EXPIRED_REASON) {
    const { error } = await admin.from("reservations").update({ status: autoConfirm ? "confirmed" : "pending", cancellation_reason: null, cancelled_at: null }).eq("id", r.id);
    if (error) {
      const note = "[PAID AFTER HOLD EXPIRED] The guest paid after the table hold ran out and the table was taken. Refund or rebook.";
      await admin.from("reservations").update({ internal_notes: r.internal_notes ? `${note}\n${r.internal_notes}` : note }).eq("id", r.id);
      return "settled";
    }
    await reservationEvent(r.id, "created");
    return "settled";
  }
  const wasHold = r.payment_due_at !== null;
  const confirm = r.status === "pending" && autoConfirm && r.payment_status === "paid";
  if (wasHold || confirm) {
    await admin.from("reservations").update({ payment_due_at: null, ...(confirm ? { status: "confirmed" as const } : {}) }).eq("id", r.id);
  }
  // Prepaid online bookings send their confirmation only once paid (see publicBookAction).
  if (wasHold) await reservationEvent(r.id, "created");
  else if (confirm) await reservationEvent(r.id, "updated");
  return "settled";
}
