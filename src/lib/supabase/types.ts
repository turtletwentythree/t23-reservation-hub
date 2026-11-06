import type { Database } from "./database.types";

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type AppRole = Enums<"app_role">;
export type ReservationStatus = Enums<"reservation_status">;
export type Restaurant = Tables<"restaurants">;
export type Reservation = Tables<"reservations">;
export type DiningTable = Tables<"tables">;
export type Customer = Tables<"customers">;
export type BookingPolicy = Tables<"booking_policies">;
export type OperatingHours = Tables<"operating_hours">;
