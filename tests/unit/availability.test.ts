import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  dailyCapReached,
  durationForParty,
  localToUtc,
  servicesForDate,
  type AvailabilityRequest,
  type TableInput,
} from "@/lib/domain/availability";

const TZ = "Asia/Bangkok";
const policy = {
  default_duration_minutes: 120,
  duration_rules: [
    { max_party: 2, minutes: 90 },
    { max_party: 4, minutes: 120 },
  ],
  buffer_minutes: 15,
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
const table = (id: string, min: number, max: number, extra: Partial<TableInput> = {}): TableInput => ({
  id,
  label: id,
  min_capacity: min,
  max_capacity: max,
  is_active: true,
  is_online_bookable: true,
  is_combinable: true,
  service_status: "available",
  ...extra,
});
// 2026-11-10 is a Tuesday. "now" = 2026-11-06 09:00 Bangkok.
const NOW = localToUtc("2026-11-06", "09:00", TZ);
const base = (over: Partial<AvailabilityRequest> = {}): AvailabilityRequest => ({
  date: "2026-11-10",
  partySize: 2,
  timezone: TZ,
  policy,
  hours,
  tables: [table("T1", 1, 2), table("T2", 3, 4), table("T3", 3, 4)],
  combinations: [{ id: "C1", name: "T2+T3", min_capacity: 5, max_capacity: 8, is_active: true, table_ids: ["T2", "T3"] }],
  occupancy: [],
  now: NOW,
  channel: "online",
  ...over,
});

describe("durationForParty", () => {
  it("uses turn-time rules by party size, falling back to default", () => {
    expect(durationForParty(policy, 2)).toBe(90);
    expect(durationForParty(policy, 3)).toBe(120);
    expect(durationForParty(policy, 7)).toBe(120);
    expect(durationForParty({ ...policy, duration_rules: [] }, 2)).toBe(120);
    expect(durationForParty(policy, 2, 150)).toBe(150);
  });
});

describe("servicesForDate", () => {
  it("date overrides replace weekly hours, and a closed override closes the day", () => {
    const withHoliday = [...hours, { ...hours[0], day_of_week: null, specific_date: "2026-11-10", is_closed: true }];
    expect(servicesForDate(withHoliday, "2026-11-10")).toHaveLength(0);
    expect(servicesForDate(withHoliday, "2026-11-11")).toHaveLength(1);
  });
});

describe("computeAvailability", () => {
  it("generates slots between opening and last seating at the booking interval", () => {
    const r = computeAvailability(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slots.map((s) => s.time)).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00"]);
    expect(r.durationMinutes).toBe(90);
  });

  it("converts local restaurant time to UTC correctly", () => {
    const r = computeAvailability(base());
    if (!r.ok) throw new Error();
    expect(r.slots[0].starts_at.toISOString()).toBe("2026-11-10T11:00:00.000Z");
  });

  it("picks the best-fitting table", () => {
    const r = computeAvailability(base({ partySize: 2 }));
    if (!r.ok) throw new Error();
    expect(r.slots[0].best?.labels).toEqual(["T1"]);
  });

  it("uses a table combination for larger parties", () => {
    const r = computeAvailability(base({ partySize: 6 }));
    if (!r.ok) throw new Error();
    expect(r.slots[0].best?.kind).toBe("combination");
    expect(r.slots[0].best?.table_ids).toEqual(["T2", "T3"]);
  });

  it("blocks overlapping bookings including buffer time", () => {
    // T1 is occupied 18:00-19:45 (90 min + 15 buffer)
    const occ = [{ table_id: "T1", start: localToUtc("2026-11-10", "18:00", TZ), end: localToUtc("2026-11-10", "19:45", TZ) }];
    const r = computeAvailability(base({ occupancy: occ, tables: [table("T1", 1, 2)] }));
    if (!r.ok) throw new Error();
    const avail = Object.fromEntries(r.slots.map((s) => [s.time, s.available]));
    expect(avail).toEqual({ "18:00": false, "18:30": false, "19:00": false, "19:30": false, "20:00": true });
  });

  it("a new booking must also leave its own buffer before the next booking", () => {
    // Next booking on T1 starts 20:00. A 90-min booking at 18:30 ends 20:00 + 15 buffer -> conflict.
    const occ = [{ table_id: "T1", start: localToUtc("2026-11-10", "20:00", TZ), end: localToUtc("2026-11-10", "21:45", TZ) }];
    const r = computeAvailability(base({ occupancy: occ, tables: [table("T1", 1, 2)] }));
    if (!r.ok) throw new Error();
    const avail = Object.fromEntries(r.slots.map((s) => [s.time, s.available]));
    expect(avail["18:00"]).toBe(true);
    expect(avail["18:30"]).toBe(false);
  });

  it("does not combine tables when a member is occupied", () => {
    const occ = [{ table_id: "T3", start: localToUtc("2026-11-10", "17:00", TZ), end: localToUtc("2026-11-10", "23:00", TZ) }];
    const r = computeAvailability(base({ partySize: 6, occupancy: occ }));
    if (!r.ok) throw new Error();
    expect(r.slots.every((s) => !s.available)).toBe(true);
  });

  it("ignores the reservation being modified", () => {
    const occ = [{ table_id: "T1", reservation_id: "R1", start: localToUtc("2026-11-10", "18:00", TZ), end: localToUtc("2026-11-10", "19:45", TZ) }];
    const r = computeAvailability(base({ occupancy: occ, tables: [table("T1", 1, 2)], ignoreReservationId: "R1" }));
    if (!r.ok) throw new Error();
    expect(r.slots[0].available).toBe(true);
  });

  it("enforces party size limits online but lets staff override", () => {
    expect(computeAvailability(base({ partySize: 9 })).ok).toBe(false);
    const staff = computeAvailability(base({ partySize: 9, channel: "staff", tables: [table("BIG", 1, 12)] }));
    expect(staff.ok).toBe(true);
  });

  it("respects min/max advance booking windows online", () => {
    expect(computeAvailability(base({ date: "2026-12-31" }))).toMatchObject({ ok: false, reason: "outside_booking_window" });
    expect(computeAvailability(base({ date: "2026-11-05" }))).toMatchObject({ ok: false, reason: "outside_booking_window" });
    // Same day: now 09:00, min advance 60 min -> all dinner slots fine
    const sameDay = computeAvailability(base({ date: "2026-11-06" }));
    expect(sameDay.ok && sameDay.slots[0].available).toBe(true);
    // now 17:45 -> 18:00, 18:30 are too soon
    const late = computeAvailability(base({ date: "2026-11-06", now: localToUtc("2026-11-06", "17:45", TZ) }));
    if (!late.ok) throw new Error();
    expect(late.slots.filter((s) => s.available).map((s) => s.time)).toEqual(["19:00", "19:30", "20:00"]);
  });

  it("excludes out-of-service and non-online tables from online availability", () => {
    const r = computeAvailability(
      base({ tables: [table("T1", 1, 2, { service_status: "out_of_service" }), table("T4", 1, 2, { is_online_bookable: false })] }),
    );
    if (!r.ok) throw new Error();
    expect(r.slots.every((s) => !s.available)).toBe(true);
    const staff = computeAvailability(base({ channel: "staff", tables: [table("T4", 1, 2, { is_online_bookable: false })] }));
    if (!staff.ok) throw new Error();
    expect(staff.slots[0].available).toBe(true);
  });

  it("reports closed days", () => {
    const closed = hours.map((h) => (h.day_of_week === 2 ? { ...h, is_closed: true } : h));
    expect(computeAvailability(base({ hours: closed }))).toMatchObject({ ok: false, reason: "closed" });
  });
});

describe("daily online caps", () => {
  const capped = { ...policy, max_online_bookings_per_day: 3, max_online_covers_per_day: 10 };
  it("allows booking while under both caps", () => {
    const r = computeAvailability(base({ policy: capped, partySize: 2, dayTotals: { bookings: 2, covers: 8 } }));
    expect(r.ok).toBe(true);
  });
  it("stops online booking once the booking cap is reached", () => {
    const r = computeAvailability(base({ policy: capped, partySize: 2, dayTotals: { bookings: 3, covers: 6 } }));
    expect(r).toMatchObject({ ok: false, reason: "fully_booked" });
  });
  it("stops online booking when the party would go over the guest cap", () => {
    const r = computeAvailability(base({ policy: capped, partySize: 3, dayTotals: { bookings: 1, covers: 8 } }));
    expect(r).toMatchObject({ ok: false, reason: "fully_booked" });
  });
  it("does not apply the caps to staff bookings", () => {
    const r = computeAvailability(base({ policy: capped, partySize: 2, channel: "staff", dayTotals: { bookings: 99, covers: 99 } }));
    expect(r.ok).toBe(true);
  });
  it("treats empty caps as no limit", () => {
    expect(dailyCapReached({ ...policy, max_online_bookings_per_day: null, max_online_covers_per_day: null }, { bookings: 500, covers: 2000 }, 4)).toBe(false);
  });
});
