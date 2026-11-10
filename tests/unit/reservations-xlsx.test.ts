import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildReservationsXlsx, type XlsxRow } from "@/lib/export/reservations-xlsx";

const row = (over: Partial<XlsxRow>): XlsxRow => ({
  reference: "R1", reservation_date: "2026-11-10", reservation_time: "18:00:00", duration_minutes: 120, customer_name: "A", phone: "081", email: null,
  party_size: 4, status: "confirmed", special_occasion: null, allergies: null, guest_notes: null, internal_notes: "[KOL] window seat",
  deposit_amount: 0, payment_status: "none", cancellation_reason: null, created_at: "2026-11-01T03:00:00Z",
  restaurants: { name: "Roi Chak Sam" }, booking_sources: { name: "LINE" },
  reservation_tables: [{ tables: { label: "Main 1", restaurant_areas: { name: "Main" } } }, { tables: { label: "Main 2", restaurant_areas: { name: "Main" } } }],
  ...over,
});

describe("buildReservationsXlsx", () => {
  it("puts every booking on one sheet with type, room, tables and a total", async () => {
    const buf = await buildReservationsXlsx([row({}), row({ reference: "R2", status: "cancelled", party_size: 2, internal_notes: null, reservation_tables: [] })], (s) => s);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets).toHaveLength(1);
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(4);
    const r = ws.getRow(2);
    const col = (h: string) => (ws.getRow(1).values as string[]).indexOf(h);
    expect(r.getCell(col("Customer type")).value).toBe("KOL");
    expect(r.getCell(col("Room")).value).toBe("Main");
    expect(r.getCell(col("Tables")).value).toBe("Main 1 + Main 2");
    expect(r.getCell(col("End")).value).toBe("20:00");
    expect(r.getCell(col("Internal notes")).value).toBe("window seat");
    expect(ws.getRow(4).getCell(col("Guests")).value).toBe(4);
  });
});
