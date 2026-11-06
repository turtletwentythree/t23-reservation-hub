"use client";
import { useT } from "@/components/staff-locale";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeCustomersAction } from "./actions";

export function MergeButton({ primaryId, duplicateId, label }: { primaryId: string; duplicateId: string; label: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => {
      if (!window.confirm(t("Merge these guests? Reservations, consents and tags move to guest A; guest B is removed."))) return;
      start(async () => { const r = await mergeCustomersAction(primaryId, duplicateId); if (r.ok) { toast.success(t("Guests merged")); router.refresh(); } else toast.error(t(r.error)); });
    }}>{label}</Button>
  );
}
