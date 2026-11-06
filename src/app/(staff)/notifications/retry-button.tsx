"use client";
import { useT } from "@/components/staff-locale";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryNotificationAction } from "./actions";

export function RetryNotificationButton({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await retryNotificationAction(id);
          if (!res.ok) toast.error(t(res.error));
          else if (res.data.status === "sent") toast.success(t("Sent"));
          else toast.warning(`Result: ${res.data.status.replace("_", " ")}`);
          router.refresh();
        })
      }
    >
      {pending ? t("Retrying…") : t("Retry")}
    </button>
  );
}
