"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DICTIONARIES, type Locale } from "@/lib/i18n/dictionaries";
import { getPublicSlotsAction, guestCancelAction, guestModifyAction } from "@/app/book/actions";

export function GuestActions({ reference, token, reservationId, slug, locale, date, time, party, canModify, canCancel, maxParty }: {
  reference: string; token: string; reservationId: string; slug: string; locale: Locale; date: string; time: string; party: number; canModify: boolean; canCancel: boolean; maxParty: number;
}) {
  const t = DICTIONARIES[locale];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(date);
  const [p, setP] = useState(party);
  const [tm, setTm] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    start(async () => {
      const r = await getPublicSlotsAction({ slug, date: d, partySize: p, ignoreReservationId: reservationId, token });
      setTimes(r.ok ? r.data.times : []);
    });
  }, [open, d, p, slug, reservationId, token]);

  if (!canModify && !canCancel) return <p className="text-sm text-muted">{t.cutoffPassed}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canModify ? <Button variant="outline" onClick={() => setOpen(!open)}>{t.modify}</Button> : null}
        {canCancel ? (
          <Button variant="ghost" className="text-red-700" disabled={pending} onClick={() => {
            if (!window.confirm(t.cancelConfirm)) return;
            start(async () => { const r = await guestCancelAction(reference, token); if (r.ok) router.refresh(); else setMsg(r.error); });
          }}>{t.cancel}</Button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.date}><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
            <Field label={t.guests}><Input type="number" min={1} max={maxParty} value={p} onChange={(e) => setP(Number(e.target.value))} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {times.map((x) => <button key={x} type="button" onClick={() => setTm(x)} className={cn("rounded-lg border py-2 text-sm", tm === x ? "border-accent-500 bg-accent-500 text-white" : "")}>{x}</button>)}
            {times.length === 0 && !pending ? <p className="col-span-4 text-sm text-muted">{t.noTimes}</p> : null}
          </div>
          <Button disabled={!tm || pending} onClick={() => start(async () => {
            const r = await guestModifyAction(reference, token, { reservation_date: d, reservation_time: tm, party_size: p });
            if (r.ok) { setOpen(false); setMsg(null); router.refresh(); } else setMsg(r.error);
          })}>{t.saveChanges}</Button>
        </div>
      ) : null}
      {msg ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{msg}</p> : null}
      <p className="hidden">{time}</p>
    </div>
  );
}
