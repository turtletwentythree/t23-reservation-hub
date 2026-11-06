import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentGateway } from "./types";
import { toMinorUnits } from "./types";

const API = "https://api.stripe.com/v1";
const auth = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` });

async function stripe(path: string, body?: URLSearchParams, method = "POST") {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...auth(), ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body?.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe HTTP ${res.status}`);
  return json;
}

export const stripeGateway: PaymentGateway = {
  name: "stripe",
  isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async createCheckout(req) {
    try {
      const p = new URLSearchParams({
        mode: "payment",
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        client_reference_id: req.reference,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": req.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(toMinorUnits(req.amount, req.currency)),
        "line_items[0][price_data][product_data][name]": req.description,
      });
      if (req.customerEmail) p.set("customer_email", req.customerEmail);
      for (const [k, v] of Object.entries(req.metadata)) p.set(`metadata[${k}]`, v);
      const s = await stripe("/checkout/sessions", p);
      return { ok: true, providerReference: s.id, checkoutUrl: s.url };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  async refund(sessionId, amount, currency) {
    try {
      const session = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`, undefined, "GET");
      if (!session.payment_intent) return { ok: false, error: "Stripe session has no payment intent" };
      const r = await stripe("/refunds", new URLSearchParams({ payment_intent: session.payment_intent, amount: String(toMinorUnits(amount, currency)) }));
      return { ok: true, providerReference: r.id, pending: r.status !== "succeeded" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
  async parseWebhook(rawBody, headers) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = headers.get("stripe-signature");
    if (!secret || !sig) return null;
    const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=") as [string, string]));
    const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
    const given = Buffer.from(parts.v1 ?? "");
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(expected), given)) return null;
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null; // replay window
    const event = JSON.parse(rawBody);
    const obj = event?.data?.object;
    if (event.type === "checkout.session.completed" && obj?.payment_status === "paid") return { type: "payment.succeeded", providerReference: obj.id };
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") return { type: "payment.failed", providerReference: obj.id };
    return null;
  },
};
