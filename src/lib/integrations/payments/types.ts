export interface CheckoutRequest {
  amount: number; // major units, e.g. 1500.00 THB
  currency: string;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
}

export type CheckoutResult = { ok: true; providerReference: string; checkoutUrl: string } | { ok: false; error: string };
export type RefundResult = { ok: true; providerReference: string | null; pending: boolean } | { ok: false; error: string };
export type WebhookEvent = { type: "payment.succeeded" | "payment.failed"; providerReference: string } | null;

/**
 * Payment gateway adapter. Card data never touches this system: guests pay on the
 * provider's hosted page, we store only the provider's reference ids.
 */
export interface PaymentGateway {
  name: string;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  refund(providerReference: string, amount: number, currency: string): Promise<RefundResult>;
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
}

/** Zero-decimal currencies per provider conventions. THB/JPY handling differs: THB uses satang (x100). */
export function toMinorUnits(amount: number, currency: string) {
  return ["JPY", "KRW", "VND"].includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}
