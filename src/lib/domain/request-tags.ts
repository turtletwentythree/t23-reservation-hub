/**
 * Guest type for interim Call Center bookings (Internal / KOL / Media).
 * Stored as a tag at the start of the request notes and the reservation's
 * internal notes, e.g. "[KOL] window seat", so this temporary flow needs no
 * extra database column.
 */
export const CUSTOMER_TYPES = ["internal", "kol", "media"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = { internal: "Internal", kol: "KOL", media: "Media" };

export function withCustomerType(type: CustomerType, notes?: string | null): string {
  const rest = (notes ?? "").trim();
  return `[${CUSTOMER_TYPE_LABELS[type]}]${rest ? ` ${rest}` : ""}`;
}

export function splitCustomerType(notes: string | null | undefined): { type: CustomerType | null; notes: string } {
  const m = (notes ?? "").match(/^\[(Internal|KOL|Media)\]\s*([\s\S]*)$/i);
  if (!m) return { type: null, notes: notes ?? "" };
  const k = m[1].toLowerCase();
  return { type: k === "kol" ? "kol" : k === "media" ? "media" : "internal", notes: m[2] };
}
