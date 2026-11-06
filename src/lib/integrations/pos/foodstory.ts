/**
 * FoodStory POS adapter — PENDING.
 * The vendor API (endpoints, auth, data model) has not been confirmed, so this adapter
 * does not call anything and returns no spend data. Reports show POS revenue as
 * "not available" rather than estimating it. Implement `fetchBills` once docs arrive.
 */
export interface PosBill {
  external_id: string;
  restaurant_slug: string;
  closed_at: string;
  table_label: string | null;
  covers: number | null;
  net_amount: number;
  currency: string;
  reservation_reference?: string | null;
}

export interface PosAdapter {
  name: string;
  status(): { state: "pending" | "not_configured" | "active"; label: string };
  fetchBills(since: Date): Promise<PosBill[]>;
}

export const foodstory: PosAdapter = {
  name: "foodstory",
  status() {
    return { state: "pending", label: "Pending vendor API access" };
  },
  async fetchBills() {
    throw new Error("FoodStory integration is pending: API access and documentation have not been confirmed.");
  },
};
