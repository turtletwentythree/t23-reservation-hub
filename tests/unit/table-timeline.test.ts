import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/lib/domain/table-timeline";

const base = {
  date: "2026-11-10",
  timezone: "Asia/Bangkok",
  firstSlot: "17:30",
  lastSlot: "20:00",
  durationMinutes: 120,
  tables: [
    { id: "a", label: "VIP", capacity: 18, areaId: "r1", out: false },
    { id: "b", label: "Main 1", capacity: 4, areaId: "r2", out: false },
  ],
  areas: [{ id: "r2", name: "Main", sort_order: 1 }, { id: "r1", name: "VIP", sort_order: 0 }],
};
// 18:00-20:00 Bangkok = 11:00-13:00 UTC
const occ = [{ table_id: "a", reservation_id: "x", start: new Date("2026-11-10T11:00:00Z"), end: new Date("2026-11-10T13:00:00Z") }];
const details = new Map([["x", { name: "Somchai", party: 12, type: "kol", status: "confirmed" }]]);

describe("buildTimeline", () => {
  it("lays out a booking on a whole-hour axis, grouped by room", () => {
    const t = buildTimeline({ ...base, occupancy: occ, details });
    expect([t.start, t.end]).toEqual(["17:00", "22:00"]);
    expect(t.rooms.map((r) => r.name)).toEqual(["VIP", "Main"]);
    const b = t.rooms[0].tables[0].blocks[0];
    expect(b).toMatchObject({ from: "18:00", to: "20:00", name: "Somchai", party: 12, type: "kol" });
    expect(b.left).toBeCloseTo(20); // 1h of 5h
    expect(b.width).toBeCloseTo(40);
    expect(t.rooms[1].tables[0].blocks).toEqual([]);
  });
  it("skips cancelled bookings and unknown reservations", () => {
    const d = new Map([["x", { name: "n", party: 2, type: null, status: "cancelled" }]]);
    expect(buildTimeline({ ...base, occupancy: occ, details: d }).rooms[0].tables[0].blocks).toEqual([]);
    expect(buildTimeline({ ...base, occupancy: occ, details: new Map() }).rooms[0].tables[0].blocks).toEqual([]);
  });
});
