"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { monthDays } from "@/lib/domain/capacity-check";

const cap = z.number().int().min(0).max(5000).nullable();

export async function saveCapacityAction(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const input = z
      .object({
        restaurant_id: z.string().uuid(),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        default_capacity: cap,
        days: z.array(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), capacity: cap, note: z.string().max(200).nullable() })).max(31),
        zones: z.array(z.object({ area_id: z.string().uuid(), default_capacity: cap })).max(30).default([]),
        zone_days: z.array(z.object({ area_id: z.string().uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), capacity: cap })).max(31 * 30).default([]),
      })
      .parse(raw);
    await assertPermission("restaurant.manage", input.restaurant_id);
    const inMonth = new Set(monthDays(input.month));
    if (input.days.some((d) => !inMonth.has(d.day))) throw new DomainError("validation", "Invalid date");
    const supabase = await createClient();
    const notInstalled = (m: string) =>
      /daily_capacity|daily_zone_capacity|default_daily_capacity|does not exist|schema cache/i.test(m)
        ? new DomainError("validation", "Daily capacity is not set up yet. Ask the Admin to run the latest database update.")
        : new DomainError("validation", m);

    const { error: e1 } = await supabase.from("restaurants").update({ default_daily_capacity: input.default_capacity }).eq("id", input.restaurant_id);
    if (e1) throw notInstalled(e1.message);

    const set = input.days.filter((d) => d.capacity !== null || d.note);
    const clear = input.days.filter((d) => d.capacity === null && !d.note).map((d) => d.day);
    if (set.length) {
      const { error } = await supabase
        .from("daily_capacity")
        .upsert(set.map((d) => ({ restaurant_id: input.restaurant_id, day: d.day, capacity: d.capacity, note: d.note || null, updated_at: new Date().toISOString() })), { onConflict: "restaurant_id,day" });
      if (error) throw notInstalled(error.message);
    }
    if (clear.length) {
      const { error } = await supabase.from("daily_capacity").delete().eq("restaurant_id", input.restaurant_id).in("day", clear);
      if (error) throw notInstalled(error.message);
    }
    if (input.zones.length || input.zone_days.length) {
      const ids = [...new Set([...input.zones.map((z) => z.area_id), ...input.zone_days.map((z) => z.area_id)])];
      const { data: owned, error: eo } = await supabase.from("restaurant_areas").select("id").eq("restaurant_id", input.restaurant_id).in("id", ids);
      if (eo) throw notInstalled(eo.message);
      const okIds = new Set((owned ?? []).map((a) => a.id));
      if (ids.some((id) => !okIds.has(id))) throw new DomainError("validation", "Invalid zone");
      if (input.zone_days.some((d) => !inMonth.has(d.day))) throw new DomainError("validation", "Invalid date");
      for (const z of input.zones) {
        const { error } = await supabase.from("restaurant_areas").update({ default_daily_capacity: z.default_capacity }).eq("id", z.area_id).eq("restaurant_id", input.restaurant_id);
        if (error) throw notInstalled(error.message);
      }
      const zset = input.zone_days.filter((d) => d.capacity !== null);
      if (zset.length) {
        const { error } = await supabase
          .from("daily_zone_capacity")
          .upsert(zset.map((d) => ({ restaurant_id: input.restaurant_id, area_id: d.area_id, day: d.day, capacity: d.capacity as number, updated_at: new Date().toISOString() })), { onConflict: "area_id,day" });
        if (error) throw notInstalled(error.message);
      }
      for (const z of ids) {
        const clear = input.zone_days.filter((d) => d.area_id === z && d.capacity === null).map((d) => d.day);
        if (!clear.length) continue;
        const { error } = await supabase.from("daily_zone_capacity").delete().eq("area_id", z).in("day", clear);
        if (error) throw notInstalled(error.message);
      }
    }
    revalidatePath("/capacity");
    revalidatePath("/availability");
    revalidatePath("/dashboard");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
