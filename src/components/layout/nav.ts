import { roleCan, type Permission } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";

export type PageKey =
  | "dashboard" | "reservations" | "calendar" | "floor-plan" | "waitlist" | "customers" | "notifications"
  | "reports" | "restaurants" | "integrations" | "users" | "settings" | "audit-logs";

export const NAV_ITEMS: { key: PageKey; href: string; label: string; icon: string; permission: Permission }[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", permission: "dashboard.view" },
  { key: "reservations", href: "/reservations", label: "Reservations", icon: "BookOpen", permission: "reservation.view" },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: "CalendarDays", permission: "reservation.view" },
  { key: "floor-plan", href: "/floor-plan", label: "Floor Plan", icon: "LayoutGrid", permission: "reservation.view" },
  { key: "waitlist", href: "/waitlist", label: "Waitlist", icon: "ListOrdered", permission: "reservation.view" },
  { key: "customers", href: "/customers", label: "Customers", icon: "Users", permission: "customer.view" },
  { key: "notifications", href: "/notifications", label: "Notifications", icon: "Bell", permission: "notification.view" },
  { key: "reports", href: "/reports", label: "Reports", icon: "BarChart3", permission: "report.view" },
  { key: "restaurants", href: "/restaurants", label: "Restaurants", icon: "Store", permission: "reservation.view" },
  { key: "integrations", href: "/integrations", label: "Integrations", icon: "Plug", permission: "integration.view" },
  { key: "users", href: "/users", label: "User Management", icon: "UserCog", permission: "user.manage" },
  { key: "settings", href: "/settings", label: "Settings", icon: "Settings", permission: "settings.manage" },
  { key: "audit-logs", href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", permission: "audit.view" },
];

/** Roles whose pages an Admin can switch on and off. Admin itself always sees every page. */
export const CONFIGURABLE_ROLES = ["host", "viewer"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export type PageAccess = Partial<Record<ConfigurableRole, PageKey[]>>;

/** Pages a role is able to use at all (the most an Admin can switch on). */
export function possiblePages(role: AppRole): PageKey[] {
  return NAV_ITEMS.filter((i) => roleCan(role, i.permission)).map((i) => i.key);
}

/** Reads the stored JSON defensively; unknown roles and page keys are dropped. */
export function parsePageAccess(raw: unknown): PageAccess {
  const out: PageAccess = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const keys = new Set<string>(NAV_ITEMS.map((i) => i.key));
  for (const role of CONFIGURABLE_ROLES) {
    const v = (raw as Record<string, unknown>)[role];
    if (Array.isArray(v)) out[role] = v.filter((k): k is PageKey => typeof k === "string" && keys.has(k));
  }
  return out;
}

/** Pages this role may open, after the Admin's switches. */
export function allowedPages(role: AppRole, access: PageAccess): PageKey[] {
  const possible = possiblePages(role);
  if (role === "super_admin") return possible;
  const chosen = (CONFIGURABLE_ROLES as readonly string[]).includes(role) ? access[role as ConfigurableRole] : undefined;
  if (!chosen) return possible;
  return possible.filter((k) => chosen.includes(k));
}
