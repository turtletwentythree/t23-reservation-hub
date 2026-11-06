import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Reservation } from "@/lib/supabase/types";
import {
  computeAvailability,
  durationForParty,
  localToUtc,
  type AvailabilityResult,
  type Channel,
  type CombinationInput,
  type HoursInput,
  type PolicyInput,
  type TableInput,
  type TableOption,
} from "./availability";

type Client = SupabaseClient<Database>;

export class DomainError extends Error {
  constructor(
    public code:
      | "not_found"
      | "slot_unavailable"
      | "capacity_conflict"
      | "closed"
      | "validation"
      | "forbidden"
      | "policy"
      | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const DEFAULT_POLICY: PolicyInput = {
  default_duration_minutes: 120,
  duration_rules: [],
  buffer_minutes: 15,
  slot_interval_minutes: 15,
  min_party_size: 1,
  max_party_size: 8,
  min_advance_minutes: 60,
  max_advance_days: 60,
};

export async function loadRestaurantConfig(client: Client, restaurantId: string) {
  const [restaurant, policy, hours, tables, combos] = await Promise.all([
    client.from("restaurants").select("*").eq("id", restaurantId).maybeSingle(),
    client.from("booking_policies").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
    client.from("operating_hours").select("*").eq("restaurant_id", restaurantId),
    client.from("tables").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    client.from("table_combinations").select("*, table_combination_members(table_id)").eq("restaurant_id", restaurantId),
  ]);
  if (!restaurant.data) throw new DomainError("not_found", "Restaurant not found");
  const combinations: CombinationInput[] = (combos.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    min_capacity: c.min_capacity,
    max_capacity: c.max_capacity,
    is_active: c.is_active,
    table_ids: (c.table_combination_members ?? []).map((m: { table_id: string }) => m.table_id),
  }));
  return {
    restaurant: restaurant.data,
    policyRow: policy.data,
    policy: (policy.data ?? DEFAULT_POLICY) as PolicyInput,
    hours: (hours.data ?? []) as HoursInput[],
    tables: (tables.data ?? []) as (TableInput & Database["public"]["Tables"]["tables"]["Row"])[],
    combinations,
  };
}

export type RestaurantConfig = Awaited<ReturnType<typeof loadRestaurantConfig>>;

export async function loadOccupancy(client: Client, restaurantId: string, date: string, timezone: string) {
  // Window covers the whole local day plus spill-over from late bookings.
  const from = localToUtc(date, "00:00", timezone);
  const to = new Date(from.getTime() + 36 * 3600_000);
  const { data, error } = await client.rpc("table_occupancy", {
    p_restaurant_id: restaurantId,
    p_from: new Date(from.getTime() - 12 * 3600_000).toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => ({
    table_id: o.table_id,
    reservation_id: o.reservation_id,
    start: new Date(o.starts),
    end: new Date(o.ends),
  }));
}

export async function getAvailability(
  client: Client,
  args: {
    restaurantId: string;
    date: string;
    partySize: number;
    channel: Channel;
    durationOverride?: number | null;
    ignoreReservationId?: string;
    config?: RestaurantConfig;
  },
): Promise<AvailabilityResult & { config: RestaurantConfig }> {
  const config = args.config ?? (await loadRestaurantConfig(client, args.restaurantId));
  const occupancy = await loadOccupancy(client, args.restaurantId, args.date, config.restaurant.timezone);
  const result = computeAvailability({
    date: args.date,
    partySize: args.partySize,
    timezone: config.restaurant.timezone,
    policy: config.policy,
    hours: config.hours,
    tables: config.tables,
    combinations: config.combinations,
    occupancy,
    now: new Date(),
    channel: args.channel,
    durationOverride: args.durationOverride,
    ignoreReservationId: args.ignoreReservationId,
  });
  return { ...result, config };
}

export function depositFor(policy: Database["public"]["Tables"]["booking_policies"]["Row"] | null, partySize: number, bookingTypeDeposit?: number | null) {
  if (bookingTypeDeposit != null) return bookingTypeDeposit * partySize;
  if (!policy || policy.deposit_type === "none" || partySize < policy.deposit_min_party_size) return 0;
  const amount = Number(policy.deposit_amount);
  if (policy.deposit_type === "per_person") return amount * partySize;
  return amount; // flat or full_prepayment (amount = prepayment per booking)
}

function mapDbError(error: { code?: string; message: string; hint?: string | null }): DomainError {
  if (error.code === "23P01") return new DomainError("slot_unavailable", "That table was just booked for an overlapping time. Please pick another time or table.");
  if (error.hint === "capacity_conflict") return new DomainError("capacity_conflict", error.message);
  if (error.hint === "table_out_of_service") return new DomainError("conflict", error.message);
  if (error.code === "42501") return new DomainError("forbidden", "You do not have permission for this restaurant.");
  if (error.code === "P0002") return new DomainError("not_found", error.message);
  return new DomainError("validation", error.message);
}

export interface CreateArgs {
  restaurant_id: string;
  customer_id?: string;
  customer_name: string;
  phone?: string;
  email?: string;
  language: "en" | "th" | "ja" | "fr";
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  duration_minutes?: number;
  booking_source_id?: string;
  booking_type_id?: string;
  table_ids: string[];
  auto_assign: boolean;
  allow_over_capacity: boolean;
  special_occasion?: string;
  dietary_requirements?: string;
  allergies?: string;
  guest_notes?: string;
  internal_notes?: string;
  deposit_amount: number;
  payment_status?: Database["public"]["Enums"]["payment_status"];
  status: Database["public"]["Enums"]["reservation_status"];
  is_walk_in: boolean;
  policy_accepted?: boolean;
  manage_token_hash?: string;
  actor_label?: string;
}

/**
 * Creates a reservation. When no tables are given and auto_assign is on, the
 * engine picks the best option; if a concurrent booking wins the race the next
 * option is tried. Staff may also book without tables (assign later).
 */
export async function createReservation(client: Client, args: CreateArgs, channel: Channel): Promise<Reservation> {
  const config = await loadRestaurantConfig(client, args.restaurant_id);
  const duration = args.duration_minutes ?? durationForParty(config.policy, args.party_size);

  let candidates: string[][] = [];
  if (args.table_ids.length > 0) {
    candidates = [args.table_ids];
  } else if (args.auto_assign || channel === "online") {
    const avail = await getAvailability(client, {
      restaurantId: args.restaurant_id,
      date: args.reservation_date,
      partySize: args.party_size,
      channel,
      durationOverride: duration,
      config,
    });
    if (!avail.ok) {
      throw new DomainError(avail.reason === "closed" ? "closed" : "policy", availabilityMessage(avail.reason));
    }
    const slot = avail.slots.find((s) => s.time === args.reservation_time.slice(0, 5));
    if (channel === "online" && (!slot || !slot.available)) {
      throw new DomainError("slot_unavailable", "Sorry, this time is no longer available. Please choose another time.");
    }
    candidates = (slot?.options ?? []).slice(0, 3).map((o: TableOption) => o.table_ids);
    if (candidates.length === 0) candidates = [[]]; // staff: create unassigned (e.g. waitlisted/over-booked) booking
  } else {
    candidates = [[]];
  }

  let lastError: DomainError | null = null;
  for (const tableIds of candidates) {
    const { data, error } = await client.rpc("create_reservation", {
      payload: {
        ...args,
        duration_minutes: duration,
        table_ids: tableIds,
      },
    });
    if (!error && data) return data as Reservation;
    lastError = mapDbError(error!);
    if (lastError.code !== "slot_unavailable") break;
  }
  throw lastError ?? new DomainError("slot_unavailable", "No table available");
}

export function availabilityMessage(reason: string) {
  switch (reason) {
    case "closed":
      return "The restaurant is closed on this date.";
    case "party_size_out_of_range":
      return "This party size cannot be booked online. Please contact the restaurant.";
    case "outside_booking_window":
      return "This date is outside the booking window.";
    default:
      return "Invalid date.";
  }
}

/** Assign tables, re-checking for conflicts at the DB layer. */
export async function assignTables(client: Client, reservationId: string, tableIds: string[], allowOverCapacity = false) {
  const { error } = await client.rpc("assign_reservation_tables", {
    p_reservation_id: reservationId,
    p_table_ids: tableIds,
    p_allow_over_capacity: allowOverCapacity,
  });
  if (error) throw mapDbError(error);
}

export async function updateReservationRow(client: Client, id: string, patch: Database["public"]["Tables"]["reservations"]["Update"]) {
  const { data, error } = await client.from("reservations").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new DomainError("not_found", "Reservation not found or not accessible");
  return data as Reservation;
}
