import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getStaffContext } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { buildReport } from "@/lib/data/reports";
import { csvCell } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx || !roleCan(ctx.role, "report.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const from = p.get("from")!, to = p.get("to")!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) return NextResponse.json({ error: "from/to required" }, { status: 400 });
  const r = await buildReport(ctx.branchIds, from, to);
  const s = r.summary;
  const kpis: [string, string | number][] = [
    ["Period", `${from} to ${to}`], ["Total reservations", s.totalReservations], ["Total covers", s.covers], ["Occupancy rate %", s.occupancyRate],
    ["Average party size", s.avgPartySize], ["Cancellation rate %", s.cancellationRate], ["No-show rate %", s.noShowRate], ["Repeat guest rate %", s.repeatCustomerRate],
    ["Recorded payments (net)", r.payments.net], ["POS revenue", "Not available (FoodStory pending)"],
  ];
  const branchHead = ["Restaurant", "Reservations", "Covers", "Occupancy %", "Avg party", "Cancel %", "No-show %", "Repeat %"];
  const branchRows = r.branches.map((b) => [b.restaurant, b.totalReservations, b.covers, b.occupancyRate, b.avgPartySize, b.cancellationRate, b.noShowRate, b.repeatCustomerRate]);
  const srcHead = ["Source", "Reservations", "Covers", "Cancel %", "No-show %"];
  const srcRows = r.sources.map((x) => [x.source, x.reservations, x.covers, x.cancellationRate, x.noShowRate]);
  const trendHead = ["Date", "Reservations", "Covers", "Cancelled", "No-shows"];
  const trendRows = r.trend.map((t) => [t.date, t.reservations, t.covers, t.cancelled, t.noShows]);
  const name = `t23_report_${from}_${to}`;

  if (p.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "T23 Reservation Hub";
    const add = (title: string, head: string[], rows: (string | number)[][]) => {
      const ws = wb.addWorksheet(title);
      ws.addRow(head).font = { bold: true };
      rows.forEach((row) => ws.addRow(row));
      ws.columns.forEach((c) => (c.width = 18));
    };
    add("Summary", ["KPI", "Value"], kpis);
    add("Branches", branchHead, branchRows);
    add("Sources", srcHead, srcRows);
    add("Daily", trendHead, trendRows);
    add("Peak hours", ["Hour", "Reservations", "Covers"], r.peaks.map((x) => [x.hour, x.reservations, x.covers]));
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
  }
  const block = (head: string[], rows: (string | number)[][]) => [head.map(csvCell).join(","), ...rows.map((x) => x.map(csvCell).join(","))].join("\r\n");
  const csv = [block(["KPI", "Value"], kpis), block(branchHead, branchRows), block(srcHead, srcRows), block(trendHead, trendRows)].join("\r\n\r\n");
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
