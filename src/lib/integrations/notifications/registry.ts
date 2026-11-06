import type { Channel, NotificationProvider } from "./types";
import { resendEmail } from "./providers/resend";
import { twilioSms } from "./providers/twilio";
import { linePush } from "./providers/line";
import { whatsappCloud } from "./providers/whatsapp";

export const PROVIDERS: Record<Channel, NotificationProvider> = {
  email: resendEmail,
  sms: twilioSms,
  line: linePush,
  whatsapp: whatsappCloud,
};
