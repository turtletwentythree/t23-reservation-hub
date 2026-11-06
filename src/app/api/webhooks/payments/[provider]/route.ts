import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GATEWAYS } from "@/lib/integrations/payments/registry";

/** Inbound payment provider webhooks. Signature/authenticity is verified by the adapter before anything changes. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const gateway = GATEWAYS[(await params).provider];
  if (!gateway || !gateway.isConfigured()) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  const raw = await req.text();
  const event = await gateway.parseWebhook(raw, req.headers);
  if (!event) return NextResponse.json({ received: true, ignored: true });
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id, status, reservation_id").eq("provider", gateway.name).eq("provider_reference", event.providerReference).maybeSingle();
  if (!payment) return NextResponse.json({ received: true, unknown_reference: true });
  if (payment.status === "pending") {
    await admin.from("payments").update(event.type === "payment.succeeded" ? { status: "succeeded", paid_at: new Date().toISOString() } : { status: "failed" }).eq("id", payment.id);
    if (event.type === "payment.succeeded" && payment.reservation_id) {
      // Deposit paid -> confirm a pending booking (if it does not otherwise need manual approval)
      const { data: r } = await admin.from("reservations").select("status, restaurant_id, party_size").eq("id", payment.reservation_id).maybeSingle();
      const { data: pol } = r ? await admin.from("booking_policies").select("auto_confirm_online, large_party_threshold").eq("restaurant_id", r.restaurant_id).maybeSingle() : { data: null };
      if (r?.status === "pending" && pol?.auto_confirm_online && !(pol.large_party_threshold && r.party_size >= pol.large_party_threshold)) {
        await admin.from("reservations").update({ status: "confirmed" }).eq("id", payment.reservation_id);
      }
    }
  }
  return NextResponse.json({ received: true });
}
