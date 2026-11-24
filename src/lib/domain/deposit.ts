/**
 * How much an online guest pays up front. Shared by the booking page (to show the amount)
 * and the server (which charges it), so the two never disagree.
 *
 * - A booking type (course) with its own deposit charges that amount per guest.
 * - "Full prepayment" with a priced course charges the course price per guest;
 *   without a price it charges the policy amount per booking.
 * - "Per person" charges the policy amount per guest, "flat" once per booking.
 * - Nothing is charged below the policy's minimum party size.
 * - A prepaid course price gets the policy's service charge, then VAT on top (Thai "++" pricing).
 */
export type DepositRule = { type: string; amount: number; minParty: number; serviceChargePct?: number; vatPct?: number };

export type PrepaymentBreakdown = { subtotal: number; serviceCharge: number; vat: number; total: number };

/** Line items for a full prepayment of a priced course; null when the booking is not one. */
export function prepaymentBreakdown(rule: DepositRule | null, partySize: number, typeDeposit?: number | null, typePrice?: number | null): PrepaymentBreakdown | null {
  if (typeDeposit != null || !rule || rule.type !== "full_prepayment" || partySize < rule.minParty || !(typePrice != null && typePrice > 0)) return null;
  const subtotal = round2(typePrice * partySize);
  const serviceCharge = round2((subtotal * (rule.serviceChargePct ?? 0)) / 100);
  const vat = round2(((subtotal + serviceCharge) * (rule.vatPct ?? 0)) / 100);
  return { subtotal, serviceCharge, vat, total: round2(subtotal + serviceCharge + vat) };
}

export function computeDeposit(rule: DepositRule | null, partySize: number, typeDeposit?: number | null, typePrice?: number | null): number {
  if (typeDeposit != null) return round2(typeDeposit * partySize);
  if (!rule || rule.type === "none" || partySize < rule.minParty) return 0;
  const prepaid = prepaymentBreakdown(rule, partySize, typeDeposit, typePrice);
  if (prepaid) return prepaid.total;
  if (rule.type === "per_person") return round2(rule.amount * partySize);
  return round2(rule.amount);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
