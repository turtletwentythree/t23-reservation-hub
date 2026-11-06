"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { dispatch } from "@/lib/integrations/notifications/service";

export async function retryNotificationAction(id: string): Promise<ActionResult<{ status: string }>> {
  try {
    z.string().uuid().parse(id);
    // Read through the user's client first so RLS decides whether they may see this log.
    const supabase = await createClient();
    const { data: log } = await supabase.from("notification_logs").select("*").eq("id", id).maybeSingle();
    if (!log) throw new DomainError("not_found", "Notification not found");
    await assertPermission("notification.view", log.restaurant_id ?? undefined);
    const admin = createAdminClient();
    const { data: fresh } = await admin.from("notification_logs").update({ status: "queued", max_attempts: log.attempts + 3 }).eq("id", id).select("*").single();
    const status = await dispatch(fresh!);
    revalidatePath("/notifications");
    return ok({ status });
  } catch (e) {
    return fail(e);
  }
}

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  event: z.enum(["booking_confirmation", "booking_reminder", "booking_modification", "booking_cancellation", "waitlist_ready", "birthday_campaign"]),
  channel: z.enum(["email", "sms", "line", "whatsapp"]),
  locale: z.enum(["en", "th", "ja", "fr"]),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  is_active: z.boolean().default(true),
});

export async function saveTemplateAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = templateSchema.parse(raw);
    const ctx = await assertPermission("notification.templates");
    const supabase = await createClient();
    const row = { ...input, subject: input.subject || null, organization_id: ctx.organizationId };
    const { data, error } = input.id
      ? await supabase.from("notification_templates").update(row).eq("id", input.id).select("id").single()
      : await supabase.from("notification_templates").insert(row).select("id").single();
    if (error) throw new DomainError("validation", error.message.includes("duplicate") ? "A template for this event, channel and language already exists." : error.message);
    revalidatePath("/notifications");
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}
