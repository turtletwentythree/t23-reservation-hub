import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StaffContext } from "@/lib/auth/session";
import { getBookingSources } from "./common";

export async function getReservationFormData(ctx: StaffContext) {
  const supabase = await createClient();
  const ids = ctx.branchIds;
  const [{ data: tables }, sources, { data: types }] = await Promise.all([
    supabase.from("tables").select("id, label, max_capacity, restaurant_id, pos_x, pos_y, width, height, restaurant_areas(name)").in("restaurant_id", ids).eq("is_active", true).order("sort_order"),
    getBookingSources(),
    supabase.from("booking_types").select("id, restaurant_id, name").in("restaurant_id", ids).eq("is_active", true).order("sort_order"),
  ]);
  return {
    restaurants: ctx.restaurants.filter((r) => ids.includes(r.id) && r.is_active).map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
    tables: (tables ?? []).map((t) => ({ id: t.id, label: t.label, max_capacity: t.max_capacity, restaurant_id: t.restaurant_id, pos: { x: t.pos_x, y: t.pos_y, w: t.width, h: t.height }, area: t.restaurant_areas?.name ?? null })),
    sources: sources.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, code: s.code })),
    bookingTypes: (types ?? []).map((b) => ({ id: b.id, restaurant_id: b.restaurant_id, name: (b.name as Record<string, string>)?.en ?? "Booking" })),
  };
}
