"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { saveBookingTypeAction } from "../actions";

type BT = { id: string; name: Record<string, string>; price: number | null; duration_minutes: number | null; deposit_override: number | null; is_online: boolean; is_active: boolean };

export function BookingTypes({ restaurantId, types, currency, readOnly }: { restaurantId: string; types: BT[]; currency: string; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (fd: FormData, id?: string) =>
    start(async () => {
      const res = await saveBookingTypeAction(restaurantId, { ...Object.fromEntries(fd), id });
      if (res.ok) { toast.success("Saved"); router.refresh(); } else toast.error(res.error);
    });
  return (
    <div className="space-y-3">
      {types.map((t) => (
        <form key={t.id} action={(fd) => save(fd, t.id)} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 sm:grid-cols-4 lg:grid-cols-7">
          <fieldset disabled={readOnly || pending} className="contents">
            <Field label="Name (EN)"><Input name="name_en" defaultValue={t.name.en} /></Field>
            <Field label="ไทย"><Input name="name_th" defaultValue={t.name.th} /></Field>
            <Field label="Français"><Input name="name_fr" defaultValue={t.name.fr} /></Field>
            <Field label={`Price (${currency})`}><Input name="price" type="number" defaultValue={t.price ?? ""} /></Field>
            <Field label="Duration (min)"><Input name="duration_minutes" type="number" defaultValue={t.duration_minutes ?? ""} /></Field>
            <Field label="Deposit / person"><Input name="deposit_override" type="number" defaultValue={t.deposit_override ?? ""} /></Field>
            <div className="flex flex-col gap-1 text-xs">
              <label className="flex gap-1"><input type="checkbox" name="is_online" defaultChecked={t.is_online} /> Online</label>
              <label className="flex gap-1"><input type="checkbox" name="is_active" defaultChecked={t.is_active} /> Active</label>
              {!readOnly ? <Button size="sm" type="submit">Save</Button> : null}
            </div>
          </fieldset>
          {t.price ? <p className="col-span-full text-xs text-muted">Shown to guests as {formatMoney(t.price, currency)} {t.is_active ? null : <Badge>inactive</Badge>}</p> : null}
        </form>
      ))}
      {!readOnly ? (
        <form action={(fd) => save(fd)} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-5">
          <Field label="New booking type / course"><Input name="name_en" required placeholder="e.g. Chef's tasting menu" /></Field>
          <Field label={`Price (${currency})`}><Input name="price" type="number" /></Field>
          <Field label="Duration (min)"><Input name="duration_minutes" type="number" /></Field>
          <Field label="Deposit / person"><Input name="deposit_override" type="number" /></Field>
          <Button type="submit" disabled={pending}>Add</Button>
        </form>
      ) : null}
    </div>
  );
}
