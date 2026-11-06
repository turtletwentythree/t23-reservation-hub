"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { GATEWAYS, MANUAL_PROVIDERS } from "@/lib/integrations/payments/registry";
import { manageUrl } from "@/lib/tokens";

const kinds = z.enum(["deposit", "prepayment", "no_show_fee", "cancellation_fee", "other"]);

async function loadReservation(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("reservations").select("id, reference, restaurant_id, organization_id, email, restaurants(name, currency)").eq("id", id).maybeSingle();
  if (!data) throw new DomainError("not_found", "Reservation not found");
  return { supabase, r: data };
}

export async function recordPaymentAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = z
      .object({ reservation_id: z.string().uuid(), kind: kinds, provider: z.enum(MANUAL_PROVIDERS), amount: z.coerce.number().positive().max(10_000_000), note: z.string().max(300).optional() })
      .parse(raw);
    if (input.note && /\b(?:\d[ -]?){13,19}\b/.test(input.note)) throw new DomainError("validation", "Do not enter card numbers in notes.");
    const { supabase, r } = await loadReservation(input.reservation_id);
    const ctx = await assertPermission("payment.record", r.restaurant_id);
    const { data, error } = await supabase
      .from("payments")
      .insert({
        organization_id: r.organization_id,
        restaurant_id: r.restaurant_id,
        reservation_id: r.id,
        kind: input.kind,
        provider: input.provider,
        amount: input.amount,
        currency: r.restaurants?.currency ?? "THB",
        status: "succeeded",
        paid_at: new Date().toISOString(),
        note: input.note || null,
        recorded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) throw new DomainError("validation", error.message);
    revalidatePath(`/reservations/${r.id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

export async function createPaymentLinkAction(raw: unknown): Promise<ActionResult<{ url: string }>> {
  try {
    const input = z.object({ reservation_id: z.string().uuid(), kind: kinds, provider: z.string(), amount: z.coerce.number().positive() }).parse(raw);
    const gateway = GATEWAYS[input.provider];
    if (!gateway) throw new DomainError("validation", "Unknown payment provider");
    if (!gateway.isConfigured()) throw new DomainError("validation", `${gateway.name} is not configured. Add its API keys first.`);
    const { supabase, r } = await loadReservation(input.reservation_id);
    const ctx = await assertPermission("payment.record", r.restaurant_id);
    const currency = r.restaurants?.currency ?? "THB";
    const back = manageUrl(r.reference, r.id);
    const result = await gateway.createCheckout({
      amount: input.amount,
      currency,
      reference: r.reference,
      description: `${r.restaurants?.name ?? "T23"} ${input.kind.replace("_", " ")} – ${r.reference}`,
      successUrl: `${back}&paid=1`,
      cancelUrl: back,
      customerEmail: r.email,
      metadata: { reservation_id: r.id, reference: r.reference },
    });
    if (!result.ok) throw new DomainError("validation", `Payment provider error: ${result.error}`);
    const { error } = await supabase.from("payments").insert({
      organization_id: r.organization_id,
      restaurant_id: r.restaurant_id,
      reservation_id: r.id,
      kind: input.kind,
      provider: gateway.name,
      provider_reference: result.providerReference,
      checkout_url: result.checkoutUrl,
      amount: input.amount,
      currency,
      status: "pending",
      recorded_by: ctx.userId,
    });
    if (error) throw new DomainError("validation", error.message);
    revalidatePath(`/reservations/${r.id}`);
    return ok({ url: result.checkoutUrl });
  } catch (e) {
    return fail(e);
  }
}

export async function recordRefundAction(raw: unknown): Promise<ActionResult<{ message: string }>> {
  try {
    const input = z.object({ payment_id: z.string().uuid(), amount: z.coerce.number().positive(), reason: z.string().max(300).optional() }).parse(raw);
    const supabase = await createClient();
    const { data: p } = await supabase.from("payments").select("*").eq("id", input.payment_id).maybeSingle();
    if (!p) throw new DomainError("not_found", "Payment not found");
    const ctx = await assertPermission("payment.refund", p.restaurant_id);

    let status: "succeeded" | "pending" = "succeeded";
    let providerReference: string | null = null;
    let message = "Refund recorded";
    const gateway = GATEWAYS[p.provider];
    if (gateway && p.provider_reference) {
      if (!gateway.isConfigured()) throw new DomainError("validation", `${gateway.name} is not configured; cannot issue an online refund.`);
      const res = await gateway.refund(p.provider_reference, input.amount, p.currency);
      if (!res.ok) throw new DomainError("validation", res.error);
      status = res.pending ? "pending" : "succeeded";
      providerReference = res.providerReference;
      message = res.pending ? "Refund submitted to provider (pending)" : "Refund completed by provider";
    }
    const { error } = await supabase.from("refunds").insert({
      payment_id: p.id,
      amount: input.amount,
      reason: input.reason || null,
      status,
      provider_reference: providerReference,
      processed_by: ctx.userId,
      processed_at: status === "succeeded" ? new Date().toISOString() : null,
    });
    if (error) throw new DomainError("validation", error.message);
    revalidatePath(`/reservations/${p.reservation_id}`);
    return ok({ message });
  } catch (e) {
    return fail(e);
  }
}
