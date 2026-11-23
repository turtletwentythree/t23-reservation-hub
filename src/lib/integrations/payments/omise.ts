import type { ChargeStatus, PaymentGateway } from "./types";
import { toMinorUnits } from "./types";

/**
 * Omise / Opn Payments (Thailand).
 *
 * Guests pay on our own payment page:
 * - PromptPay: we create a charge with a `promptpay` source and show the QR that Omise returns.
 * - Card: Omise.js turns the card into a token in the guest's browser (card numbers never reach
 *   our server), we charge the token and send the guest to 3-D Secure when Omise asks for it.
 *
 * Test mode: use `skey_test_…` / `pkey_test_…` keys. Omise then never moves real money.
 *
 * Webhooks are not trusted by signature (Omise does not sign them); instead the event is
 * re-fetched from the Omise API using our secret key before acting on it.
 */
const API = "https://api.omise.co";
const auth = () => ({ Authorization: `Basic ${Buffer.from(`${process.env.OMISE_SECRET_KEY}:`).toString("base64")}` });

async function omise(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...auth(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.object === "error") throw new Error(json?.message ?? `Omise HTTP ${res.status}`);
  return json;
}

function chargeStatus(status: string | undefined): ChargeStatus {
  if (status === "successful") return "succeeded";
  if (status === "failed" || status === "expired" || status === "reversed") return "failed";
  return "pending";
}

export const omiseGateway: PaymentGateway = {
  name: "omise",
  isConfigured: () => Boolean(process.env.OMISE_SECRET_KEY),
  // Card needs the public key in the browser for Omise.js.
  methods: () => (process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY ? ["promptpay", "card"] : ["promptpay"]),

  async createCharge(req) {
    try {
      const base = {
        amount: toMinorUnits(req.amount, req.currency),
        currency: req.currency.toLowerCase(),
        description: req.description.slice(0, 255),
        metadata: req.metadata,
        return_uri: req.returnUrl,
      };
      if (req.method === "promptpay") {
        const c = await omise("/charges", { ...base, source: { type: "promptpay" } });
        return {
          ok: true,
          providerReference: c.id,
          status: chargeStatus(c.status),
          qrImageUrl: c.source?.scannable_code?.image?.download_uri,
          expiresAt: c.expires_at ?? undefined,
        };
      }
      if (req.method === "card") {
        if (!req.cardToken?.startsWith("tokn_")) return { ok: false, error: "Card details are missing. Please try again." };
        const c = await omise("/charges", { ...base, card: req.cardToken });
        if (c.status === "failed") return { ok: false, error: c.failure_message ?? "The card was declined." };
        return { ok: true, providerReference: c.id, status: chargeStatus(c.status), authorizeUrl: c.authorize_uri ?? undefined };
      }
      return { ok: false, error: "Unsupported payment method" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(ref) {
    try {
      if (ref.startsWith("chrg_")) return chargeStatus((await omise(`/charges/${encodeURIComponent(ref)}`)).status);
      return null;
    } catch {
      return null;
    }
  },

  // Older bookings used Omise payment links; kept so existing links still reconcile.
  async createCheckout(req) {
    try {
      const json = await omise("/links", {
        amount: toMinorUnits(req.amount, req.currency),
        currency: req.currency.toLowerCase(),
        title: req.description.slice(0, 255),
        description: `Reservation ${req.reference}`,
        multiple: false,
      });
      return { ok: true, providerReference: json.id, checkoutUrl: json.payment_uri };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async refund(chargeId, amount, currency) {
    try {
      if (!chargeId.startsWith("chrg_")) return { ok: false, error: "This payment was made by payment link. Refund it in the Omise dashboard, then record it here as a manual refund." };
      const r = await omise(`/charges/${encodeURIComponent(chargeId)}/refunds`, { amount: toMinorUnits(amount, currency) });
      return { ok: true, providerReference: r.id, pending: r.status !== "closed" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async parseWebhook(rawBody) {
    try {
      const body = JSON.parse(rawBody);
      if (!body?.id || !process.env.OMISE_SECRET_KEY) return null;
      const ev = await omise(`/events/${encodeURIComponent(body.id)}`);
      const charge = ev?.data;
      if (ev.key !== "charge.complete" || !charge?.id) return null;
      const s = chargeStatus(charge.status);
      if (s === "pending") return null;
      return { type: s === "succeeded" ? "payment.succeeded" : "payment.failed", providerReference: charge.id, altReference: charge.link ?? undefined };
    } catch {
      return null;
    }
  },
};
