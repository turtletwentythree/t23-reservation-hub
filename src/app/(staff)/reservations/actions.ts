"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { reservationInputSchema, reservationUpdateSchema } from "@/lib/validation/schemas";
import {
  assignTables,
  createReservation,
  DomainError,
  getAvailability,
  availabilityMessage,
  updateReservationRow,
} from "@/lib/domain/reservation-service";
import { canTransition } from "@/lib/domain/status";
import { durationForParty } from "@/lib/domain/availability";
import { reservationEvent } from "@/lib/events";
import type { ReservationStatus } from "@/lib/supabase/types";

export type SlotView = {
  time: string;
  service: string;
  available: boolean;
  options: { table_ids: string[]; labels: string[]; capacity: number; kind: string }[];
};

export async function getSlotsAction(input: {
  restaurantId: string;
  date: string;
  partySize: number;
  ignoreReservationId?: string;
  durationMinutes?: number;
}): Promise<ActionResult<{ slots: SlotView[]; durationMinutes: number }>> {
  try {
    const args = z
      .object({
        restaurantId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        partySize: z.number().int().min(1).max(200),
        ignoreReservationId: z.string().uuid().optional(),
        durationMinutes: z.number().int().min(15).max(600).optional(),
      })
      .parse(input);
    await assertPermission("reservation.view", args.restaurantId);
    const supabase = await createClient();
    const res = await getAvailability(supabase, {
      restaurantId: args.restaurantId,
      date: args.date,
      partySize: args.partySize,
      channel: "staff",
      ignoreReservationId: args.ignoreReservationId,
      durationOverride: args.durationMinutes,
    });
    if (!res.ok) return { ok: false, error: availabilityMessage(res.reason) };
    return ok({
      durationMinutes: res.durationMinutes,
      slots: res.slots.map((s) => ({
        time: s.time,
        service: s.service,
        available: s.available,
        options: s.options.slice(0, 8).map((o) => ({ table_ids: o.table_ids, labels: o.labels, capacity: o.capacity, kind: o.kind })),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function createReservationAction(raw: unknown): Promise<ActionResult<{ id: string; reference: string }>> {
  try {
    const input = reservationInputSchema.parse(raw);
    await assertPermission("reservation.write", input.restaurant_id);
    const supabase = await createClient();
    const res = await createReservation(supabase, { ...input, payment_status: input.deposit_amount > 0 ? "pending" : "not_required" }, "staff");
    await reservationEvent(res.id, "created");
    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    return ok({ id: res.id, reference: res.reference });
  } catch (e) {
    return fail(e);
  }
}

export async function updateReservationAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = reservationUpdateSchema.parse(raw);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("reservations").select("*").eq("id", input.id).maybeSingle();
    if (!existing) throw new DomainError("not_found", "Reservation not found");
    await assertPermission("reservation.write", existing.restaurant_id);

    const { data: policy } = await supabase.from("booking_policies").select("*").eq("restaurant_id", existing.restaurant_id).maybeSingle();
    const timeChanged =
      existing.reservation_date !== input.reservation_date ||
      existing.reservation_time.slice(0, 5) !== input.reservation_time ||
      existing.party_size !== input.party_size;
    const duration =
      input.duration_minutes ?? (timeChanged && policy ? durationForParty(policy as never, input.party_size) : existing.duration_minutes);

    // Updating date/time moves the table periods via trigger; the exclusion constraint rejects conflicts.
    await updateReservationRow(supabase, input.id, {
      customer_name: input.customer_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      language: input.language,
      reservation_date: input.reservation_date,
      reservation_time: input.reservation_time,
      party_size: input.party_size,
      duration_minutes: duration,
      booking_source_id: input.booking_source_id ?? null,
      booking_type_id: input.booking_type_id ?? null,
      special_occasion: input.special_occasion ?? null,
      dietary_requirements: input.dietary_requirements ?? null,
      allergies: input.allergies ?? null,
      guest_notes: input.guest_notes ?? null,
      internal_notes: input.internal_notes ?? null,
      deposit_amount: input.deposit_amount,
    });
    if (input.table_ids.length > 0 || input.reassign_tables) {
      await assignTables(supabase, input.id, input.table_ids, input.allow_over_capacity);
    }
    if (timeChanged) await reservationEvent(input.id, "updated");
    revalidatePath(`/reservations/${input.id}`);
    revalidatePath("/reservations");
    return ok({ id: input.id });
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(id: string, status: ReservationStatus, reason?: string): Promise<ActionResult<{ id: string }>> {
  try {
    z.string().uuid().parse(id);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("reservations").select("id, restaurant_id, status, email, phone").eq("id", id).maybeSingle();
    if (!existing) throw new DomainError("not_found", "Reservation not found");
    await assertPermission("reservation.write", existing.restaurant_id);
    if (!canTransition(existing.status, status)) {
      throw new DomainError("validation", `Cannot change a ${existing.status} reservation to ${status}.`);
    }
    await updateReservationRow(supabase, id, {
      status,
      ...(status === "cancelled" ? { cancellation_reason: reason?.slice(0, 500) || "Cancelled by staff" } : {}),
    });
    if (status === "cancelled") await reservationEvent(id, "cancelled");
    revalidatePath(`/reservations/${id}`);
    revalidatePath("/reservations");
    revalidatePath("/floor-plan");
    revalidatePath("/dashboard");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function assignTablesAction(id: string, tableIds: string[], allowOverCapacity = false): Promise<ActionResult<{ id: string }>> {
  try {
    z.string().uuid().parse(id);
    z.array(z.string().uuid()).max(10).parse(tableIds);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("reservations").select("restaurant_id").eq("id", id).maybeSingle();
    if (!existing) throw new DomainError("not_found", "Reservation not found");
    await assertPermission("reservation.write", existing.restaurant_id);
    await assignTables(supabase, id, tableIds, allowOverCapacity);
    revalidatePath(`/reservations/${id}`);
    revalidatePath("/floor-plan");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteReservationAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase.from("reservations").select("restaurant_id").eq("id", id).maybeSingle();
    if (!existing) throw new DomainError("not_found", "Reservation not found");
    await assertPermission("reservation.delete", existing.restaurant_id);
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) throw new DomainError("validation", error.message);
    revalidatePath("/reservations");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function searchCustomersAction(term: string): Promise<ActionResult<{ id: string; full_name: string; phone: string | null; email: string | null; is_vip: boolean; allergies: string | null; total_visits: number }[]>> {
  try {
    await assertPermission("customer.view");
    const t = term.trim();
    if (t.length < 2) return ok([]);
    const supabase = await createClient();
    const digits = t.replace(/[^0-9]/g, "");
    const safe = t.replace(/[%_,()]/g, " ");
    let q = supabase.from("customers").select("id, full_name, phone, email, is_vip, allergies, total_visits").is("anonymized_at", null).limit(8);
    q = digits.length >= 4 ? q.ilike("phone_normalized", `%${digits.replace(/^0/, "")}%`) : q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ok(data ?? []);
  } catch (e) {
    return fail(e);
  }
}
