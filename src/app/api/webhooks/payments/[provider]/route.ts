import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GATEWAYS } from "@/lib/integrations/payments/registry";
import { settlePayment } from "@/lib/payments/settle";

/** Inbound payment provider webhooks. Signature/authenticity is verified by the adapter before anything changes. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const gateway = GATEWAYS[(await params).provider];
  if (!gateway || !gateway.isConfigured()) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  const raw = await req.text();
  const event = await gateway.parseWebhook(raw, req.headers);
  if (!event) return NextResponse.json({ received: true, ignored: true });
  const admin = createAdminClient();
  const refs = [event.providerReference, event.altReference].filter(Boolean) as string[];
  const { data: payment } = await admin.from("payments").select("id").eq("provider", gateway.name).in("provider_reference", refs).limit(1).maybeSingle();
  if (!payment) return NextResponse.json({ received: true, unknown_reference: true });
  // settlePayment confirms the booking (or puts back an expired hold) and sends the confirmation, once.
  await settlePayment(admin, payment.id, event.type === "payment.succeeded" ? "succeeded" : "failed");
  return NextResponse.json({ received: true });
}
