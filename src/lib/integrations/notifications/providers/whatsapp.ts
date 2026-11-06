import type { NotificationProvider } from "../types";
import { postForResult } from "../../http";
import { toE164 } from "./twilio";

/** WhatsApp Cloud API (optional). Note: business-initiated messages outside 24h need approved templates. */
export const whatsappCloud: NotificationProvider = {
  channel: "whatsapp",
  name: "whatsapp_cloud",
  isConfigured: () => Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  async send({ to, body }) {
    return postForResult(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: toE164(to).replace("+", ""), type: "text", text: { body } }),
      },
      (j) => (j as { messages?: { id: string }[] } | null)?.messages?.[0]?.id ?? null,
    );
  },
};
