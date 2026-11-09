import { describe, expect, it } from "vitest";
import { monthsBetween, resolveRange } from "@/lib/domain/date-range";

const today = "2026-11-09"; // a Monday
describe("resolveRange", () => {
  it("defaults to today", () => {
    expect(resolveRange({ today })).toMatchObject({ view: "day", from: today, to: today, days: 1, prev: "2026-11-08", next: "2026-11-10" });
  });
  it("week starts on Monday", () => {
    expect(resolveRange({ view: "week", date: "2026-11-12", today })).toMatchObject({ from: "2026-11-09", to: "2026-11-15", prev: "2026-11-02", next: "2026-11-16" });
    expect(resolveRange({ view: "week", date: "2026-11-15", today }).from).toBe("2026-11-09");
  });
  it("month covers the whole month", () => {
    expect(resolveRange({ view: "month", date: "2026-02-10", today })).toMatchObject({ from: "2026-02-01", to: "2026-02-28", days: 28, prev: "2026-01-01", next: "2026-03-01" });
  });
  it("custom swaps reversed dates, ignores bad input and caps the length", () => {
    expect(resolveRange({ view: "custom", from: "2026-11-20", to: "2026-11-10", today })).toMatchObject({ from: "2026-11-10", to: "2026-11-20", days: 11 });
    expect(resolveRange({ view: "custom", from: "nope", today }).from).toBe(today);
    expect(resolveRange({ view: "custom", from: "2026-01-01", to: "2026-12-31", today }).days).toBe(62);
  });
});
describe("monthsBetween", () => {
  it("lists each month across a year end", () => {
    expect(monthsBetween("2026-11-20", "2027-01-05")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(monthsBetween("2026-11-01", "2026-11-30")).toEqual(["2026-11"]);
  });
});
