"use client";
import { useT } from "@/components/staff-locale";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createReservationAction,
  getSlotsAction,
  searchCustomersAction,
  updateReservationAction,
  type SlotView,
} from "./actions";

export type FormRestaurant = { id: string; name: string };
export type FormTable = { id: string; label: string; max_capacity: number; restaurant_id: string; area?: string | null };
export type FormSource = { id: string; name: string; code: string };
export type FormBookingType = { id: string; restaurant_id: string; name: string };

export type ReservationFormValues = {
  id?: string;
  restaurant_id: string;
  customer_id?: string;
  customer_name: string;
  phone: string;
  email: string;
  language: "en" | "th" | "ja" | "fr";
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  duration_minutes?: number;
  booking_source_id: string;
  booking_type_id: string;
  table_ids: string[];
  special_occasion: string;
  dietary_requirements: string;
  allergies: string;
  guest_notes: string;
  internal_notes: string;
  deposit_amount: number;
  status: "pending" | "confirmed" | "arrived" | "seated";
  is_walk_in: boolean;
};

export function ReservationForm({ restaurants, tables, sources, bookingTypes, initial, onDone }: {
  restaurants: FormRestaurant[];
  tables: FormTable[];
  sources: FormSource[];
  bookingTypes: FormBookingType[];
  initial: ReservationFormValues;
  onDone?: (id: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  const [v, setV] = useState<ReservationFormValues>(initial);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [loadingSlots, startSlots] = useTransition();
  const [saving, startSave] = useTransition();
  const [allowOver, setAllowOver] = useState(false);
  const [manualTables, setManualTables] = useState(isEdit);
  const [custQuery, setCustQuery] = useState("");
  const [custResults, setCustResults] = useState<Awaited<ReturnType<typeof searchCustomersAction>> | null>(null);

  const set = <K extends keyof ReservationFormValues>(k: K, val: ReservationFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const restaurantTables = useMemo(() => tables.filter((t) => t.restaurant_id === v.restaurant_id), [tables, v.restaurant_id]);
  const restaurantTypes = bookingTypes.filter((b) => b.restaurant_id === v.restaurant_id);
  const selectedSlot = slots?.find((s) => s.time === v.reservation_time);
  const assignedCapacity = restaurantTables.filter((t) => v.table_ids.includes(t.id)).reduce((a, t) => a + t.max_capacity, 0);

  const loadSlots = () => {
    if (!v.restaurant_id || !v.reservation_date || !v.party_size) return;
    startSlots(async () => {
      const res = await getSlotsAction({
        restaurantId: v.restaurant_id,
        date: v.reservation_date,
        partySize: Number(v.party_size),
        ignoreReservationId: v.id,
      });
      if (res.ok) {
        setSlots(res.data.slots);
        setSlotError(null);
      } else {
        setSlots(null);
        setSlotError(res.error);
      }
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSlots, [v.restaurant_id, v.reservation_date, v.party_size]);

  useEffect(() => {
    if (custQuery.trim().length < 2) {
      setCustResults(null);
      return;
    }
    const t = setTimeout(async () => setCustResults(await searchCustomersAction(custQuery)), 300);
    return () => clearTimeout(t);
  }, [custQuery]);

  const pickSlot = (s: SlotView) => {
    setV((p) => ({ ...p, reservation_time: s.time, table_ids: manualTables ? p.table_ids : (s.options[0]?.table_ids ?? []) }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const payload = {
        ...v,
        auto_assign: !manualTables,
        allow_over_capacity: allowOver,
        reassign_tables: manualTables,
      };
      const res = isEdit ? await updateReservationAction(payload) : await createReservationAction(payload);
      if (!res.ok) {
        toast.error(t(res.error));
        return;
      }
      toast.success(isEdit ? t("Reservation updated") : `Reservation ${"reference" in res.data ? res.data.reference : ""} created`);
      if (onDone) onDone(res.data.id);
      else router.push(`/reservations/${res.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t("Restaurant")} className="col-span-2">
          <Select value={v.restaurant_id} disabled={isEdit} onChange={(e) => setV((p) => ({ ...p, restaurant_id: e.target.value, table_ids: [], booking_type_id: "" }))} required>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label={t("Date")}>
          <Input type="date" value={v.reservation_date} onChange={(e) => set("reservation_date", e.target.value)} required />
        </Field>
        <Field label={t("Guests")}>
          <Input type="number" min={1} max={200} value={v.party_size} onChange={(e) => set("party_size", Number(e.target.value))} required />
        </Field>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-700">{t("Time")} {loadingSlots ? <span className="text-muted">{t("· checking availability…")}</span> : null}</p>
          <div className="flex items-center gap-2">
            <Input type="time" step={300} value={v.reservation_time} onChange={(e) => set("reservation_time", e.target.value)} className="h-8 w-28" aria-label={t("Custom time")} required />
          </div>
        </div>
        {slotError ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{slotError} Staff can still enter a custom time.</p> : null}
        {slots ? (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button
                type="button"
                key={s.time}
                onClick={() => pickSlot(s)}
                title={s.available ? `Best: ${s.options[0]?.labels.join("+")}` : t("No table free — can still be booked unassigned")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-sm tabular-nums transition",
                  v.reservation_time === s.time
                    ? "border-brand-500 bg-brand-500 text-white"
                    : s.available
                      ? "bg-white hover:border-brand-400"
                      : "border-dashed bg-slate-50 text-slate-400 line-through",
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-slate-50/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-700">
            {t("Tables")} {v.table_ids.length ? `· ${assignedCapacity} ${t("seats")} · ${v.party_size} ${t("guests")}` : `· ${t("none assigned")}`}
          </p>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={manualTables} onChange={(e) => setManualTables(e.target.checked)} />{" "}{t("Choose manually")}
          </label>
        </div>
        {!manualTables ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedSlot?.options.length ? (
              selectedSlot.options.map((o) => (
                <button
                  type="button"
                  key={o.table_ids.join()}
                  onClick={() => set("table_ids", o.table_ids)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-sm",
                    o.table_ids.join() === v.table_ids.join() ? "border-accent-500 bg-accent-50 text-accent-700" : "bg-white",
                  )}
                >
                  {o.labels.join(" + ")} <span className="text-xs text-muted">({o.capacity})</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted">{v.reservation_time ? t("No free table fits at this time. The booking will be saved unassigned.") : t("Pick a time to see table options.")}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {restaurantTables.map((t) => {
              const on = v.table_ids.includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => set("table_ids", on ? v.table_ids.filter((x) => x !== t.id) : [...v.table_ids, t.id])}
                  className={cn("rounded-lg border px-2.5 py-1 text-sm", on ? "border-accent-500 bg-accent-50 text-accent-700" : "bg-white")}
                >
                  {t.label} <span className="text-xs text-muted">({t.max_capacity})</span>
                </button>
              );
            })}
          </div>
        )}
        {v.table_ids.length > 0 && assignedCapacity < v.party_size ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="size-3.5" />{" "}{t("Party exceeds table capacity.")}
            <input type="checkbox" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} />{" "}{t("Override")}
          </label>
        ) : null}
      </section>

      <section className="space-y-3">
        {!isEdit ? (
          <div className="relative">
            <Field label={t("Find existing guest (phone or name)")}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <Input className="pl-8" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder={t("081… or name")} />
              </div>
            </Field>
            {custResults?.ok && custResults.data.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {custResults.data.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                    onClick={() => {
                      setV((p) => ({ ...p, customer_id: c.id, customer_name: c.full_name, phone: c.phone ?? "", email: c.email ?? "", allergies: c.allergies ?? p.allergies }));
                      setCustQuery("");
                      setCustResults(null);
                    }}
                  >
                    <span>
                      {c.is_vip ? <Star className="mr-1 inline size-3.5 fill-accent-500 text-accent-500" /> : null}
                      {c.full_name} <span className="text-muted">· {c.phone ?? c.email}</span>
                    </span>
                    <span className="text-xs text-muted">{c.total_visits} visits</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("Guest name")}>
            <Input value={v.customer_name} onChange={(e) => set("customer_name", e.target.value)} required maxLength={120} />
          </Field>
          <Field label={t("Phone")}>
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </Field>
          <Field label={t("Email")}>
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        {v.customer_id ? <p className="text-xs text-brand-700">{t("Linked to existing guest profile.")}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Field label={t("Source")}>
          <Select value={v.booking_source_id} onChange={(e) => set("booking_source_id", e.target.value)}>
            <option value="">—</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label={t("Booking type")}>
          <Select value={v.booking_type_id} onChange={(e) => set("booking_type_id", e.target.value)}>
            <option value="">—</option>
            {restaurantTypes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label={t("Language")}>
          <Select value={v.language} onChange={(e) => set("language", e.target.value as "en")}>
            <option value="en">{t("English")}</option>
            <option value="th">ไทย</option>
            <option value="fr">{t("Français")}</option>
          </Select>
        </Field>
        {!isEdit ? (
          <Field label={t("Status")}>
            <Select value={v.status} onChange={(e) => set("status", e.target.value as "confirmed")}>
              <option value="confirmed">{t("Confirmed")}</option>
              <option value="pending">{t("Pending")}</option>
              <option value="arrived">{t("Arrived")}</option>
              <option value="seated">{t("Seated")}</option>
            </Select>
          </Field>
        ) : (
          <Field label={t("Deposit (THB)")}>
            <Input type="number" min={0} step="0.01" value={v.deposit_amount} onChange={(e) => set("deposit_amount", Number(e.target.value))} />
          </Field>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Field label={t("Special occasion")}>
          <Input value={v.special_occasion} onChange={(e) => set("special_occasion", e.target.value)} placeholder={t("Birthday, anniversary…")} />
        </Field>
        <Field label={t("Dietary requirements")}>
          <Input value={v.dietary_requirements} onChange={(e) => set("dietary_requirements", e.target.value)} />
        </Field>
        <Field label={t("Allergies")}>
          <Input value={v.allergies} onChange={(e) => set("allergies", e.target.value)} className={v.allergies ? "border-amber-400" : ""} />
        </Field>
        <Field label={t("Guest notes")} className="sm:col-span-3">
          <Textarea rows={2} value={v.guest_notes} onChange={(e) => set("guest_notes", e.target.value)} />
        </Field>
        <Field label={t("Internal notes (staff only)")} className="sm:col-span-3">
          <Textarea rows={2} value={v.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
        </Field>
        {!isEdit ? (
          <Field label={t("Deposit amount (THB)")}>
            <Input type="number" min={0} step="0.01" value={v.deposit_amount} onChange={(e) => set("deposit_amount", Number(e.target.value))} />
          </Field>
        ) : null}
      </section>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={saving}>{saving ? t("Saving…") : isEdit ? t("Save changes") : t("Create reservation")}</Button>
      </div>
    </form>
  );
}
