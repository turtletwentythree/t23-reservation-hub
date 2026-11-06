import Image from "next/image";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { getStaffT } from "@/lib/i18n/staff-server";
import { LanguageSwitcher, StaffLocaleProvider } from "@/components/staff-locale";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; detail?: string }> }) {
  if (await getStaffContext()) redirect("/dashboard");
  const { next, error, detail } = await searchParams;
  const { locale, t } = await getStaffT();
  return (
    <StaffLocaleProvider locale={locale}>
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <LanguageSwitcher className="mb-4 justify-end" />
        <Image src="/turtle23-logo.png" width={956} height={114} alt="Turtle 23 Company Limited" className="mb-5 h-auto w-full" priority />
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="font-semibold text-slate-900">Reservation Hub</h1>
            <p className="text-xs text-muted">{t("Staff sign in")}</p>
          </div>
        </div>
        <LoginForm next={next} error={error} detail={detail} />
        <p className="mt-6 text-center text-xs text-muted">{t("Accounts are created by a T23 administrator.")}</p>
      </div>
    </div>
    </StaffLocaleProvider>
  );
}
