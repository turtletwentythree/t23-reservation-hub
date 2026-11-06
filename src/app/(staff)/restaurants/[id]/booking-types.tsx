"use client";
import { useT } from "@/components/staff-locale";
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
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (fd: FormData, id?: string) =>
    start(async () => {
      const res = await saveBookingTypeAction(restaurantId, { ...Object.fromEntries(fd), id });
      if (res.ok) { toast.success(t("Saved")); router.refresh(); } else toast.error(t(res.error));
    });
  return (
    <div className="space-y-3">
      {types.map((bt) => (
        <form key={bt.id} action={(fd) => save(fd, bt.id)} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 sm:grid-cols-4 lg:grid-cols-7">
          <fieldset disabled={readOnly || pending} className="contents">
            <Field label={t("Name (EN)")}><Input name="name_en" defaultValue={bt.name.en} /></Field>
            <Field label="ไทย"><Input name="name_th" defaultValue={bt.name.th} /></Field>
            <Field label={t("Français")}><Input name="name_fr" defaultValue={bt.name.fr} /></Field>
            <Field label={`${t("Price")} (${currency})`}><Input name="price" type="number" defaultValue={bt.price ?? ""} /></Field>
            <Field label={t("Duration (min)")}><Input name="duration_minutes" type="number" defaultValue={bt.duration_minutes ?? ""} /></Field>
            <Field label={t("Deposit / person")}><Input name="deposit_override" type="number" defaultValue={bt.deposit_override ?? ""} /></Field>
            <div className="flex flex-col gap-1 text-xs">
              <label className="flex gap-1"><input type="checkbox" name="is_online" defaultChecked={bt.is_online} />{" "}{t("Online")}</label>
              <label className="flex gap-1"><input type="checkbox" name="is_active" defaultChecked={bt.is_active} />{" "}{t("Active")}</label>
              {!readOnly ? <Button size="sm" type="submit">{t("Save")}</Button> : null}
            </div>
          </fieldset>
          {bt.price ? <p className="col-span-full text-xs text-muted">{t("Shown to guests as")} {formatMoney(bt.price, currency)} {bt.is_active ? null : <Badge>{t("inactive")}</Badge>}</p> : null}
        </form>
      ))}
      {!readOnly ? (
        <form action={(fd) => save(fd)} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-5">
          <Field label={t("New booking type / course")}><Input name="name_en" required placeholder={t("e.g. Chef's tasting menu")} /></Field>
          <Field label={`${t("Price")} (${currency})`}><Input name="price" type="number" /></Field>
          <Field label={t("Duration (min)")}><Input name="duration_minutes" type="number" /></Field>
          <Field label={t("Deposit / person")}><Input name="deposit_override" type="number" /></Field>
          <Button type="submit" disabled={pending}>{t("Add")}</Button>
        </form>
      ) : null}
    </div>
  );
}
