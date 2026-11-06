import { describe, expect, it } from "vitest";
import { bySource, capacityFor, dailyTrend, peakHours, summarize, type ReportReservation } from "@/lib/domain/reports";

const row = (o: Partial<ReportReservation>): ReportReservation => ({
  restaurant_id: "r1", reservation_date: "2026-11-04", reservation_time: "18:00:00", party_size: 2, duration_minutes: 90,
  status: "completed", booking_source_id: "s1", customer_id: "c1", ...o,
});

describe("summarize", () => {
  const rows = [
    row({ party_size: 4 }),
    row({ party_size: 2, status: "confirmed", customer_id: "c2" }),
    row({ party_size: 6, status: "cancelled", customer_id: "c3" }),
    row({ party_size: 3, status: "no_show", customer_id: "c4" }),
  ];
  const s = summarize(rows, [{ restaurant_id: "r1", seat_minutes: 10 * 600 }], new Set(["c1"]));
  it("counts covers only from live reservations", () => expect(s.covers).toBe(6));
  it("honoured covers only count guests who came", () => expect(s.honouredCovers).toBe(4));
  it("cancellation rate is over all reservations", () => expect(s.cancellationRate).toBe(25));
  it("no-show rate excludes cancellations from the denominator", () => expect(s.noShowRate).toBe(33.3));
  it("occupancy = booked seat-minutes / available seat-minutes", () => expect(s.occupancyRate).toBe(9)); // 6*90 / 6000
  it("repeat rate uses only live guests", () => expect([s.uniqueGuests, s.repeatCustomerRate]).toEqual([2, 50]));
  it("handles empty input without dividing by zero", () => {
    const e = summarize([], [], new Set());
    expect([e.occupancyRate, e.avgPartySize, e.noShowRate]).toEqual([0, 0, 0]);
  });
});

describe("breakdowns", () => {
  it("groups by source with unknown sources labelled", () => {
    const out = bySource([row({}), row({ booking_source_id: null }), row({ status: "cancelled" })], new Map([["s1", "Online"]]));
    expect(out[0]).toMatchObject({ source: "Online", reservations: 2, covers: 2, cancellationRate: 50 });
    expect(out[1].source).toBe("Unspecified");
  });
  it("peak hours ignore cancelled bookings", () => {
    expect(peakHours([row({ reservation_time: "12:30:00" }), row({ reservation_time: "12:00:00", status: "cancelled" }), row({})]))
      .toEqual([{ hour: "12:00", reservations: 1, covers: 2 }, { hour: "18:00", reservations: 1, covers: 2 }]);
  });
  it("daily trend is sorted by date", () => {
    expect(dailyTrend([row({ reservation_date: "2026-11-05" }), row({})]).map((d) => d.date)).toEqual(["2026-11-04", "2026-11-05"]);
  });
});

describe("capacityFor", () => {
  const hours = [
    { day_of_week: 3, specific_date: null, open_time: "11:30", close_time: "14:30", is_closed: false },
    { day_of_week: 3, specific_date: null, open_time: "17:30", close_time: "22:30", is_closed: false },
    { day_of_week: null, specific_date: "2026-11-11", open_time: null, close_time: null, is_closed: true },
  ];
  it("sums open minutes x seats across services", () => {
    expect(capacityFor("r1", ["2026-11-04"], 10, hours).seat_minutes).toBe((180 + 300) * 10);
  });
  it("date override closes the day", () => {
    expect(capacityFor("r1", ["2026-11-11"], 10, hours).seat_minutes).toBe(0);
  });
});
