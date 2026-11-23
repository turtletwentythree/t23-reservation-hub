/**
 * How much an online guest pays up front. Shared by the booking page (to show the amount)
 * and the server (which charges it), so the two never disagree.
 *
 * - A booking type (course) with its own deposit charges that amount per guest.
 * - "Full prepayment" with a priced course charges the course price per guest;
 *   without a price it charges the policy amount per booking.
 * - "Per person" charges the policy amount per guest, "flat" once per booking.
 * - Nothing is charged below the policy's minimum party size.
 */
export type DepositRule = { type: string; amount: number; minParty: number };

export function computeDeposit(rule: DepositRule | null, partySize: number, typeDeposit?: number | null, typePrice?: number | null): number {
  if (typeDeposit != null) return round2(typeDeposit * partySize);
  if (!rule || rule.type === "none" || partySize < rule.minParty) return 0;
  if (rule.type === "full_prepayment" && typePrice != null && typePrice > 0) return round2(typePrice * partySize);
  if (rule.type === "per_person") return round2(rule.amount * partySize);
  return round2(rule.amount);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
