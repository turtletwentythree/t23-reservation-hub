import type { NotificationProvider } from "../types";
import { postForResult } from "../../http";

/** Converts Thai local numbers (0XXXXXXXXX) to E.164 (+66XXXXXXXXX). */
export function toE164(phone: string, defaultCountry = "66") {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+${defaultCountry}${digits.slice(1)}`;
  return `+${digits}`;
}

export const twilioSms: NotificationProvider = {
  channel: "sms",
  name: "twilio",
  isConfigured: () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
  async send({ to, body }) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    return postForResult(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: toE164(to), From: process.env.TWILIO_FROM_NUMBER!, Body: body }).toString(),
      },
      (j) => (j as { sid?: string } | null)?.sid ?? null,
    );
  },
};
