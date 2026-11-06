import type { PaymentGateway } from "./types";
import { toMinorUnits } from "./types";

/**
 * Omise (Thailand) via the Links API (hosted payment page: cards, PromptPay, etc.).
 * Webhooks are not trusted by signature (Omise does not sign them); instead the
 * event is re-fetched from the Omise API using our secret key before acting on it.
 */
const auth = () => ({ Authorization: `Basic ${Buffer.from(`${process.env.OMISE_SECRET_KEY}:`).toString("base64")}` });

export const omiseGateway: PaymentGateway = {
  name: "omise",
  isConfigured: () => Boolean(process.env.OMISE_SECRET_KEY),
  async createCheckout(req) {
    try {
      const res = await fetch("https://api.omise.co/links", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: toMinorUnits(req.amount, req.currency),
          currency: req.currency.toLowerCase(),
          title: req.description.slice(0, 255),
          description: `Reservation ${req.reference}`,
          multiple: false,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json?.message ?? `Omise HTTP ${res.status}` };
      return { ok: true, providerReference: json.id, checkoutUrl: json.payment_uri };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  async refund() {
    return { ok: false, error: "Automatic Omise refunds are not enabled yet. Refund in the Omise dashboard, then record it here as a manual refund." };
  },
  async parseWebhook(rawBody) {
    try {
      const body = JSON.parse(rawBody);
      if (!body?.id || !process.env.OMISE_SECRET_KEY) return null;
      const res = await fetch(`https://api.omise.co/events/${encodeURIComponent(body.id)}`, { headers: auth(), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const ev = await res.json();
      const charge = ev?.data;
      const linkId: string | undefined = charge?.link ?? undefined;
      if (ev.key === "charge.complete" && linkId) {
        return { type: charge.status === "successful" ? "payment.succeeded" : "payment.failed", providerReference: linkId };
      }
      return null;
    } catch {
      return null;
    }
  },
};
