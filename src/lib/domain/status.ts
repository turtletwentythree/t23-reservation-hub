import type { ReservationStatus } from "@/lib/supabase/types";

export const RESERVATION_STATUSES: ReservationStatus[] = ["pending", "confirmed", "arrived", "seated", "completed", "cancelled", "no_show"];

export const STATUS_META: Record<ReservationStatus, { label: string; tone: "yellow" | "brand" | "blue" | "purple" | "slate" | "red" | "orange"; color: string }> = {
  pending: { label: "Pending", tone: "yellow", color: "#f59e0b" },
  confirmed: { label: "Confirmed", tone: "brand", color: "#2f7d4f" },
  arrived: { label: "Arrived", tone: "blue", color: "#0ea5e9" },
  seated: { label: "Seated", tone: "purple", color: "#8b5cf6" },
  completed: { label: "Completed", tone: "slate", color: "#64748b" },
  cancelled: { label: "Cancelled", tone: "red", color: "#ef4444" },
  no_show: { label: "No-show", tone: "orange", color: "#e8772e" },
};

/** Allowed status transitions for staff. Terminal states can be reopened to "confirmed" by staff (with history). */
export const STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "arrived", "seated", "cancelled", "no_show"],
  confirmed: ["pending", "arrived", "seated", "cancelled", "no_show"],
  arrived: ["seated", "confirmed", "cancelled", "no_show"],
  seated: ["completed", "arrived"],
  completed: ["seated"],
  cancelled: ["confirmed", "pending"],
  no_show: ["confirmed", "arrived", "seated"],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus) {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

export const ACTIVE_STATUSES: ReservationStatus[] = ["pending", "confirmed", "arrived", "seated"];
