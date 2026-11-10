import ExcelJS from "exceljs";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";

const STATUS: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", arrived: "Arrived", seated: "Seated", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };

export const XLSX_COLUMNS =
  "reference, reservation_date, reservation_time, duration_minutes, customer_name, phone, email, party_size, status, special_occasion, allergies, guest_notes, internal_notes, deposit_amount, payment_status, cancellation_reason, created_at, restaurants(name), booking_sources(name), reservation_tables(tables(label, restaurant_areas(name)))";
export type XlsxRow = {
  reference: string; reservation_date: string; reservation_time: string; duration_minutes: number; customer_name: string; phone: string | null; email: string | null;
  party_size: number; status: string; special_occasion: string | null; allergies: string | null; guest_notes: string | null; internal_notes: string | null;
  deposit_amount: number; payment_status: string; cancellation_reason: string | null; created_at: string;
  restaurants: { name: string } | null; booking_sources: { name: string } | null;
  reservation_tables: { tables: { label: string; restaurant_areas: { name: string } | null } | null }[];
};

/** All bookings in the range on one Excel sheet, with guest type, room and tables. */
export async function buildReservationsXlsx(rows: XlsxRow[], t: (s: string) => string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "T23 Reservation Hub";
  const ws = wb.addWorksheet(t("Reservations"), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: t("Reference"), key: "ref", width: 12 },
    { header: t("Restaurant"), key: "rest", width: 18 },
    { header: t("Date"), key: "date", width: 12 },
    { header: t("Time"), key: "time", width: 8 },
    { header: t("End"), key: "end", width: 8 },
    { header: t("Guest"), key: "name", width: 24 },
    { header: t("Phone"), key: "phone", width: 14 },
    { header: t("Email"), key: "email", width: 24 },
    { header: t("Guests"), key: "pax", width: 8 },
    { header: t("Customer type"), key: "type", width: 12 },
    { header: t("Room"), key: "room", width: 16 },
    { header: t("Tables"), key: "tables", width: 16 },
    { header: t("Status"), key: "status", width: 14 },
    { header: t("Booking source"), key: "source", width: 14 },
    { header: t("Occasion"), key: "occasion", width: 18 },
    { header: t("Allergies"), key: "allergies", width: 18 },
    { header: t("Guest notes"), key: "gnotes", width: 28 },
    { header: t("Internal notes"), key: "inotes", width: 28 },
    { header: t("Cancellation reason"), key: "cancel", width: 20 },
    { header: t("Deposit"), key: "deposit", width: 10 },
    { header: t("Payment"), key: "payment", width: 12 },
    { header: t("Created"), key: "created", width: 18 },
  ];
  const endOf = (time: string, mins: number) => {
    const m = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + (mins || 0);
    return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  for (const r of rows) {
    const { type, notes } = splitCustomerType(r.internal_notes);
    const tables = r.reservation_tables.map((x) => x.tables).filter((x): x is NonNullable<typeof x> => !!x);
    ws.addRow({
      ref: r.reference,
      rest: r.restaurants?.name ?? "",
      date: r.reservation_date,
      time: r.reservation_time.slice(0, 5),
      end: endOf(r.reservation_time, r.duration_minutes),
      name: r.customer_name,
      phone: r.phone ?? "",
      email: r.email ?? "",
      pax: r.party_size,
      type: type ? CUSTOMER_TYPE_LABELS[type as keyof typeof CUSTOMER_TYPE_LABELS] ?? type : "",
      room: [...new Set(tables.map((x) => x.restaurant_areas?.name).filter(Boolean))].join(", "),
      tables: tables.map((x) => x.label).join(" + "),
      status: t(STATUS[r.status] ?? r.status),
      source: r.booking_sources?.name ?? "",
      occasion: r.special_occasion ?? "",
      allergies: r.allergies ?? "",
      gnotes: r.guest_notes ?? "",
      inotes: notes ?? "",
      cancel: r.cancellation_reason ?? "",
      deposit: Number(r.deposit_amount) || 0,
      payment: r.payment_status,
      created: new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }),
    });
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5F4A" } };
  header.alignment = { vertical: "middle" };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  const total = ws.addRow({ name: `${t("Total")}: ${rows.length} ${t("reservations")}`, pax: rows.filter((r) => r.status !== "cancelled" && r.status !== "no_show").reduce((a, r) => a + r.party_size, 0) });
  total.font = { bold: true };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
