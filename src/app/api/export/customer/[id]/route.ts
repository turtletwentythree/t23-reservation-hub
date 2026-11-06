import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

/** PDPA data-portability export of everything held about one guest. Super Admin only; logged as a DSR. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaffContext();
  if (!ctx || !roleCan(ctx.role, "customer.privacy")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [res, consents, tags, waitlists, notifications] = await Promise.all([
    supabase.from("reservations").select("reference, reservation_date, reservation_time, party_size, status, special_occasion, dietary_requirements, allergies, guest_notes, created_at, restaurants(name)").eq("customer_id", id),
    supabase.from("customer_consents").select("consent_type, granted, source, policy_version, created_at").eq("customer_id", id),
    supabase.from("customer_tag_assignments").select("customer_tags(name)").eq("customer_id", id),
    supabase.from("waitlists").select("queue_date, party_size, status, joined_at").eq("customer_id", id),
    supabase.from("notification_logs").select("event, channel, status, created_at").eq("customer_id", id),
  ]);
  await supabase.from("data_subject_requests").insert({ organization_id: customer.organization_id, customer_id: id, request_type: "export", status: "completed", processed_by: ctx.userId, processed_at: new Date().toISOString() });
  const profile = customer;
  const body = {
    exported_at: new Date().toISOString(),
    controller: "Turtle23 Restaurant Group",
    profile,
    reservations: res.data,
    consents: consents.data,
    tags: (tags.data ?? []).map((t) => t.customer_tags?.name),
    waitlist: waitlists.data,
    messages: notifications.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="guest_${id}.json"`, "Cache-Control": "no-store" },
  });
}
