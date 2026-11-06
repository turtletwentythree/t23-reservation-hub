import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, authenticateApiKey, resolveRestaurant } from "@/lib/api-auth";
import { createReservation, DomainError, depositFor, loadRestaurantConfig } from "@/lib/domain/reservation-service";
import { dateString, timeString, phoneString } from "@/lib/validation/schemas";
import { reservationEvent } from "@/lib/events";
import { manageUrl } from "@/lib/tokens";

const body = z.object({
  restaurant: z.string(),
  date: dateString,
  time: timeString,
  party_size: z.number().int().min(1).max(50),
  customer: z.object({ name: z.string().trim().min(1).max(120), phone: phoneString.optional(), email: z.string().email().optional(), language: z.enum(["en", "th", "ja"]).default("en") }),
  notes: z.string().max(1000).optional(),
  allergies: z.string().max(500).optional(),
  special_occasion: z.string().max(120).optional(),
  external_reference: z.string().max(100).optional(),
  channel: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req, "reservations:write");
  if (ctx instanceof NextResponse) return ctx;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const b = parsed.data;
  const r = await resolveRestaurant(ctx, b.restaurant);
  if (!r) return apiError(404, "not_found", "Restaurant not found");
  const admin = createAdminClient();
  const config = await loadRestaurantConfig(admin, r.id);
  const { data: src } = await admin.from("booking_sources").select("id").eq("organization_id", ctx.organizationId).eq("code", "api").maybeSingle();
  const deposit = depositFor(config.policyRow, b.party_size);
  try {
    const res = await createReservation(admin, {
      restaurant_id: r.id, customer_name: b.customer.name, phone: b.customer.phone, email: b.customer.email, language: b.customer.language,
      reservation_date: b.date, reservation_time: b.time, party_size: b.party_size, booking_source_id: src?.id, table_ids: [], auto_assign: true, allow_over_capacity: false,
      guest_notes: b.notes, allergies: b.allergies, special_occasion: b.special_occasion,
      internal_notes: [b.channel && `Channel: ${b.channel}`, b.external_reference && `External ref: ${b.external_reference}`].filter(Boolean).join(" · ") || undefined,
      deposit_amount: deposit, payment_status: deposit > 0 ? "pending" : "not_required", status: deposit > 0 || !config.policyRow?.auto_confirm_online ? "pending" : "confirmed",
      is_walk_in: false, actor_label: `api_key:${ctx.id}`,
    }, "online");
    await reservationEvent(res.id, "created");
    return NextResponse.json({ reference: res.reference, status: res.status, date: res.reservation_date, time: res.reservation_time.slice(0, 5), party_size: res.party_size, deposit_amount: Number(res.deposit_amount), manage_url: manageUrl(res.reference, res.id) }, { status: 201 });
  } catch (e) {
    if (e instanceof DomainError) return apiError(e.code === "slot_unavailable" ? 409 : 422, e.code, e.message);
    console.error(e);
    return apiError(500, "internal_error", "Unexpected error");
  }
}
