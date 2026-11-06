import type { NotificationProvider } from "../types";
import { postForResult } from "../../http";

/**
 * LINE Messaging API push message. Recipient must be a LINE userId (obtained when the
 * guest follows the restaurant's LINE OA / logs in with LINE), not a phone number.
 */
export const linePush: NotificationProvider = {
  channel: "line",
  name: "line",
  isConfigured: () => Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
  async send({ to, body }) {
    return postForResult(
      "https://api.line.me/v2/bot/message/push",
      {
        headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, messages: [{ type: "text", text: body.slice(0, 5000) }] }),
      },
      (j) => (j as { sentMessages?: { id: string }[] } | null)?.sentMessages?.[0]?.id ?? null,
    );
  },
};
