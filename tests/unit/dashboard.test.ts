import { describe, expect, it } from "vitest";
import { buildDashboard, computeMonth, type DayReservationRow } from "@/lib/domain/dashboard";
import { buildCapacityMonth } from "@/lib/domain/capacity-check";
import type { HoursInput } from "@/lib/domain/availability";

const hours: HoursInput[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, specific_date: null, service_name: "Dinner", open_time: "17:00", close_time: "22:00", last_seating_time: "20:00", is_closed: false }));
const row = (over: Partial<DayReservationRow>): DayReservationRow => ({
  id: Math.random().toString(36), reservation_time: "18:00:00", duration_minutes: 120, customer_name: "A", party_size: 2, status: "confirmed",
  internal_notes: null, guest_notes: null, allergies: null, dietary_requirements: null, special_occasion: null, source: null, tables: [{ label: "T1", area: null }], ...over,
});

describe("buildDashboard", () => {
  const day = [
    row({ customer_name: "Late", reservation_time: "17:00:00", party_size: 4, internal_notes: "[KOL]" }),
    row({ customer_name: "Seated", reservation_time: "17:00:00", party_size: 3, status: "seated" }),
    row({ customer_name: "NoTable", reservation_time: "19:00:00", party_size: 5, status: "pending", tables: [], allergies: "nuts" }),
    row({ customer_name: "Gone", status: "cancelled", party_size: 8 }),
  ];
  const capacity = buildCapacityMonth({ month: "2026-11", seats: 10, hours, reservations: day.filter((r) => r.status !== "cancelled").map((r) => ({ date: "2026-11-14", party: r.party_size, notes: r.internal_notes })), waiting: [] });
  const d = buildDashboard({
    date: "2026-11-14", today: "2026-11-14", nowMinutes: 17 * 60 + 30, hours, capacity, day,
    months: day.map((r) => ({ date: "2026-11-14", party: r.party_size, status: r.status, source: "LINE", notes: r.internal_notes })),
    requests: [], pending: [], pendingCount: 0, branches: [],
  });

  it("counts guests without cancelled bookings and flags over capacity", () => {
    expect(d.day.guests).toBe(12);
    expect(d.day.status).toBe("over");
    expect(d.day.byType.kol).toBe(4);
    expect(d.day.inHouseNow).toBe(3);
  });
  it("lists what needs attention", () => {
    const keys = d.attention.map((a) => a.key);
    expect(keys).toContain("late");
    expect(keys).toContain("notable");
    expect(keys).toContain("pending");
    expect(keys).toContain("allergy");
    expect(d.attention.find((a) => a.key === "late")?.n).toBe(1);
  });
  it("shows guests in the restaurant per half hour", () => {
    expect(d.slots[0]).toEqual({ time: "17:00", inHouse: 7, arriving: 7 });
    expect(d.slots.find((s) => s.time === "19:00")?.inHouse).toBe(5);
    expect(d.peakSlot?.time).toBe("17:00");
  });
  it("computes the month's cancellation rate", () => {
    const m = computeMonth("2026-11", { capacity, months: day.map((r) => ({ date: "2026-11-14", party: r.party_size, status: r.status, source: null, notes: null })), requests: [] });
    expect(m.cancelled).toBe(1);
    expect(m.lostRate).toBeCloseTo(0.25);
    expect(m.bookings).toBe(3);
  });
});
