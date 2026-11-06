import { NextResponse, type NextRequest } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || !roleCan(ctx.role, "reservation.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const from = p.get("from") ?? new Date().toISOString().slice(0, 10);
  const to = p.get("to") ?? from;
  const supabase = await createClient();
  let q = supabase
    .from("reservations")
    .select("reference, reservation_date, reservation_time, customer_name, phone, email, party_size, status, special_occasion, allergies, deposit_amount, payment_status, created_at, restaurants(name), booking_sources(name), reservation_tables(tables(label))")
    .in("restaurant_id", ctx.branchIds)
    .gte("reservation_date", from)
    .lte("reservation_date", to)
    .order("starts_at")
    .limit(10000);
  if (p.get("status")) q = q.eq("status", p.get("status") as "confirmed");
  if (p.get("source")) q = q.eq("booking_source_id", p.get("source")!);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const header = ["Reference", "Restaurant", "Date", "Time", "Guest", "Phone", "Email", "Pax", "Tables", "Status", "Source", "Occasion", "Allergies", "Deposit", "Payment", "Created"];
  const lines = (data ?? []).map((r) =>
    [r.reference, r.restaurants?.name, r.reservation_date, r.reservation_time.slice(0, 5), r.customer_name, r.phone, r.email, r.party_size,
      r.reservation_tables.map((t) => t.tables?.label).join("+"), r.status, r.booking_sources?.name, r.special_occasion, r.allergies, r.deposit_amount, r.payment_status, r.created_at].map(csvCell).join(","),
  );
  return new NextResponse("﻿" + [header.join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reservations_${from}_${to}.csv"`, "Cache-Control": "no-store" },
  });
}
