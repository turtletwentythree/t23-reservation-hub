import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

export const DEFAULT_TZ = "Asia/Bangkok";

export function todayIn(tz = DEFAULT_TZ) {
  return formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export async function getBookingSources() {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_sources").select("id, code, name, is_active").order("name");
  return data ?? [];
}

export function pickParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
