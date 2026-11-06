import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, authenticateApiKey } from "@/lib/api-auth";
import { updateReservationRow } from "@/lib/domain/reservation-service";
import { reservationEvent } from "@/lib/events";

async function load(ctxOrg: string, ctxRestaurant: string | null, reference: string) {
  const { data } = await createAdminClient().from("reservations").select("id, reference, organization_id, restaurant_id, reservation_date, reservation_time, party_size, status, deposit_amount, payment_status, restaurants(slug)").eq("reference", reference).maybeSingle();
  if (!data || data.organization_id !== ctxOrg || (ctxRestaurant && data.restaurant_id !== ctxRestaurant)) return null;
  return data;
}

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const ctx = await authenticateApiKey(req, "reservations:read");
  if (ctx instanceof NextResponse) return ctx;
  const r = await load(ctx.organizationId, ctx.restaurantId, (await params).reference);
  if (!r) return apiError(404, "not_found", "Reservation not found");
  return NextResponse.json({ reference: r.reference, restaurant: r.restaurants?.slug, date: r.reservation_date, time: r.reservation_time.slice(0, 5), party_size: r.party_size, status: r.status, deposit_amount: Number(r.deposit_amount), payment_status: r.payment_status });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const ctx = await authenticateApiKey(req, "reservations:write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ status: z.literal("cancelled"), reason: z.string().max(300).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request", "Only {\"status\":\"cancelled\"} is supported");
  const r = await load(ctx.organizationId, ctx.restaurantId, (await params).reference);
  if (!r) return apiError(404, "not_found", "Reservation not found");
  if (!["pending", "confirmed"].includes(r.status)) return apiError(409, "invalid_state", `Reservation is ${r.status}`);
  await updateReservationRow(createAdminClient(), r.id, { status: "cancelled", cancellation_reason: parsed.data.reason ?? "Cancelled via API" });
  await reservationEvent(r.id, "cancelled");
  return NextResponse.json({ reference: r.reference, status: "cancelled" });
}
