import { describe, expect, it } from "vitest";
import { buildTableMonth, daysOfMonth } from "@/lib/domain/table-month";

describe("buildTableMonth", () => {
  it("lists every day of the month", () => {
    expect(daysOfMonth("2026-11")).toHaveLength(30);
    expect(daysOfMonth("2028-02")).toHaveLength(29);
  });
  it("puts bookings on their tables and skips cancelled ones", () => {
    const m = buildTableMonth({
      month: "2026-11",
      tables: [
        { id: "t1", label: "Main 1", capacity: 6, areaId: "a", out: false },
        { id: "t2", label: "VIP", capacity: 18, areaId: null, out: false },
      ],
      areas: [{ id: "a", name: "Main", sort_order: 1 }],
      bookings: [
        { id: "r2", date: "2026-11-10", time: "19:00:00", name: "B", party: 4, type: "kol", status: "confirmed", tableIds: ["t1"] },
        { id: "r1", date: "2026-11-10", time: "18:00:00", name: "A", party: 2, type: null, status: "confirmed", tableIds: ["t1", "t2"] },
        { id: "r3", date: "2026-11-11", time: "18:00:00", name: "C", party: 2, type: null, status: "cancelled", tableIds: ["t1"] },
        { id: "r4", date: "2026-12-01", time: "18:00:00", name: "D", party: 2, type: null, status: "confirmed", tableIds: ["t1"] },
      ],
    });
    expect(m.rooms.map((r) => r.name)).toEqual(["Main", "—"]);
    const t1 = m.rooms[0].tables[0];
    expect(t1.days["2026-11-10"].map((b) => b.time)).toEqual(["18:00", "19:00"]);
    expect(t1.days["2026-11-11"]).toBeUndefined();
    expect(t1.total).toBe(2);
    expect(m.perDay["2026-11-10"]).toBe(2);
  });
});
