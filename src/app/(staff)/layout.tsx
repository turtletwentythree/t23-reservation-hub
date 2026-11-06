import { requireStaff } from "@/lib/auth/session";
import { roleCan, ROLE_LABELS } from "@/lib/auth/permissions";
import { NAV_ITEMS } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const items = NAV_ITEMS.filter((i) => roleCan(ctx.role, i.permission)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <AppShell
      items={items}
      restaurants={ctx.restaurants}
      selectedBranch={ctx.selectedBranch}
      user={{ name: ctx.fullName, email: ctx.email, roleLabel: ROLE_LABELS[ctx.role] }}
    >
      {children}
    </AppShell>
  );
}
