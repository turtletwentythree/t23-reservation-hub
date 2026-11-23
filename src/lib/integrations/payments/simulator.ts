import { randomBytes } from "node:crypto";
import type { PaymentGateway } from "./types";

/**
 * Payment simulator for demos and tests, before a real gateway account exists.
 * The payment page shows "Simulate successful / failed payment" buttons instead of a real form.
 *
 * Turned on only with PAYMENT_SIMULATOR=1, and never on a Vercel production deployment,
 * so guests can never confirm a real booking without paying.
 */
export function simulatorAllowed() {
  return process.env.PAYMENT_SIMULATOR === "1" && process.env.VERCEL_ENV !== "production";
}

export const simulatorGateway: PaymentGateway = {
  name: "simulator",
  isConfigured: simulatorAllowed,
  methods: () => ["simulator"],
  async createCharge() {
    return { ok: true, providerReference: `sim_${randomBytes(12).toString("hex")}`, status: "pending" };
  },
  // The simulator's state lives only in our payments table.
  async getStatus() {
    return null;
  },
  async createCheckout() {
    return { ok: false, error: "The payment simulator has no hosted checkout. Use the booking payment page." };
  },
  async refund() {
    return { ok: true, providerReference: null, pending: false };
  },
  async parseWebhook() {
    return null;
  },
};
