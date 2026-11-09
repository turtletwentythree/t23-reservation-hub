import { requireStaff } from "@/lib/auth/session";
import { roleCan, ROLE_LABELS } from "@/lib/auth/permissions";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/app-shell";
import { getStaffT } from "@/lib/i18n/staff-server";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const { locale, t } = await getStaffT();
  const visible = NAV_ITEMS.filter((i) => roleCan(ctx.role, i.permission) && ctx.pages.includes(i.key));
  // Empty sections are dropped, so a role only sees the headings it has pages under.
  const items = NAV_GROUPS.map((g) => ({
    label: t(g.label),
    items: visible.filter((i) => i.group === g.key).map(({ href, label, icon }) => ({ href, label: t(label), icon })),
  })).filter((g) => g.items.length > 0);
  return (
    <AppShell
      locale={locale}
      items={items}
      restaurants={ctx.restaurants}
      selectedBranch={ctx.selectedBranch}
      user={{ name: ctx.fullName, email: ctx.email, roleLabel: t(ROLE_LABELS[ctx.role]) }}
    >
      {children}
    </AppShell>
  );
}
