import type { NotificationProvider } from "../types";
import { postForResult } from "../../http";

export const resendEmail: NotificationProvider = {
  channel: "email",
  name: "resend",
  isConfigured: () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  async send({ to, subject, body }) {
    return postForResult(
      "https://api.resend.com/emails",
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: subject ?? "T23 Reservation", text: body }),
      },
      (j) => (j as { id?: string } | null)?.id ?? null,
    );
  },
};
