"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { tableSchema } from "@/lib/validation/schemas";

const done = () => revalidatePath("/floor-plan");
function dbError(error: { message: string; code?: string }) {
  if (error.code === "23505") return new DomainError("conflict", "A table or area with that name already exists.");
  if (error.code === "23503") return new DomainError("conflict", "This table has reservations; deactivate it instead of deleting.");
  return new DomainError("validation", error.message);
}

export async function saveTableAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const t = tableSchema.parse(raw);
    await assertPermission("table.layout", t.restaurant_id);
    const supabase = await createClient();
    const { id, ...row } = t;
    const payload = { ...row, area_id: row.area_id ?? null };
    const { data, error } = id
      ? await supabase.from("tables").update(payload).eq("id", id).select("id").single()
      : await supabase.from("tables").insert({ ...payload, pos_x: 40, pos_y: 40, width: row.shape === "bar" ? 120 : 90, height: row.shape === "bar" ? 60 : 90 }).select("id").single();
    if (error) throw dbError(error);
    done();
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTableAction(id: string, restaurantId: string): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("table.layout", restaurantId);
    const supabase = await createClient();
    const { error } = await supabase.from("tables").delete().eq("id", id).eq("restaurant_id", restaurantId);
    if (error) throw dbError(error);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

const layoutSchema = z.array(z.object({ id: z.string().uuid(), pos_x: z.number().int().min(0).max(5000), pos_y: z.number().int().min(0).max(5000), width: z.number().int().min(20).max(600), height: z.number().int().min(20).max(600), rotation: z.number().int().min(0).max(359) })).max(300);

export async function saveLayoutAction(restaurantId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const items = layoutSchema.parse(raw);
    await assertPermission("table.layout", restaurantId);
    const supabase = await createClient();
    for (const it of items) {
      const { id, ...pos } = it;
      const { error } = await supabase.from("tables").update(pos).eq("id", id).eq("restaurant_id", restaurantId);
      if (error) throw dbError(error);
    }
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function createAreaAction(restaurantId: string, name: string): Promise<ActionResult<undefined>> {
  try {
    const n = z.string().trim().min(1).max(60).parse(name);
    await assertPermission("table.layout", restaurantId);
    const supabase = await createClient();
    const { error } = await supabase.from("restaurant_areas").insert({ restaurant_id: restaurantId, name: n });
    if (error) throw dbError(error);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function setTableStatusAction(tableId: string, status: "available" | "cleaning" | "out_of_service"): Promise<ActionResult<undefined>> {
  try {
    z.string().uuid().parse(tableId);
    z.enum(["available", "cleaning", "out_of_service"]).parse(status);
    await assertPermission("table.status");
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_table_service_status", { p_table_id: tableId, p_status: status });
    if (error) throw new DomainError("forbidden", error.message);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function saveCombinationAction(restaurantId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const c = z.object({ name: z.string().trim().min(1).max(40), table_ids: z.array(z.string().uuid()).min(2).max(8), min_capacity: z.coerce.number().int().min(1), max_capacity: z.coerce.number().int().min(1) }).parse(raw);
    if (c.max_capacity < c.min_capacity) throw new DomainError("validation", "Max capacity must be ≥ min.");
    await assertPermission("table.layout", restaurantId);
    const supabase = await createClient();
    const { data, error } = await supabase.from("table_combinations").insert({ restaurant_id: restaurantId, name: c.name, min_capacity: c.min_capacity, max_capacity: c.max_capacity }).select("id").single();
    if (error) throw dbError(error);
    const { error: e2 } = await supabase.from("table_combination_members").insert(c.table_ids.map((t) => ({ combination_id: data.id, table_id: t })));
    if (e2) throw dbError(e2);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCombinationAction(restaurantId: string, id: string): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("table.layout", restaurantId);
    const supabase = await createClient();
    const { error } = await supabase.from("table_combinations").delete().eq("id", id).eq("restaurant_id", restaurantId);
    if (error) throw dbError(error);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
