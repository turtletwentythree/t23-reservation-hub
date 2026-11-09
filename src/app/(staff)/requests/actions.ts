"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max).optional());

const requestSchema = z.object({
  restaurant_id: z.string().uuid(),
  channel: z.enum(["call", "line"]),
  customer_name: z.string().trim().min(1, "Guest name is required").max(120),
  phone: optionalText(40),
  line_id: optionalText(80),
  party_size: z.coerce.number().int().min(1).max(200),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  requested_time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  notes: optionalText(1000),
});

function missingTable(message: string) {
  return /booking_requests|does not exist|schema cache/i.test(message)
    ? new DomainError("validation", "Booking requests are not set up yet. Ask the Admin to run the latest database update.")
    : new DomainError("validation", message);
}

export async function createRequestAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = requestSchema.parse(raw);
    if (!input.phone && !input.line_id) throw new DomainError("validation", "Add a phone number or LINE ID so the store can reach the guest.");
    await assertPermission("request.create", input.restaurant_id);
    const supabase = await createClient();
    const { data: restaurant } = await supabase.from("restaurants").select("organization_id").eq("id", input.restaurant_id).maybeSingle();
    if (!restaurant) throw new DomainError("not_found", "Restaurant not found");
    const { data, error } = await supabase
      .from("booking_requests")
      .insert({ ...input, phone: input.phone ?? null, line_id: input.line_id ?? null, notes: input.notes ?? null, organization_id: restaurant.organization_id })
      .select("id")
      .single();
    if (error) throw missingTable(error.message);
    revalidatePath("/requests");
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

async function loadRequest(id: string) {
  z.string().uuid().parse(id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_requests").select("id, restaurant_id, status, created_by").eq("id", id).maybeSingle();
  if (error) throw missingTable(error.message);
  if (!data) throw new DomainError("not_found", "Request not found");
  return { supabase, request: data };
}

/** Store staff: the request cannot be booked (e.g. full). The Call Center sees the reason and calls the guest back. */
export async function declineRequestAction(id: string, reason: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, request } = await loadRequest(id);
    await assertPermission("request.handle", request.restaurant_id);
    if (request.status !== "pending") throw new DomainError("validation", "This request was already handled.");
    const { error } = await supabase
      .from("booking_requests")
      .update({ status: "declined", decline_reason: reason.trim().slice(0, 500) || "Fully booked" })
      .eq("id", id);
    if (error) throw missingTable(error.message);
    revalidatePath("/requests");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/** The person who logged it (or Store staff) withdraws a request that is still pending. */
export async function cancelRequestAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, request } = await loadRequest(id);
    const ctx = await assertPermission("request.create", request.restaurant_id);
    if (request.status !== "pending") throw new DomainError("validation", "This request was already handled.");
    if (!roleCan(ctx.role, "request.handle") && request.created_by !== ctx.userId) {
      throw new DomainError("forbidden", "You can only cancel requests you logged.");
    }
    const { error } = await supabase.from("booking_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) throw missingTable(error.message);
    revalidatePath("/requests");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/** Store staff: mark the request as keyed in, linked to the reservation just created. */
export async function linkRequestAction(id: string, reservationId: string): Promise<ActionResult<{ id: string }>> {
  try {
    z.string().uuid().parse(reservationId);
    const { supabase, request } = await loadRequest(id);
    await assertPermission("request.handle", request.restaurant_id);
    const { error } = await supabase.from("booking_requests").update({ status: "booked", reservation_id: reservationId }).eq("id", id);
    if (error) throw missingTable(error.message);
    revalidatePath("/requests");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
