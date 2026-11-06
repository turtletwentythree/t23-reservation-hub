import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, authenticateApiKey, resolveRestaurant } from "@/lib/api-auth";
import { getAvailability } from "@/lib/domain/reservation-service";

export async function GET(req: NextRequest) {
  const ctx = await authenticateApiKey(req, "availability:read");
  if (ctx instanceof NextResponse) return ctx;
  const p = z.object({ restaurant: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), party_size: z.coerce.number().int().min(1).max(50) }).safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return apiError(400, "invalid_request", "restaurant, date (YYYY-MM-DD) and party_size are required");
  const r = await resolveRestaurant(ctx, p.data.restaurant);
  if (!r) return apiError(404, "not_found", "Restaurant not found");
  const res = await getAvailability(createAdminClient(), { restaurantId: r.id, date: p.data.date, partySize: p.data.party_size, channel: "online" });
  if (!res.ok) return NextResponse.json({ restaurant: r.slug, date: p.data.date, available: [], reason: res.reason });
  return NextResponse.json({ restaurant: r.slug, date: p.data.date, timezone: r.timezone, duration_minutes: res.durationMinutes, available: res.slots.filter((s) => s.available).map((s) => s.time) });
}
