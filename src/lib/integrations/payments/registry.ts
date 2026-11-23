import type { PaymentGateway } from "./types";
import { stripeGateway } from "./stripe";
import { omiseGateway } from "./omise";
import { simulatorGateway } from "./simulator";

export const GATEWAYS: Record<string, PaymentGateway> = { omise: omiseGateway, stripe: stripeGateway, simulator: simulatorGateway };
export const MANUAL_PROVIDERS = ["manual_cash", "manual_transfer", "manual_card_terminal"] as const;

export function gatewayStatus() {
  // The simulator has no hosted checkout, so staff cannot send payment links through it.
  return Object.values(GATEWAYS).filter((g) => g.name !== "simulator").map((g) => ({ name: g.name, configured: g.isConfigured() }));
}

/**
 * The gateway used for online booking payments. PAYMENT_GATEWAY picks one explicitly
 * (omise, stripe or simulator); otherwise the first configured real gateway, then the simulator.
 */
export function bookingGateway(): PaymentGateway | null {
  const wanted = process.env.PAYMENT_GATEWAY;
  if (wanted && GATEWAYS[wanted]?.isConfigured()) return GATEWAYS[wanted];
  return [omiseGateway, stripeGateway, simulatorGateway].find((g) => g.isConfigured()) ?? null;
}
