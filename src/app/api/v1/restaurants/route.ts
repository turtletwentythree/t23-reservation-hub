import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey } from "@/lib/api-auth";

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req, "availability:read");
  if (ctx instanceof NextResponse) return ctx;
  let q = createAdminClient().from("restaurants").select("slug, name, cuisine, timezone, currency, accepts_online_bookings").eq("organization_id", ctx.organizationId).eq("is_active", true);
  if (ctx.restaurantId) q = q.eq("id", ctx.restaurantId);
  const { data } = await q.order("name");
  return NextResponse.json({ data });
}
