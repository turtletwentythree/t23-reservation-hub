"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { policySchema, restaurantSchema, timeString, dateString, bool } from "@/lib/validation/schemas";

function dbError(error: { message: string; code?: string }) {
  if (error.code === "23505") return new DomainError("conflict", "That slug or name is already in use.");
  if (error.code === "42501") return new DomainError("forbidden", "You do not have permission to do that.");
  return new DomainError("validation", error.message);
}

export async function createRestaurantAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = restaurantSchema.parse(raw);
    const ctx = await assertPermission("restaurant.create");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("restaurants")
      .insert({ ...input, organization_id: ctx.organizationId })
      .select("id")
      .single();
    if (error) throw dbError(error);
    // Sensible defaults so the restaurant is bookable once tables exist.
    await supabase.from("booking_policies").insert({ restaurant_id: data.id });
    await supabase.from("restaurant_areas").insert({ restaurant_id: data.id, name: "Main Dining" });
    await supabase.from("operating_hours").insert(
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({ restaurant_id: data.id, day_of_week: d, service_name: "Dinner", open_time: "17:30", close_time: "22:30", last_seating_time: "21:00" })),
    );
    revalidatePath("/restaurants");
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateRestaurantAction(id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = restaurantSchema.parse(raw);
    await assertPermission("restaurant.manage", id);
    const supabase = await createClient();
    const { error, data } = await supabase.from("restaurants").update(input).eq("id", id).select("id").maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new DomainError("forbidden", "You cannot edit this restaurant.");
    revalidatePath(`/restaurants/${id}`);
    revalidatePath("/restaurants");
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function updatePolicyAction(restaurantId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const input = policySchema.parse(raw);
    await assertPermission("restaurant.manage", restaurantId);
    const supabase = await createClient();
    const { cancellation_policy_en, cancellation_policy_th, cancellation_policy_ja, large_party_threshold, ...rest } = input;
    const row = {
      ...rest,
      large_party_threshold: large_party_threshold ?? null,
      duration_rules: [...input.duration_rules].sort((a, b) => a.max_party - b.max_party),
      cancellation_policy: { en: cancellation_policy_en ?? "", th: cancellation_policy_th ?? "", ja: cancellation_policy_ja ?? "" },
      restaurant_id: restaurantId,
    };
    const { error } = await supabase.from("booking_policies").upsert(row, { onConflict: "restaurant_id" });
    if (error) throw dbError(error);
    revalidatePath(`/restaurants/${restaurantId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

const hoursRow = z.object({
  id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6).nullable(),
  specific_date: dateString.nullable(),
  service_name: z.string().trim().min(1).max(40),
  open_time: timeString.nullable(),
  close_time: timeString.nullable(),
  last_seating_time: timeString.nullable(),
  is_closed: z.boolean(),
});

export async function saveHoursAction(restaurantId: string, rows: unknown): Promise<ActionResult<undefined>> {
  try {
    const list = z.array(hoursRow).max(60).parse(rows);
    for (const r of list) {
      if (!r.is_closed && (!r.open_time || !r.close_time || r.close_time <= r.open_time)) {
        throw new DomainError("validation", `${r.service_name}: closing time must be after opening time.`);
      }
      if (!r.is_closed && r.last_seating_time && (r.last_seating_time < r.open_time! || r.last_seating_time > r.close_time!)) {
        throw new DomainError("validation", `${r.service_name}: last seating must be within opening hours.`);
      }
    }
    await assertPermission("restaurant.manage", restaurantId);
    const supabase = await createClient();
    const { error: delErr } = await supabase.from("operating_hours").delete().eq("restaurant_id", restaurantId);
    if (delErr) throw dbError(delErr);
    if (list.length) {
      const { error } = await supabase.from("operating_hours").insert(
        list.map(({ id: _id, ...r }) => ({
          ...r,
          restaurant_id: restaurantId,
          open_time: r.is_closed ? null : r.open_time,
          close_time: r.is_closed ? null : r.close_time,
          last_seating_time: r.is_closed ? null : r.last_seating_time,
        })),
      );
      if (error) throw dbError(error);
    }
    revalidatePath(`/restaurants/${restaurantId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

const bookingTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().trim().min(1).max(100),
  name_th: z.string().trim().max(100).optional(),
  name_ja: z.string().trim().max(100).optional(),
  price: z.coerce.number().min(0).optional().or(z.literal("").transform(() => undefined)),
  duration_minutes: z.coerce.number().int().min(15).max(600).optional().or(z.literal("").transform(() => undefined)),
  deposit_override: z.coerce.number().min(0).optional().or(z.literal("").transform(() => undefined)),
  is_online: bool(true),
  is_active: bool(true),
});

export async function saveBookingTypeAction(restaurantId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const b = bookingTypeSchema.parse(raw);
    await assertPermission("restaurant.manage", restaurantId);
    const supabase = await createClient();
    const row = {
      restaurant_id: restaurantId,
      name: { en: b.name_en, th: b.name_th || b.name_en, ja: b.name_ja || b.name_en },
      price: b.price ?? null,
      duration_minutes: b.duration_minutes ?? null,
      deposit_override: b.deposit_override ?? null,
      is_online: b.is_online,
      is_active: b.is_active,
    };
    const { error } = b.id ? await supabase.from("booking_types").update(row).eq("id", b.id) : await supabase.from("booking_types").insert(row);
    if (error) throw dbError(error);
    revalidatePath(`/restaurants/${restaurantId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
