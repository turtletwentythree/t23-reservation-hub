import type { Permission } from "@/lib/auth/permissions";

export const NAV_ITEMS: { href: string; label: string; icon: string; permission: Permission }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", permission: "dashboard.view" },
  { href: "/reservations", label: "Reservations", icon: "BookOpen", permission: "reservation.view" },
  { href: "/calendar", label: "Calendar", icon: "CalendarDays", permission: "reservation.view" },
  { href: "/floor-plan", label: "Floor Plan", icon: "LayoutGrid", permission: "reservation.view" },
  { href: "/waitlist", label: "Waitlist", icon: "ListOrdered", permission: "reservation.view" },
  { href: "/customers", label: "Customers", icon: "Users", permission: "customer.view" },
  { href: "/notifications", label: "Notifications", icon: "Bell", permission: "notification.view" },
  { href: "/reports", label: "Reports", icon: "BarChart3", permission: "report.view" },
  { href: "/restaurants", label: "Restaurants", icon: "Store", permission: "reservation.view" },
  { href: "/integrations", label: "Integrations", icon: "Plug", permission: "integration.view" },
  { href: "/users", label: "User Management", icon: "UserCog", permission: "user.manage" },
  { href: "/settings", label: "Settings", icon: "Settings", permission: "settings.manage" },
  { href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", permission: "audit.view" },
];
