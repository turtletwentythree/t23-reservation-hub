import { getStaffT } from "@/lib/i18n/staff-server";
import Link from "next/link";

export default async function Forbidden() {
  const { t } = await getStaffT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-accent-500">403</p>
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted">{t("Ask an Admin to update your role or branch access.")}</p>
      <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:underline">{t("Back to dashboard")}</Link>
    </div>
  );
}
