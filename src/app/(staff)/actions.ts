"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRANCH_COOKIE, getStaffContext } from "@/lib/auth/session";

export async function setBranchAction(branch: string) {
  const ctx = await getStaffContext();
  if (!ctx) return;
  const value = branch === "all" || ctx.restaurants.some((r) => r.id === branch) ? branch : "all";
  (await cookies()).set(BRANCH_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
