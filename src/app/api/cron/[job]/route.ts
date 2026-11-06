import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processDueNotifications, queueDueReminders } from "@/lib/integrations/notifications/service";
import { retryDueWebhooks } from "@/lib/integrations/webhooks";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return Boolean(secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret)));
}

/** Scheduled jobs (Vercel Cron): /api/cron/notifications every 10 min, /api/cron/reminders hourly. */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await params;
  if (job === "notifications") return NextResponse.json({ ...(await processDueNotifications()), ...(await retryDueWebhooks()) });
  if (job === "reminders") return NextResponse.json(await queueDueReminders());
  return NextResponse.json({ error: "unknown job" }, { status: 404 });
}
