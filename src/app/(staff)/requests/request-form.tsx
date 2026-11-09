"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Phone } from "lucide-react";
import { useT } from "@/components/staff-locale";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSlotsAction, type SlotView } from "../reservations/actions";
import { createRequestAction } from "./actions";

type Values = {
  restaurant_id: string;
  channel: "call" | "line";
  customer_name: string;
  phone: string;
  line_id: string;
  party_size: number;
  requested_date: string;
  requested_time: string;
  notes: string;
};

export function RequestForm({ restaurants, initial }: {
  restaurants: { id: string; name: string }[];
  initial: { restaurant_id: string; requested_date: string; requested_time: string; party_size: number };
}) {
  const t = useT();
  const router = useRouter();
  const blank: Values = { ...initial, channel: "call", customer_name: "", phone: "", line_id: "", notes: "" };
  const [v, setV] = useState<Values>(blank);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  useEffect(() => {
    if (!v.restaurant_id || !v.requested_date || !v.party_size) return;
    startCheck(async () => {
      const res = await getSlotsAction({ restaurantId: v.restaurant_id, date: v.requested_date, partySize: Number(v.party_size) });
      if (res.ok) {
        setSlots(res.data.slots);
        setSlotError(null);
      } else {
        setSlots(null);
        setSlotError(res.error);
      }
    });
  }, [v.restaurant_id, v.requested_date, v.party_size]);

  const chosen = slots?.find((s) => s.time === v.requested_time);
  const openCount = slots?.filter((s) => s.available).length ?? 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const res = await createRequestAction(v);
      if (!res.ok) {
        toast.error(t(res.error));
        return;
      }
      toast.success(t("Request sent to the store"));
      setV({ ...blank, restaurant_id: v.restaurant_id, requested_date: v.requested_date });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["call", "line"] as const).map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => set("channel", c)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
              v.channel === c ? (c === "line" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-brand-500 bg-brand-50 text-brand-800") : "bg-white text-slate-600",
            )}
            aria-pressed={v.channel === c}
          >
            {c === "call" ? <Phone className="size-4" /> : <MessageCircle className="size-4" />}
            {c === "call" ? t("Phone call") : "LINE"}
          </button>
        ))}
      </div>

      {restaurants.length > 1 ? (
        <Field label={t("Restaurant")}>
          <Select value={v.restaurant_id} onChange={(e) => set("restaurant_id", e.target.value)} required>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("Date")}>
          <Input type="date" value={v.requested_date} onChange={(e) => set("requested_date", e.target.value)} required />
        </Field>
        <Field label={t("Guests")}>
          <Input type="number" min={1} max={200} value={v.party_size} onChange={(e) => set("party_size", Number(e.target.value))} required />
        </Field>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-700">
            {t("Time")}{" "}
            {checking ? <span className="text-muted">{t("· checking availability…")}</span> : slots ? <span className="text-muted">· {openCount}/{slots.length} {t("times have a table")}</span> : null}
          </p>
          <Input type="time" step={300} value={v.requested_time} onChange={(e) => set("requested_time", e.target.value)} className="h-8 w-28" aria-label={t("Custom time")} required />
        </div>
        {slotError ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t(slotError)}</p> : null}
        {slots ? (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button
                type="button"
                key={s.time}
                onClick={() => set("requested_time", s.time)}
                title={s.available ? t("Table free") : t("Full")}
                className={cn(
                  "rounded-lg border px-2 py-0.5 text-sm tabular-nums",
                  v.requested_time === s.time
                    ? "border-brand-500 bg-brand-500 text-white"
                    : s.available
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500"
                      : "border-red-200 bg-red-50 text-red-400 line-through",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        ) : null}
        {v.requested_time && slots ? (
          <p className={cn("mt-1.5 text-xs", chosen?.available ? "text-emerald-700" : "text-red-700")}>
            {chosen?.available
              ? `${t("A table is free at this time")} (${chosen.options[0]?.labels.join(" + ")})`
              : t("Full at this time. Offer the guest another time, or send it anyway and the store will decide.")}
          </p>
        ) : null}
      </div>

      <Field label={t("Guest name")}>
        <Input value={v.customer_name} onChange={(e) => set("customer_name", e.target.value)} required maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("Phone")}>
          <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t("LINE ID")}>
          <Input value={v.line_id} onChange={(e) => set("line_id", e.target.value)} />
        </Field>
      </div>
      <Field label={t("Notes for the store")}>
        <Textarea rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("Birthday, allergies, preferred zone…")} maxLength={1000} />
      </Field>
      <Button type="submit" className="w-full" disabled={saving}>{saving ? t("Saving…") : t("Send to store")}</Button>
    </form>
  );
}
