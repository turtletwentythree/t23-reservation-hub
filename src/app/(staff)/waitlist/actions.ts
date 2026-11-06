"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { createReservation, DomainError } from "@/lib/domain/reservation-service";
import { waitlistSchema } from "@/lib/validation/schemas";
import { queueWaitlistNotification } from "@/lib/integrations/notifications/service";

const refresh = () => { revalidatePath("/waitlist"); revalidatePath("/dashboard"); };

export async function addToWaitlistAction(raw: unknown): Promise<ActionResult<{ queue_number: number }>> {
  try {
    const input = waitlistSchema.parse(raw);
    await assertPermission("waitlist.write", input.restaurant_id);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("waitlists")
      .insert({ ...input, quoted_wait_minutes: input.quoted_wait_minutes ?? null, queue_date: undefined as unknown as string, queue_number: 0 })
      .select("queue_number")
      .single();
    if (error) throw new DomainError("validation", error.message);
    refresh();
    return ok({ queue_number: data.queue_number });
  } catch (e) {
    return fail(e);
  }
}

async function loadEntry(id: string) {
  z.string().uuid().parse(id);
  const supabase = await createClient();
  const { data } = await supabase.from("waitlists").select("*, restaurants(timezone)").eq("id", id).maybeSingle();
  if (!data) throw new DomainError("not_found", "Queue entry not found");
  await assertPermission("waitlist.write", data.restaurant_id);
  return { supabase, w: data };
}

export async function notifyWaitlistAction(id: string): Promise<ActionResult<{ queued: number }>> {
  try {
    const { supabase, w } = await loadEntry(id);
    const { queued } = await queueWaitlistNotification(w.id);
    await supabase.from("waitlists").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", id);
    refresh();
    return ok({ queued });
  } catch (e) {
    return fail(e);
  }
}

export async function setWaitlistStatusAction(id: string, status: "left" | "cancelled" | "waiting"): Promise<ActionResult<undefined>> {
  try {
    z.enum(["left", "cancelled", "waiting"]).parse(status);
    const { supabase } = await loadEntry(id);
    await supabase.from("waitlists").update({ status, left_at: status === "waiting" ? null : new Date().toISOString() }).eq("id", id);
    refresh();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

/** Seat a queued party: creates a seated walk-in reservation on the chosen table(s), then closes the queue entry. */
export async function seatWaitlistAction(id: string, tableIds: string[]): Promise<ActionResult<{ reservation_id: string }>> {
  try {
    z.array(z.string().uuid()).min(1).max(6).parse(tableIds);
    const { supabase, w } = await loadEntry(id);
    const tz = w.restaurants?.timezone ?? "Asia/Bangkok";
    const now = new Date();
    const { data: walkIn } = await supabase.from("booking_sources").select("id").eq("code", "walk_in").maybeSingle();
    const res = await createReservation(
      supabase,
      {
        restaurant_id: w.restaurant_id,
        customer_id: w.customer_id ?? undefined,
        customer_name: w.customer_name,
        phone: w.phone ?? undefined,
        language: "en",
        reservation_date: formatInTimeZone(now, tz, "yyyy-MM-dd"),
        reservation_time: formatInTimeZone(now, tz, "HH:mm"),
        party_size: w.party_size,
        booking_source_id: walkIn?.id,
        table_ids: tableIds,
        auto_assign: false,
        allow_over_capacity: false,
        guest_notes: w.notes ?? undefined,
        deposit_amount: 0,
        status: "seated",
        is_walk_in: true,
      },
      "staff",
    );
    await supabase.from("waitlists").update({ status: "seated", seated_at: now.toISOString(), table_id: tableIds[0], reservation_id: res.id }).eq("id", id);
    refresh();
    revalidatePath("/floor-plan");
    return ok({ reservation_id: res.id });
  } catch (e) {
    return fail(e);
  }
}
