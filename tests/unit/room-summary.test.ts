import { describe, expect, it } from "vitest";
import { summarizeRooms, type Board } from "@/lib/domain/availability-board";

const board = {
  ok: true,
  durationMinutes: 120,
  intervalMinutes: 15,
  slots: [],
  rows: [
    { id: "v", label: "VIP", area: null, capacity: 18, usable: true, busy: [false, true] },
    { id: "m1", label: "Main 1", area: null, capacity: 4, usable: true, busy: [true, true] },
    { id: "m2", label: "Main 2", area: null, capacity: 4, usable: true, busy: [false, false] },
    { id: "m3", label: "Main 3", area: null, capacity: 5, usable: false, busy: [false, false] },
  ],
} as Extract<Board, { ok: true }>;
const areas = [{ id: "a2", name: "Main", sort_order: 1 }, { id: "a1", name: "VIP", sort_order: 0 }];
const map = new Map<string, string | null>([["v", "a1"], ["m1", "a2"], ["m2", "a2"], ["m3", "a2"]]);

describe("summarizeRooms", () => {
  it("counts free and booked tables per room in sort order", () => {
    const r = summarizeRooms(board, map, areas, 0);
    expect(r.map((x) => x.name)).toEqual(["VIP", "Main"]);
    expect(r[0]).toMatchObject({ total: 1, free: 1, booked: 0, freeSeats: 18 });
    expect(r[1]).toMatchObject({ total: 2, free: 1, booked: 1, seats: 8, freeSeats: 4 });
  });
  it("follows the selected slot and ignores out-of-service tables", () => {
    const r = summarizeRooms(board, map, areas, 1);
    expect(r[0]).toMatchObject({ free: 0, booked: 1 });
    expect(r[1].tables.find((x) => x.id === "m3")?.state).toBe("out");
  });
});
