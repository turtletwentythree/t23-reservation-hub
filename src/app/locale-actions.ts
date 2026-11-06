"use server";
import { cookies } from "next/headers";
import { STAFF_LOCALE_COOKIE, toStaffLocale } from "@/lib/i18n/staff";

export async function setStaffLocaleAction(locale: string) {
  (await cookies()).set(STAFF_LOCALE_COOKIE, toStaffLocale(locale), { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
