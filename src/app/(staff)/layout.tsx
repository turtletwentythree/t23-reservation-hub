import { requireStaff } from "@/lib/auth/session";
import { roleCan, ROLE_LABELS } from "@/lib/auth/permissions";
import { NAV_ITEMS } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/app-shell";
import { getStaffT } from "@/lib/i18n/staff-server";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const { locale, t } = await getStaffT();
  const items = NAV_ITEMS.filter((i) => roleCan(ctx.role, i.permission) && ctx.pages.includes(i.key)).map(({ href, label, icon }) => ({ href, label: t(label), icon }));
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
