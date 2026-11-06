export type Channel = "email" | "sms" | "line" | "whatsapp";

export interface OutboundMessage {
  to: string;
  subject?: string | null;
  body: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string; retryable: boolean };

/** Adapter contract. Swap providers without touching reservation logic. */
export interface NotificationProvider {
  channel: Channel;
  name: string;
  /** True only when real credentials are present. Unconfigured providers never report success. */
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}
