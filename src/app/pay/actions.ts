"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/domain/reservation-service";
import { bookingGateway, GATEWAYS } from "@/lib/integrations/payments/registry";
import { simulatorAllowed } from "@/lib/integrations/payments/simulator";
import { settlePayment } from "@/lib/payments/settle";
import { manageToken, verifyManageToken } from "@/lib/tokens";

/**
 * Guest payment page actions (no login: the signed manage token in the link is the key).
 * Card numbers never reach these actions; the browser sends only the gateway's card token.
 */

const base = z.object({ reference: z.string().min(4).max(32), token: z.string().min(10).max(64) });

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
function payPageUrl(reference: string, reservationId: string) {
  return `${appUrl()}/pay/${encodeURIComponent(reference)}?t=${manageToken(reservationId)}`;
}
function doneUrl(reference: string, reservationId: string) {
  return `/reservation/${encodeURIComponent(reference)}?t=${manageToken(reservationId)}&new=1&paid=1`;
}

async function loadPayable(reference: string, token: string) {
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("reservations")
    .select("id, reference, restaurant_id, organization_id, status, deposit_amount, payment_status, payment_due_at, email, restaurants(name, currency)")
    .eq("reference", reference)
    .maybeSingle();
  if (!r || !verifyManageToken(r.id, token)) throw new DomainError("forbidden", "Invalid link");
  return { admin, r };
}

export type PaymentState = { state: "paid" | "pending" | "failed" | "expired"; redirect?: string };

async function stateOf(admin: ReturnType<typeof createAdminClient>, id: string, reference: string): Promise<PaymentState> {
  const { data: r } = await admin.from("reservations").select("status, payment_status, payment_due_at").eq("id", id).single();
  if (!r) return { state: "expired" };
  if (r.payment_status === "paid") return { state: "paid", redirect: doneUrl(reference, id) };
  if (r.status === "cancelled") return { state: "expired" };
  return { state: r.payment_status === "failed" ? "failed" : "pending" };
}

export async function startPaymentAction(raw: unknown): Promise<ActionResult<{ qrImageUrl?: string; authorizeUrl?: string; checkoutUrl?: string; state: PaymentState }>> {
  try {
    const input = base.extend({ method: z.enum(["promptpay", "card", "checkout", "simulator"]), cardToken: z.string().max(64).optional() }).parse(raw);
    if (!(await rateLimit("guest_pay", 15, 600))) throw new DomainError("policy", "Too many payment attempts. Please wait a few minutes.");
    const { admin, r } = await loadPayable(input.reference, input.token);
    await admin.rpc("release_expired_payment_holds", { p_restaurant_id: r.restaurant_id });
    const now = await stateOf(admin, r.id, r.reference);
    if (now.state === "paid" || now.state === "expired") return ok({ state: now });

    const gateway = bookingGateway();
    if (!gateway || !gateway.methods().includes(input.method)) throw new DomainError("validation", "This payment method is not available.");
    const amount = Number(r.deposit_amount);
    if (!(amount > 0)) throw new DomainError("validation", "Nothing to pay for this booking.");
    const currency = r.restaurants?.currency ?? "THB";
    const { data: pol } = await admin.from("booking_policies").select("deposit_type").eq("restaurant_id", r.restaurant_id).maybeSingle();
    const kind: "prepayment" | "deposit" = pol?.deposit_type === "full_prepayment" ? "prepayment" : "deposit";
    const description = `${r.restaurants?.name ?? "T23"} ${kind} – ${r.reference}`;
    const returnUrl = `${payPageUrl(r.reference, r.id)}&check=1`;
    const metadata = { reservation_id: r.id, reference: r.reference };

    // Re-show a PromptPay QR that is still open instead of creating another one.
    if (input.method === "promptpay") {
      const { data: open } = await admin.from("payments").select("checkout_url").eq("reservation_id", r.id).eq("provider", gateway.name).eq("method", "promptpay").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (open?.checkout_url) return ok({ qrImageUrl: open.checkout_url, state: now });
    }

    const row = { organization_id: r.organization_id, restaurant_id: r.restaurant_id, reservation_id: r.id, kind, provider: gateway.name, amount, currency, status: "pending" as const };

    if (input.method === "checkout") {
      const co = await gateway.createCheckout({ amount, currency, reference: r.reference, description, successUrl: returnUrl, cancelUrl: payPageUrl(r.reference, r.id), customerEmail: r.email, metadata });
      if (!co.ok) throw new DomainError("validation", `Payment provider error: ${co.error}`);
      await admin.from("payments").insert({ ...row, method: "checkout", provider_reference: co.providerReference, checkout_url: co.checkoutUrl });
      return ok({ checkoutUrl: co.checkoutUrl, state: now });
    }

    if (!gateway.createCharge) throw new DomainError("validation", "This payment method is not available.");
    const ch = await gateway.createCharge({ amount, currency, reference: r.reference, description, method: input.method, cardToken: input.cardToken, returnUrl, metadata });
    if (!ch.ok) throw new DomainError("validation", ch.error);
    const { data: pay, error } = await admin
      .from("payments")
      .insert({ ...row, method: input.method, provider_reference: ch.providerReference, checkout_url: ch.qrImageUrl ?? ch.authorizeUrl ?? null })
      .select("id")
      .single();
    if (error) throw new DomainError("validation", error.message);
    if (ch.status !== "pending") await settlePayment(admin, pay.id, ch.status);
    return ok({ qrImageUrl: ch.qrImageUrl, authorizeUrl: ch.status === "pending" ? ch.authorizeUrl : undefined, state: await stateOf(admin, r.id, r.reference) });
  } catch (e) {
    return fail(e);
  }
}

/** Asks the gateway about open payments, so the page does not depend on the webhook arriving. */
export async function checkPaymentAction(raw: unknown): Promise<ActionResult<PaymentState>> {
  try {
    const input = base.parse(raw);
    if (!(await rateLimit("guest_pay_check", 60, 300))) throw new DomainError("policy", "Too many requests.");
    const { admin, r } = await loadPayable(input.reference, input.token);
    const { data: open } = await admin.from("payments").select("id, provider, provider_reference").eq("reservation_id", r.id).eq("status", "pending").not("provider_reference", "is", null);
    for (const p of open ?? []) {
      const status = await GATEWAYS[p.provider]?.getStatus(p.provider_reference!);
      if (status && status !== "pending") await settlePayment(admin, p.id, status);
    }
    await admin.rpc("release_expired_payment_holds", { p_restaurant_id: r.restaurant_id });
    return ok(await stateOf(admin, r.id, r.reference));
  } catch (e) {
    return fail(e);
  }
}

/** Test mode only: completes or fails the open simulator payment. */
export async function simulatePaymentAction(raw: unknown): Promise<ActionResult<PaymentState>> {
  try {
    const input = base.extend({ outcome: z.enum(["succeeded", "failed"]) }).parse(raw);
    if (!simulatorAllowed()) throw new DomainError("forbidden", "The payment simulator is turned off.");
    const { admin, r } = await loadPayable(input.reference, input.token);
    const { data: p } = await admin.from("payments").select("id").eq("reservation_id", r.id).eq("provider", "simulator").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!p) throw new DomainError("validation", "Start a payment first.");
    await settlePayment(admin, p.id, input.outcome);
    return ok(await stateOf(admin, r.id, r.reference));
  } catch (e) {
    return fail(e);
  }
}
