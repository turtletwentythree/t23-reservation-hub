import { NextResponse, type NextRequest } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { csvCell } from "@/lib/utils";
import { getStaffT } from "@/lib/i18n/staff-server";
import { buildReservationsXlsx, XLSX_COLUMNS, type XlsxRow } from "@/lib/export/reservations-xlsx";

export async function GET(req: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || !roleCan(ctx.role, "reservation.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const from = p.get("from") ?? new Date().toISOString().slice(0, 10);
  const to = p.get("to") ?? from;
  const supabase = await createClient();
  const search = (p.get("q") ?? "").trim().replace(/[%_,()]/g, " ");
  // Same filters for the CSV and the Excel file; only the columns differ.
  const build = (columns: string) => {
    let q = supabase
      .from("reservations")
      .select(columns)
      .in("restaurant_id", ctx.branchIds)
      .gte("reservation_date", from)
      .lte("reservation_date", to)
      .order("starts_at")
      .limit(10000);
    if (p.get("status")) q = q.eq("status", p.get("status") as "confirmed");
    if (p.get("source")) q = q.eq("booking_source_id", p.get("source")!);
    if (p.get("restaurant")) q = q.eq("restaurant_id", p.get("restaurant")!);
    if (search) q = q.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%,reference.ilike.%${search}%,email.ilike.%${search}%`);
    return q;
  };
  if (p.get("format") === "xlsx") {
    const { data, error } = await build(XLSX_COLUMNS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { t } = await getStaffT();
    const buf = await buildReservationsXlsx((data ?? []) as unknown as XlsxRow[], t);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reservations_${from}_${to}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const { data, error } = await build("reference, reservation_date, reservation_time, customer_name, phone, email, party_size, status, special_occasion, allergies, deposit_amount, payment_status, created_at, restaurants(name), booking_sources(name), reservation_tables(tables(label))");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const header = ["Reference", "Restaurant", "Date", "Time", "Guest", "Phone", "Email", "Pax", "Tables", "Status", "Source", "Occasion", "Allergies", "Deposit", "Payment", "Created"];
  const lines = ((data ?? []) as unknown as CsvRow[]).map((r) =>
    [r.reference, r.restaurants?.name, r.reservation_date, r.reservation_time.slice(0, 5), r.customer_name, r.phone, r.email, r.party_size,
      r.reservation_tables.map((t) => t.tables?.label).join("+"), r.status, r.booking_sources?.name, r.special_occasion, r.allergies, r.deposit_amount, r.payment_status, r.created_at].map(csvCell).join(","),
  );
  return new NextResponse("﻿" + [header.join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reservations_${from}_${to}.csv"`, "Cache-Control": "no-store" },
  });
}

type CsvRow = {
  reference: string; reservation_date: string; reservation_time: string; customer_name: string; phone: string | null; email: string | null; party_size: number;
  status: string; special_occasion: string | null; allergies: string | null; deposit_amount: number; payment_status: string; created_at: string;
  restaurants: { name: string } | null; booking_sources: { name: string } | null; reservation_tables: { tables: { label: string } | null }[];
};

