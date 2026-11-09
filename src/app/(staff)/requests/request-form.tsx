"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Phone } from "lucide-react";
import { useT } from "@/components/staff-locale";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/lib/domain/request-tags";
import { getSlotsAction, type SlotView } from "../reservations/actions";
import { createRequestAction } from "./actions";

type Values = {
  restaurant_id: string;
  channel: "call" | "line";
  customer_type: CustomerType;
  customer_name: string;
  contact: string;
  party_size: number;
  requested_date: string;
  requested_time: string;
  notes: string;
};

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode; on: string }[]; onChange: (v: T) => void }) {
  return (
    <div className={cn("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", value === o.value ? o.on : "bg-white text-slate-600")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RequestForm({ restaurants, initial }: {
  restaurants: { id: string; name: string }[];
  initial: { restaurant_id: string; requested_date: string; requested_time: string; party_size: number };
}) {
  const t = useT();
  const router = useRouter();
  const blank: Values = { ...initial, channel: "call", customer_type: "internal", customer_name: "", contact: "", notes: "" };
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const res = await createRequestAction({
        restaurant_id: v.restaurant_id,
        channel: v.channel,
        customer_type: v.customer_type,
        customer_name: v.customer_name,
        phone: v.channel === "call" ? v.contact : "",
        line_id: v.channel === "line" ? v.contact : "",
        party_size: v.party_size,
        requested_date: v.requested_date,
        requested_time: v.requested_time,
        notes: v.notes,
      });
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
      <Toggle
        value={v.channel}
        onChange={(c) => set("channel", c)}
        options={[
          { value: "call", label: <><Phone className="size-4" />Phone</>, on: "border-brand-500 bg-brand-50 text-brand-800" },
          { value: "line", label: <><MessageCircle className="size-4" />LINE</>, on: "border-emerald-500 bg-emerald-50 text-emerald-800" },
        ]}
      />
      <Toggle
        value={v.customer_type}
        onChange={(c) => set("customer_type", c)}
        options={[
          { value: "internal", label: "Internal", on: "border-slate-600 bg-slate-100 text-slate-900" },
          { value: "kol", label: "KOL", on: "border-purple-500 bg-purple-50 text-purple-800" },
          { value: "media", label: "Media", on: "border-sky-500 bg-sky-50 text-sky-800" },
        ]}
      />

      {restaurants.length > 1 ? (
        <Field label={t("Restaurant")}>
          <Select value={v.restaurant_id} onChange={(e) => set("restaurant_id", e.target.value)} required>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("Guest name")}>
          <Input value={v.customer_name} onChange={(e) => set("customer_name", e.target.value)} required maxLength={120} />
        </Field>
        <Field label={v.channel === "call" ? t("Phone") : "LINE ID"}>
          <Input value={v.contact} onChange={(e) => set("contact", e.target.value)} inputMode={v.channel === "call" ? "tel" : "text"} required />
        </Field>
        <Field label={t("Date")}>
          <Input type="date" value={v.requested_date} onChange={(e) => set("requested_date", e.target.value)} required />
        </Field>
        <Field label={t("Guests")}>
          <Input type="number" min={1} max={200} value={v.party_size} onChange={(e) => set("party_size", Number(e.target.value))} required />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-700">
          {t("Time")} {checking ? <span className="text-muted">{t("· checking availability…")}</span> : <span className="text-muted">· {t("green = table free, red = full")}</span>}
        </p>
        {slotError ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t(slotError)}</p> : null}
        {slots ? (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button
                type="button"
                key={s.time}
                onClick={() => set("requested_time", s.time)}
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
        {v.requested_time && chosen && !chosen.available ? (
          <p className="mt-1.5 text-xs text-red-700">{t("Full at this time. Offer the guest another time, or send it anyway and the store will decide.")}</p>
        ) : null}
      </div>

      <Field label={t("Notes (optional)")}>
        <Input value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" className="w-full" disabled={saving || !v.requested_time}>
        {saving ? t("Saving…") : v.requested_time ? t("Send to store") : t("Pick a time")}
      </Button>
    </form>
  );
}
