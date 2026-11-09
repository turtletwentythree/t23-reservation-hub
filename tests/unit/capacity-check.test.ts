import { describe, expect, it } from "vitest";
import { buildCapacityMonth, monthDays } from "@/lib/domain/capacity-check";

const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day_of_week: d, specific_date: null, service_name: "Dinner", open_time: "18:00", close_time: "22:00", last_seating_time: null, is_closed: d === 1,
}));

describe("buildCapacityMonth", () => {
  it("covers every day of the month", () => {
    expect(monthDays("2026-12")).toHaveLength(31);
    expect(monthDays("2027-02")).toHaveLength(28);
  });

  it("sums guests by type and checks seats", () => {
    const days = buildCapacityMonth({
      month: "2026-12",
      seats: 10,
      hours,
      reservations: [
        { date: "2026-12-01", party: 4, notes: "[KOL] x" },
        { date: "2026-12-01", party: 6, notes: "[Internal]" },
        { date: "2026-12-02", party: 12, notes: "[Media] SCMP" },
        { date: "2026-12-03", party: 2, notes: null },
      ],
      waiting: [{ date: "2026-12-03", party: 3 }],
    });
    const d = (x: string) => days.find((r) => r.date === x)!;
    expect(d("2026-12-01")).toMatchObject({ total: 10, left: 0, status: "full", pax: { kol: 4, internal: 6 } });
    expect(d("2026-12-02")).toMatchObject({ total: 12, left: -2, status: "over" });
    expect(d("2026-12-03")).toMatchObject({ total: 2, waiting: 3, status: "ok", pax: { other: 2 } });
    // 2026-12-07 is a Monday (closed).
    expect(d("2026-12-07").status).toBe("closed");
  });
});
