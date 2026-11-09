import { describe, expect, it } from "vitest";
import { localToUtc, type TableInput } from "@/lib/domain/availability";
import { buildAvailabilityBoard } from "@/lib/domain/availability-board";

const TZ = "Asia/Bangkok";
const policy = {
  default_duration_minutes: 120,
  duration_rules: [{ max_party: 2, minutes: 90 }],
  buffer_minutes: 0,
  slot_interval_minutes: 30,
  min_party_size: 1,
  max_party_size: 8,
  min_advance_minutes: 60,
  max_advance_days: 30,
};
const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day_of_week: d,
  specific_date: null,
  service_name: "Dinner",
  open_time: "18:00",
  close_time: "22:00",
  last_seating_time: "20:00",
  is_closed: false,
}));
const table = (id: string, max: number, extra: Partial<TableInput> = {}): TableInput => ({
  id,
  label: id,
  min_capacity: 1,
  max_capacity: max,
  is_active: true,
  is_online_bookable: true,
  is_combinable: true,
  service_status: "available",
  ...extra,
});
const NOW = localToUtc("2026-11-06", "09:00", TZ);
const base = {
  date: "2026-11-10",
  partySize: 2,
  timezone: TZ,
  policy,
  hours,
  tables: [table("T1", 2), table("T2", 4)],
  combinations: [],
  occupancy: [],
  now: NOW,
};

describe("buildAvailabilityBoard", () => {
  it("lists every slot with all tables free on an empty day", () => {
    const b = buildAvailabilityBoard(base);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.slots.map((s) => s.time)).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00"]);
    expect(b.slots.every((s) => s.freeTables === 2 && s.totalTables === 2 && s.level === "open")).toBe(true);
    expect(b.rows).toHaveLength(2);
  });

  it("marks tables busy during their booking and the slot full when nothing fits", () => {
    const occupancy = ["T1", "T2"].map((id) => ({
      table_id: id,
      reservation_id: `r-${id}`,
      start: localToUtc("2026-11-10", "19:00", TZ),
      end: localToUtc("2026-11-10", "20:30", TZ),
    }));
    const b = buildAvailabilityBoard({ ...base, occupancy });
    if (!b.ok) throw new Error("expected board");
    const at = (t: string) => b.slots.find((s) => s.time === t)!;
    expect(at("19:00").freeTables).toBe(0);
    expect(at("19:00").level).toBe("full");
    // 18:00 + 90 min overlaps the 19:00 booking, so a party of 2 cannot start then either.
    expect(at("18:00").fitsParty).toBe(false);
    expect(at("18:00").freeTables).toBe(2);
    const t1 = b.rows.find((r) => r.id === "T1")!;
    expect(t1.busy).toEqual([false, false, true, true, true]);
  });

  it("reports closed days", () => {
    const closed = hours.map((h) => ({ ...h, is_closed: true }));
    expect(buildAvailabilityBoard({ ...base, hours: closed })).toMatchObject({ ok: false, reason: "closed" });
  });

  it("marks finished slots as past", () => {
    const b = buildAvailabilityBoard({ ...base, now: localToUtc("2026-11-10", "21:00", TZ) });
    if (!b.ok) throw new Error("expected board");
    expect(b.slots.find((s) => s.time === "18:00")!.level).toBe("past");
  });
});
