/** Date ranges for the dashboard filter: a day, a Monday-first week, a month or a custom range. Dates are yyyy-mm-dd. */
export type RangeView = "day" | "week" | "month" | "custom";
export const MAX_RANGE_DAYS = 62;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
};
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const validDate = (s: string | undefined): s is string => !!s && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export interface DateRange {
  view: RangeView;
  /** Anchor date (the day, or any day inside the week / month). */
  date: string;
  from: string;
  to: string;
  days: number;
  /** Anchors for the previous / next period (day, week and month views). */
  prev: string | null;
  next: string | null;
}

export function resolveRange(args: { view?: string; date?: string; from?: string; to?: string; today: string }): DateRange {
  const view: RangeView = args.view === "week" || args.view === "month" || args.view === "custom" ? args.view : "day";
  const date = validDate(args.date) ? args.date : args.today;
  if (view === "custom") {
    let from = validDate(args.from) ? args.from : args.today;
    let to = validDate(args.to) ? args.to : addDays(from, 6);
    if (to < from) [from, to] = [to, from];
    if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
    return { view, date: from, from, to, days: diffDays(from, to) + 1, prev: null, next: null };
  }
  if (view === "week") {
    const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(date, -dow);
    return { view, date, from, to: addDays(from, 6), days: 7, prev: addDays(from, -7), next: addDays(from, 7) };
  }
  if (view === "month") {
    const [y, m] = date.split("-").map(Number);
    const from = `${date.slice(0, 7)}-01`;
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { view, date, from, to, days: Number(to.slice(8)), prev: new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10), next: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) };
  }
  return { view, date, from: date, to: date, days: 1, prev: addDays(date, -1), next: addDays(date, 1) };
}

/** Every yyyy-mm between two dates, in order. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
