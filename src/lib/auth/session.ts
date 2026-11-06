import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Restaurant } from "@/lib/supabase/types";
import { AuthorizationError, roleCan, type Permission } from "./permissions";

export const BRANCH_COOKIE = "t23_branch";

export type StaffContext = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  organizationId: string;
  restaurants: Pick<Restaurant, "id" | "name" | "slug" | "is_active" | "timezone" | "currency">[];
  /** Restaurant ids the current branch filter resolves to (all accessible ones when "all"). */
  branchIds: string[];
  selectedBranch: string; // restaurant id or "all"
};

/** Loads the signed-in staff member, their role and accessible branches. Cached per request. */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRow }, { data: restaurants }] = await Promise.all([
    supabase.from("users").select("full_name, email, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, organization_id").eq("user_id", user.id).limit(1).maybeSingle(),
    // RLS returns exactly the restaurants this user may see.
    supabase.from("restaurants").select("id, name, slug, is_active, timezone, currency").order("name"),
  ]);
  if (!profile?.is_active || !roleRow) return null;

  const list = restaurants ?? [];
  const cookieStore = await cookies();
  const requested = cookieStore.get(BRANCH_COOKIE)?.value ?? "all";
  const selected = requested !== "all" && list.some((r) => r.id === requested) ? requested : list.length === 1 ? list[0].id : "all";

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name ?? profile.email,
    role: roleRow.role,
    organizationId: roleRow.organization_id,
    restaurants: list,
    branchIds: selected === "all" ? list.map((r) => r.id) : [selected],
    selectedBranch: selected,
  };
});

/** For pages: redirect to login when signed out; show 403 when lacking permission. */
export async function requireStaff(permission?: Permission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (permission && !roleCan(ctx.role, permission)) redirect("/forbidden");
  return ctx;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function assertPermission(permission: Permission, restaurantId?: string): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new AuthorizationError("Please sign in again.");
  if (!roleCan(ctx.role, permission)) throw new AuthorizationError();
  if (restaurantId && !ctx.restaurants.some((r) => r.id === restaurantId)) {
    throw new AuthorizationError("You do not have access to this restaurant.");
  }
  return ctx;
}
