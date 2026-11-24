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
export type WebhookEvent = { type: "payment.succeeded" | "payment.failed"; providerReference: string; altReference?: string } | null;

export type PaymentMethod = "promptpay" | "card" | "checkout" | "simulator";
export type ChargeStatus = "pending" | "succeeded" | "failed";

/** A charge made on our own payment page (PromptPay QR or a card tokenised in the browser). */
export interface ChargeRequest {
  amount: number; // major units
  currency: string;
  reference: string;
  description: string;
  method: PaymentMethod;
  /** Card token created in the browser by the gateway's JS (card numbers never reach our server). */
  cardToken?: string;
  /** Where the gateway sends the guest back after 3-D Secure. */
  returnUrl: string;
  metadata: Record<string, string>;
}

export type ChargeResult =
  | { ok: true; providerReference: string; status: ChargeStatus; qrImageUrl?: string; authorizeUrl?: string; expiresAt?: string }
  | { ok: false; error: string };

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
  /** Payment methods this gateway can take on our own payment page. Hosted checkout is "checkout". */
  methods(): PaymentMethod[];
  /** Direct charge for PromptPay / card. Gateways that only offer hosted checkout leave this out. */
  createCharge?(req: ChargeRequest): Promise<ChargeResult>;
  /** Ask the gateway for the current state of a charge or checkout, so the page does not wait on the webhook. */
  getStatus(providerReference: string): Promise<ChargeStatus | null>;
}

/** Zero-decimal currencies per provider conventions. THB/JPY handling differs: THB uses satang (x100). */
export function toMinorUnits(amount: number, currency: string) {
  return ["JPY", "KRW", "VND"].includes(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}
