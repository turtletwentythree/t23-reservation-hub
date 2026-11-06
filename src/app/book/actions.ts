"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { publicBookingSchema, dateString, timeString } from "@/lib/validation/schemas";
import { createReservation, depositFor, DomainError, getAvailability, availabilityMessage, loadRestaurantConfig, updateReservationRow } from "@/lib/domain/reservation-service";
import { durationForParty, localToUtc } from "@/lib/domain/availability";
import { reservationEvent } from "@/lib/events";
import { GATEWAYS } from "@/lib/integrations/payments/registry";
import { manageToken, manageUrl, verifyManageToken } from "@/lib/tokens";

/**
 * Public (unauthenticated) booking actions. They run on the server with the service-role
 * client, so every input is validated, rate limited and restricted to public fields.
 */

async function publicRestaurant(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("restaurants").select("id, name, slug, timezone, currency, is_active, accepts_online_bookings").eq("slug", slug).maybeSingle();
  if (!data || !data.is_active || !data.accepts_online_bookings) throw new DomainError("not_found", "This restaurant is not accepting online bookings.");
  return data;
}

export async function getPublicSlotsAction(input: { slug: string; date: string; partySize: number; bookingTypeId?: string; ignoreReservationId?: string; token?: string }): Promise<ActionResult<{ times: string[]; reason?: string }>> {
  try {
    const args = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), date: dateString, partySize: z.number().int().min(1).max(50), bookingTypeId: z.string().uuid().optional(), ignoreReservationId: z.string().uuid().optional(), token: z.string().optional() }).parse(input);
    if (!(await rateLimit("public_slots", 120, 60))) throw new DomainError("policy", "Too many requests. Please wait a moment.");
    if (args.ignoreReservationId && !verifyManageToken(args.ignoreReservationId, args.token)) throw new DomainError("forbidden", "Invalid link");
    const r = await publicRestaurant(args.slug);
    const admin = createAdminClient();
    let duration: number | undefined;
    if (args.bookingTypeId) {
      const { data: bt } = await admin.from("booking_types").select("duration_minutes, restaurant_id, is_online, is_active").eq("id", args.bookingTypeId).maybeSingle();
      if (bt && bt.restaurant_id === r.id && bt.is_online && bt.is_active) duration = bt.duration_minutes ?? undefined;
    }
    const res = await getAvailability(admin, { restaurantId: r.id, date: args.date, partySize: args.partySize, channel: "online", durationOverride: duration, ignoreReservationId: args.ignoreReservationId });
    if (!res.ok) return ok({ times: [], reason: res.reason });
    // Only times — never table or other guests' details.
    return ok({ times: res.slots.filter((s) => s.available).map((s) => s.time) });
  } catch (e) {
    return fail(e);
  }
}

export async function publicBookAction(raw: unknown): Promise<ActionResult<{ redirect: string }>> {
  try {
    const input = publicBookingSchema.parse(raw);
    if (input.website) throw new DomainError("validation", "Invalid submission"); // honeypot
    if (!(await rateLimit("public_book", 8, 600))) throw new DomainError("policy", "Too many booking attempts. Please try again later.");
    if (!(await rateLimit("public_book_phone", 5, 3600, input.phone.replace(/\D/g, "")))) throw new DomainError("policy", "Too many bookings for this phone number. Please contact the restaurant.");

    const r = await publicRestaurant(input.restaurant_slug);
    const admin = createAdminClient();
    const config = await loadRestaurantConfig(admin, r.id);
    const policy = config.policyRow;

    let duration = durationForParty(config.policy, input.party_size);
    let typeDeposit: number | null = null;
    if (input.booking_type_id) {
      const { data: bt } = await admin.from("booking_types").select("*").eq("id", input.booking_type_id).maybeSingle();
      if (!bt || bt.restaurant_id !== r.id || !bt.is_online || !bt.is_active) throw new DomainError("validation", "Invalid booking type");
      if (bt.duration_minutes) duration = bt.duration_minutes;
      typeDeposit = bt.deposit_override === null ? null : Number(bt.deposit_override);
    }
    const deposit = depositFor(policy, input.party_size, typeDeposit);
    const needsApproval = !policy?.auto_confirm_online || (policy?.large_party_threshold != null && input.party_size >= policy.large_party_threshold);
    const status = needsApproval || deposit > 0 ? "pending" : "confirmed";
    const { data: online } = await admin.from("booking_sources").select("id").eq("organization_id", config.restaurant.organization_id).eq("code", "online").maybeSingle();

    const res = await createReservation(
      admin,
      {
        restaurant_id: r.id,
        customer_name: input.customer_name,
        phone: input.phone,
        email: input.email,
        language: input.language,
        reservation_date: input.reservation_date,
        reservation_time: input.reservation_time,
        party_size: input.party_size,
        duration_minutes: duration,
        booking_source_id: online?.id,
        booking_type_id: input.booking_type_id,
        table_ids: [],
        auto_assign: true,
        allow_over_capacity: false,
        special_occasion: input.special_occasion,
        dietary_requirements: input.dietary_requirements,
        allergies: input.allergies,
        guest_notes: input.guest_notes,
        deposit_amount: deposit,
        payment_status: deposit > 0 ? "pending" : "not_required",
        status,
        is_walk_in: false,
        policy_accepted: true,
        actor_label: "online_booking",
      },
      "online",
    );

    // PDPA consent ledger
    if (res.customer_id) {
      await admin.from("customer_consents").insert([
        { customer_id: res.customer_id, consent_type: "data_processing", granted: true, source: "online_booking" },
        { customer_id: res.customer_id, consent_type: "marketing_email", granted: input.marketing_consent, source: "online_booking" },
      ]);
    }

    let redirect = `/reservation/${res.reference}?t=${manageToken(res.id)}&new=1`;
    if (deposit > 0) {
      const gateway = Object.values(GATEWAYS).find((g) => g.isConfigured());
      if (gateway) {
        const back = manageUrl(res.reference, res.id);
        const co = await gateway.createCheckout({
          amount: deposit, currency: r.currency, reference: res.reference, description: `${r.name} deposit – ${res.reference}`,
          successUrl: `${back}&paid=1`, cancelUrl: back, customerEmail: input.email, metadata: { reservation_id: res.id, reference: res.reference },
        });
        if (co.ok) {
          await admin.from("payments").insert({
            organization_id: config.restaurant.organization_id, restaurant_id: r.id, reservation_id: res.id, kind: "deposit",
            provider: gateway.name, provider_reference: co.providerReference, checkout_url: co.checkoutUrl, amount: deposit, currency: r.currency, status: "pending",
          });
          redirect = co.checkoutUrl;
        }
      }
    }
    await reservationEvent(res.id, "created");
    return ok({ redirect });
  } catch (e) {
    return fail(e);
  }
}

async function loadGuestReservation(reference: string, token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("reservations").select("*, restaurants(slug, timezone, name)").eq("reference", reference).maybeSingle();
  if (!data || !verifyManageToken(data.id, token)) throw new DomainError("forbidden", "Invalid link");
  const { data: policy } = await admin.from("booking_policies").select("*").eq("restaurant_id", data.restaurant_id).maybeSingle();
  return { admin, r: data, policy };
}

export async function guestCancelAction(reference: string, token: string): Promise<ActionResult<undefined>> {
  try {
    if (!(await rateLimit("guest_manage", 20, 600))) throw new DomainError("policy", "Too many requests.");
    const { admin, r, policy } = await loadGuestReservation(reference, token);
    if (!["pending", "confirmed"].includes(r.status)) throw new DomainError("policy", "This reservation can no longer be cancelled online.");
    const cutoff = (policy?.cancellation_cutoff_hours ?? 24) * 3600_000;
    if (new Date(r.starts_at).getTime() - Date.now() < cutoff) throw new DomainError("policy", "The online cancellation deadline has passed. Please contact the restaurant.");
    await updateReservationRow(admin, r.id, { status: "cancelled", cancellation_reason: "Cancelled by guest online" });
    await reservationEvent(r.id, "cancelled");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function guestModifyAction(reference: string, token: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    if (!(await rateLimit("guest_manage", 20, 600))) throw new DomainError("policy", "Too many requests.");
    const input = z.object({ reservation_date: dateString, reservation_time: timeString, party_size: z.number().int().min(1).max(50) }).parse(raw);
    const { admin, r, policy } = await loadGuestReservation(reference, token);
    if (!["pending", "confirmed"].includes(r.status)) throw new DomainError("policy", "This reservation can no longer be changed online.");
    const cutoff = (policy?.modification_cutoff_hours ?? 24) * 3600_000;
    if (new Date(r.starts_at).getTime() - Date.now() < cutoff) throw new DomainError("policy", "The online change deadline has passed. Please contact the restaurant.");
    const tz = r.restaurants?.timezone ?? "Asia/Bangkok";
    if (localToUtc(input.reservation_date, input.reservation_time, tz).getTime() - Date.now() < cutoff) throw new DomainError("policy", "The new time is too soon to book online.");

    const avail = await getAvailability(admin, { restaurantId: r.restaurant_id, date: input.reservation_date, partySize: input.party_size, channel: "online", ignoreReservationId: r.id });
    if (!avail.ok) throw new DomainError("policy", availabilityMessage(avail.reason));
    const slot = avail.slots.find((s) => s.time === input.reservation_time);
    if (!slot?.available || !slot.best) throw new DomainError("slot_unavailable", "That time is not available.");
    const duration = durationForParty(avail.config.policy, input.party_size);
    // Release current tables first so the move cannot conflict with itself, then assign the new best option.
    // If the new tables were taken in the meantime, restore the original booking (compensating action).
    const { data: oldTables } = await admin.from("reservation_tables").select("table_id").eq("reservation_id", r.id);
    const original = { reservation_date: r.reservation_date, reservation_time: r.reservation_time.slice(0, 5), party_size: r.party_size, duration_minutes: r.duration_minutes };
    await admin.from("reservation_tables").delete().eq("reservation_id", r.id);
    await updateReservationRow(admin, r.id, { reservation_date: input.reservation_date, reservation_time: input.reservation_time, party_size: input.party_size, duration_minutes: duration });
    const { error } = await admin.rpc("assign_reservation_tables", { p_reservation_id: r.id, p_table_ids: slot.best.table_ids, p_allow_over_capacity: false });
    if (error) {
      await updateReservationRow(admin, r.id, original);
      await admin.rpc("assign_reservation_tables", { p_reservation_id: r.id, p_table_ids: (oldTables ?? []).map((t) => t.table_id), p_allow_over_capacity: true });
      throw new DomainError("slot_unavailable", "That time was just taken. Please choose another time.");
    }
    await reservationEvent(r.id, "updated");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
