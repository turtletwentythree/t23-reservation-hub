import type { PaymentGateway } from "./types";
import { stripeGateway } from "./stripe";
import { omiseGateway } from "./omise";

export const GATEWAYS: Record<string, PaymentGateway> = { stripe: stripeGateway, omise: omiseGateway };
export const MANUAL_PROVIDERS = ["manual_cash", "manual_transfer", "manual_card_terminal"] as const;

export function gatewayStatus() {
  return Object.values(GATEWAYS).map((g) => ({ name: g.name, configured: g.isConfigured() }));
}
