import type { AppRole } from "@/lib/supabase/types";

/**
 * Server-side RBAC matrix. Mirrors the RLS helper functions in
 * supabase/migrations/*_functions.sql (private.can_*). Both layers are enforced:
 * the app checks these before acting, and Postgres RLS enforces them again.
 */
export const PERMISSIONS = {
  "dashboard.view": ["super_admin", "group_manager", "restaurant_manager", "host", "viewer"],
  "reservation.view": ["super_admin", "group_manager", "restaurant_manager", "host", "viewer"],
  "reservation.write": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "reservation.delete": ["super_admin"],
  "table.status": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "table.layout": ["super_admin", "restaurant_manager"],
  "waitlist.write": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "customer.view": ["super_admin", "group_manager", "restaurant_manager", "host", "viewer"],
  "customer.edit": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "customer.privacy": ["super_admin"],
  "report.view": ["super_admin", "group_manager", "restaurant_manager", "viewer"],
  "restaurant.create": ["super_admin"],
  "restaurant.manage": ["super_admin", "restaurant_manager"],
  "payment.record": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "payment.refund": ["super_admin", "restaurant_manager"],
  "notification.view": ["super_admin", "group_manager", "restaurant_manager", "host"],
  "notification.templates": ["super_admin"],
  "integration.view": ["super_admin", "group_manager"],
  "integration.manage": ["super_admin"],
  "user.manage": ["super_admin"],
  "audit.view": ["super_admin", "group_manager", "restaurant_manager"],
  "settings.manage": ["super_admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Admin",
  group_manager: "Group Manager",
  restaurant_manager: "Restaurant Manager",
  host: "Store",
  viewer: "View",
};

/**
 * Roles that can be given to users from User management:
 * Admin (full access), Store (front of house: runs reservations day to day) and View (read-only).
 */
export const ASSIGNABLE_ROLES = ["super_admin", "host", "viewer"] as const;

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}
