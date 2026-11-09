import { roleCan, type Permission } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";

export type PageKey =
  | "dashboard" | "requests" | "availability" | "reservations" | "calendar" | "floor-plan" | "waitlist" | "customers" | "notifications"
  | "reports" | "restaurants" | "integrations" | "users" | "settings" | "audit-logs";

/** Menu sections: front of house (service floor), back office (management), system admin. */
export type NavGroup = "front" | "back" | "admin";

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "front", label: "Front of house" },
  { key: "back", label: "Back office" },
  { key: "admin", label: "System admin" },
];

export const NAV_ITEMS: { key: PageKey; href: string; label: string; icon: string; permission: Permission; group: NavGroup }[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", permission: "dashboard.view", group: "front" },
  { key: "requests", href: "/requests", label: "Booking requests", icon: "PhoneCall", permission: "request.create", group: "front" },
  { key: "availability", href: "/availability", label: "Table availability", icon: "Grid3x3", permission: "availability.view", group: "front" },
  { key: "reservations", href: "/reservations", label: "Reservations", icon: "BookOpen", permission: "reservation.view", group: "front" },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: "CalendarDays", permission: "reservation.view", group: "front" },
  { key: "floor-plan", href: "/floor-plan", label: "Floor Plan", icon: "LayoutGrid", permission: "reservation.view", group: "front" },
  { key: "waitlist", href: "/waitlist", label: "Waitlist", icon: "ListOrdered", permission: "reservation.view", group: "front" },
  { key: "customers", href: "/customers", label: "Customers", icon: "Users", permission: "customer.view", group: "back" },
  { key: "reports", href: "/reports", label: "Reports", icon: "BarChart3", permission: "report.view", group: "back" },
  { key: "notifications", href: "/notifications", label: "Notifications", icon: "Bell", permission: "notification.view", group: "back" },
  { key: "restaurants", href: "/restaurants", label: "Restaurants", icon: "Store", permission: "reservation.view", group: "back" },
  { key: "integrations", href: "/integrations", label: "Integrations", icon: "Plug", permission: "integration.view", group: "back" },
  { key: "users", href: "/users", label: "User Management", icon: "UserCog", permission: "user.manage", group: "admin" },
  { key: "settings", href: "/settings", label: "Settings", icon: "Settings", permission: "settings.manage", group: "admin" },
  { key: "audit-logs", href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", permission: "audit.view", group: "admin" },
];

/** Roles whose pages an Admin can switch on and off. Admin itself always sees every page. */
export const CONFIGURABLE_ROLES = ["host", "call_center", "viewer"] as const;
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
/** Pages a role starts with before the Admin changes anything. */
export const DEFAULT_PAGES: Partial<Record<AppRole, PageKey[]>> = {
  call_center: ["requests", "availability"],
};

export function allowedPages(role: AppRole, access: PageAccess): PageKey[] {
  const possible = possiblePages(role);
  if (role === "super_admin") return possible;
  const chosen = ((CONFIGURABLE_ROLES as readonly string[]).includes(role) ? access[role as ConfigurableRole] : undefined) ?? DEFAULT_PAGES[role];
  if (!chosen) return possible;
  return possible.filter((k) => chosen.includes(k));
}
