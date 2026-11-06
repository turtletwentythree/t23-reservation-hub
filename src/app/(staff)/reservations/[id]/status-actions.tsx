"use client";
import { useT } from "@/components/staff-locale";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STATUS_META, STATUS_TRANSITIONS } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";
import { setStatusAction, deleteReservationAction } from "../actions";

const PRIMARY: ReservationStatus[] = ["confirmed", "arrived", "seated", "completed"];

export function StatusActions({ id, status, canDelete }: { id: string; status: ReservationStatus; canDelete: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = STATUS_TRANSITIONS[status];

  const run = (to: ReservationStatus) =>
    start(async () => {
      let reason: string | undefined;
      if (to === "cancelled") {
        const r = window.prompt(t("Cancellation reason (optional)"));
        if (r === null) return;
        reason = r;
      }
      if (to === "no_show" && !window.confirm(t("Mark this reservation as a no-show?"))) return;
      const res = await setStatusAction(id, to, reason);
      if (res.ok) {
        toast.success(`Marked ${t(STATUS_META[to].label)}`);
        router.refresh();
      } else toast.error(t(res.error));
    });

  return (
    <div className="flex flex-wrap gap-2">
      {next.map((s) => (
        <Button
          key={s}
          size="sm"
          disabled={pending}
          variant={s === "cancelled" || s === "no_show" ? "outline" : PRIMARY.includes(s) ? "default" : "outline"}
          className={s === "cancelled" || s === "no_show" ? "text-red-700" : ""}
          onClick={() => run(s)}
        >
          {s === "arrived" ? t("Check in (arrived)") : t(STATUS_META[s].label)}
        </Button>
      ))}
      {canDelete ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-red-700"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm(t("Permanently delete this reservation? Prefer cancelling — deletion removes its history."))) return;
              const res = await deleteReservationAction(id);
              if (res.ok) router.push("/reservations");
              else toast.error(t(res.error));
            })
          }
        >
          {t("Delete")}
        </Button>
      ) : null}
    </div>
  );
}
