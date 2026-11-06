import "server-only";
import { cookies } from "next/headers";
import { makeT, STAFF_LOCALE_COOKIE, toStaffLocale, type StaffLocale } from "./staff";

export async function getStaffLocale(): Promise<StaffLocale> {
  return toStaffLocale((await cookies()).get(STAFF_LOCALE_COOKIE)?.value);
}

export async function getStaffT() {
  const locale = await getStaffLocale();
  return { locale, t: makeT(locale) };
}
