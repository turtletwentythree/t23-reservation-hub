"use client";
import { createContext, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { makeT, STAFF_LOCALE_LABELS, STAFF_LOCALES, type StaffLocale } from "@/lib/i18n/staff";
import { setStaffLocaleAction } from "@/app/locale-actions";
import { cn } from "@/lib/utils";

const Ctx = createContext<StaffLocale>("en");

export function StaffLocaleProvider({ locale, children }: { locale: StaffLocale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useStaffLocale() {
  return useContext(Ctx);
}

export function useT() {
  const locale = useContext(Ctx);
  return useMemo(() => makeT(locale), [locale]);
}

export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const locale = useContext(Ctx);
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("Language")} className={cn("flex items-center gap-1", className)}>
      <Languages className={cn("hidden size-4 sm:block", tone === "dark" ? "text-brand-200" : "text-slate-400")} aria-hidden="true" />
      <div className={cn("flex rounded-lg p-0.5", tone === "dark" ? "bg-brand-800" : "bg-slate-100")}>
        {STAFF_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            disabled={pending}
            aria-pressed={l === locale}
            onClick={() =>
              start(async () => {
                await setStaffLocaleAction(l);
                router.refresh();
              })
            }
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              l === locale
                ? tone === "dark" ? "bg-brand-600 text-white" : "bg-white text-slate-900 shadow-sm"
                : tone === "dark" ? "text-brand-100 hover:text-white" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {STAFF_LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
