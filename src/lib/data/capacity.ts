import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { loadRestaurantConfig, type RestaurantConfig } from "@/lib/domain/reservation-service";
import { buildCapacityMonth, monthDays } from "@/lib/domain/capacity-check";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Seats from the active tables: the fallback when no daily capacity is set. */
export function tableSeats(config: RestaurantConfig) {
  return config.tables.filter((t) => t.is_active && t.service_status !== "out_of_service").reduce((a, t) => a + t.max_capacity, 0);
}

/** Daily capacity settings for a month: default per restaurant and per-day overrides. Tolerates the setting not being installed yet. */
export async function loadCapacitySettings(supabase: Client, restaurantId: string, from: string, to: string) {
  const [{ data: rest, error: e1 }, { data: days, error: e2 }] = await Promise.all([
    supabase.from("restaurants").select("default_daily_capacity").eq("id", restaurantId).maybeSingle(),
    supabase.from("daily_capacity").select("day, capacity, note").eq("restaurant_id", restaurantId).gte("day", from).lte("day", to),
  ]);
  return {
    installed: !e1 && !e2,
    defaultCapacity: e1 ? null : (rest?.default_daily_capacity ?? null),
    overrides: new Map((e2 ? [] : (days ?? [])).map((d) => [d.day, { capacity: d.capacity, note: d.note }])),
  };
}

export async function loadCapacityMonth(supabase: Client, restaurantId: string, month: string, config?: RestaurantConfig) {
  const cfg = config ?? (await loadRestaurantConfig(supabase, restaurantId));
  const days = monthDays(month);
  const from = days[0];
  const to = days[days.length - 1];
  const [settings, { data: resRows }, requests] = await Promise.all([
    loadCapacitySettings(supabase, restaurantId, from, to),
    supabase
      .from("reservations")
      .select("reservation_date, party_size, internal_notes")
      .eq("restaurant_id", restaurantId)
      .gte("reservation_date", from)
      .lte("reservation_date", to)
      .not("status", "in", "(cancelled,no_show)"),
    supabase
      .from("booking_requests")
      .select("requested_date, party_size")
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending")
      .gte("requested_date", from)
      .lte("requested_date", to),
  ]);
  const seatsFromTables = tableSeats(cfg);
  const base = settings.defaultCapacity ?? seatsFromTables;
  const rows = buildCapacityMonth({
    month,
    seats: (d) => settings.overrides.get(d)?.capacity ?? base,
    hours: cfg.hours,
    reservations: (resRows ?? []).map((r) => ({ date: r.reservation_date, party: r.party_size, notes: r.internal_notes })),
    waiting: requests.error ? [] : (requests.data ?? []).map((r) => ({ date: r.requested_date, party: r.party_size })),
  });
  return { rows, config: cfg, settings, base, seatsFromTables, notes: settings.overrides };
}
