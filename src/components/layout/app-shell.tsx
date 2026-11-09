"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Sidebar, type NavSection } from "./sidebar";
import { Select } from "@/components/ui/input";
import { initials } from "@/lib/utils";
import { setBranchAction, signOutAction } from "@/app/(staff)/actions";
import { LanguageSwitcher, StaffLocaleProvider } from "@/components/staff-locale";
import { makeT, type StaffLocale } from "@/lib/i18n/staff";

export function AppShell({ children, items, restaurants, selectedBranch, user, locale }: {
  children: React.ReactNode;
  locale: StaffLocale;
  items: NavSection[];
  restaurants: { id: string; name: string; is_active: boolean }[];
  selectedBranch: string;
  user: { name: string; email: string; roleLabel: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = makeT(locale);

  return (
    <StaffLocaleProvider locale={locale}>
    <div className="flex h-dvh overflow-hidden">
      <Sidebar items={items} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b bg-white px-3 sm:px-5">
          <button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t("Open menu")}>
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted sm:inline">{t("Branch")}</span>
            <Select
              aria-label={t("Branch")}
              className="w-32 sm:w-56"
              value={selectedBranch}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                startTransition(async () => {
                  await setBranchAction(v);
                  router.refresh();
                });
              }}
            >
              {restaurants.length > 1 ? <option value="all">{t("All branches")} ({restaurants.length})</option> : null}
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_active ? "" : ` (${t("disabled")})`}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-800">{user.name}</p>
              <p className="text-xs leading-tight text-muted">{user.roleLabel}</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials(user.name)}
            </span>
            <form action={signOutAction}>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={t("Sign out")} title={t("Sign out")}>
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
    </StaffLocaleProvider>
  );
}
