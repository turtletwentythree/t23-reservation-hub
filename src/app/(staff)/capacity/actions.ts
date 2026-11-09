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
        closed_days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(31).optional(),
        tables: z.array(z.object({ id: z.string().uuid(), max_capacity: z.number().int().min(1).max(200) })).max(200).default([]),
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
    // Closed days (holidays): a date override with no service. Stops bookings and shows as Closed everywhere.
    if (input.closed_days) {
      const want = new Set(input.closed_days.filter((d) => inMonth.has(d)));
      const days = [...inMonth].sort();
      const { data: existing, error: eh } = await supabase
        .from("operating_hours")
        .select("id, specific_date")
        .eq("restaurant_id", input.restaurant_id)
        .eq("is_closed", true)
        .gte("specific_date", days[0])
        .lte("specific_date", days[days.length - 1]);
      if (eh) throw new DomainError("validation", eh.message);
      const have = new Map((existing ?? []).map((h) => [h.specific_date as string, h.id]));
      const drop = [...have.entries()].filter(([d]) => !want.has(d)).map(([, id]) => id);
      const add = [...want].filter((d) => !have.has(d));
      if (drop.length) {
        const { error } = await supabase.from("operating_hours").delete().in("id", drop);
        if (error) throw new DomainError("validation", error.message);
      }
      if (add.length) {
        const { error } = await supabase.from("operating_hours").insert(add.map((d) => ({ restaurant_id: input.restaurant_id, specific_date: d, is_closed: true, service_name: "Closed" })));
        if (error) throw new DomainError("validation", error.message);
      }
    }

    // Seats per table.
    if (input.tables.length) {
      const { data: current, error: et } = await supabase.from("tables").select("id, min_capacity").eq("restaurant_id", input.restaurant_id).in("id", input.tables.map((x) => x.id));
      if (et) throw new DomainError("validation", et.message);
      const minOf = new Map((current ?? []).map((x) => [x.id, x.min_capacity]));
      for (const tb of input.tables) {
        if (!minOf.has(tb.id)) throw new DomainError("validation", "Invalid table");
        const { error } = await supabase.from("tables").update({ max_capacity: tb.max_capacity, min_capacity: Math.min(minOf.get(tb.id)!, tb.max_capacity) }).eq("id", tb.id).eq("restaurant_id", input.restaurant_id);
        if (error) throw new DomainError("validation", error.message);
      }
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
