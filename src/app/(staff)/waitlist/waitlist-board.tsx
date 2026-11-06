"use client";
import { useT } from "@/components/staff-locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { addToWaitlistAction, notifyWaitlistAction, seatWaitlistAction, setWaitlistStatusAction } from "./actions";

type Entry = { id: string; queue_number: number; customer_name: string; phone: string | null; party_size: number; status: string; joined_at: string; quoted_wait_minutes: number | null; estimate: number | null; notes: string | null };
type FreeTable = { id: string; label: string; max_capacity: number };

export function WaitlistBoard({ restaurantId, entries, freeTables, canWrite }: { restaurantId: string; entries: Entry[]; freeTables: FreeTable[]; canWrite: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const [seatFor, setSeatFor] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast.success(msg); router.refresh(); } else toast.error(r.error ?? t("Failed"));
    });
  const waited = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {canWrite ? (
        <Card className="h-fit p-4">
          <p className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="size-4" />{" "}{t("Add to queue")}</p>
          <form
            className="space-y-3"
            action={(fd) =>
              start(async () => {
                const r = await addToWaitlistAction({ ...Object.fromEntries(fd), restaurant_id: restaurantId });
                if (r.ok) { toast.success(`Queue number #${r.data.queue_number}`); router.refresh(); } else toast.error(r.error);
              })
            }
          >
            <Field label={t("Name")}><Input name="customer_name" required /></Field>
            <Field label={t("Phone (for SMS / LINE notification)")}><Input name="phone" inputMode="tel" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Party size")}><Input name="party_size" type="number" min={1} defaultValue={2} required /></Field>
              <Field label={t("Quoted wait (min)")}><Input name="quoted_wait_minutes" type="number" min={0} /></Field>
            </div>
            <Field label={t("Notes")}><Input name="notes" /></Field>
            <Button className="w-full" disabled={pending}>{t("Add walk-in to queue")}</Button>
          </form>
          <p className="mt-3 text-xs text-muted">{t("Arrival time and queue number are recorded automatically.")}</p>
        </Card>
      ) : null}

      <div className="space-y-2">
        {entries.length === 0 ? <Card className="p-8 text-center text-sm text-muted">{t("Nobody is waiting.")}</Card> : null}
        {entries.map((e) => (
          <Card key={e.id} className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent-500 text-lg font-bold text-white">#{e.queue_number}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.customer_name} · {e.party_size} guests {e.status === "notified" ? <Badge tone="blue">{t("Notified")}</Badge> : null}</p>
                <p className="text-xs text-muted">
                  {t("Waiting")} {waited(e.joined_at)} min{e.quoted_wait_minutes != null ? ` · quoted ${e.quoted_wait_minutes} min` : ""} · est. {e.estimate === null ? "no table fits" : e.estimate === 0 ? "table free now" : `~${e.estimate} min`}
                  {e.phone ? ` · ${e.phone}` : ""}{e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await notifyWaitlistAction(e.id); if (r.ok && r.data.queued === 0) toast.warning("No phone/LINE or template — nothing sent"); return r; }, "Notification attempted (see Notifications for delivery status)")}><Bell />{" "}{t("Notify")}</Button>
                  <Button size="sm" disabled={pending} onClick={() => setSeatFor(seatFor === e.id ? null : e.id)}>{t("Seat")}</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setWaitlistStatusAction(e.id, "left"), t("Marked as left"))}>{t("Left")}</Button>
                </div>
              ) : null}
            </div>
            {seatFor === e.id ? (
              <form className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" action={(fd) => run(() => seatWaitlistAction(e.id, fd.getAll("table").map(String)), t("Seated"))}>
                <Field label={t("Table available now")}>
                  <Select name="table" required className="w-56">
                    {freeTables.filter((t) => t.max_capacity >= e.party_size).map((t) => <option key={t.id} value={t.id}>{t.label} ({t.max_capacity} seats)</option>)}
                    {freeTables.filter((t) => t.max_capacity >= e.party_size).length === 0 ? <option value="">{t("No free table fits")}</option> : null}
                  </Select>
                </Field>
                <Button size="sm" disabled={pending}>{t("Confirm seating")}</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
