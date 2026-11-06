"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Customer } from "@/lib/supabase/types";
import { saveCustomerAction } from "./actions";

export function CustomerForm({ customer, readOnly }: { customer?: Customer; readOnly?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const c = customer;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) =>
        start(async () => {
          const r = await saveCustomerAction(c?.id ?? null, Object.fromEntries(fd));
          if (!r.ok) return void toast.error(r.error);
          toast.success("Guest saved");
          if (!c) router.push(`/customers/${r.data.id}`);
          router.refresh();
        })
      }
    >
      <fieldset disabled={readOnly || pending} className="contents">
        <Field label="Full name"><Input name="full_name" defaultValue={c?.full_name} required /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={c?.phone ?? ""} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={c?.email ?? ""} /></Field>
        <Field label="Preferred language">
          <Select name="preferred_language" defaultValue={c?.preferred_language ?? "en"}><option value="en">English</option><option value="th">ไทย</option><option value="ja">日本語</option></Select>
        </Field>
        <Field label="Birthday"><Input name="birthday" type="date" defaultValue={c?.birthday ?? ""} /></Field>
        <Field label="LINE user ID" hint="Set when the guest connects via LINE OA"><Input name="line_user_id" defaultValue={c?.line_user_id ?? ""} /></Field>
        <Field label="Allergies"><Input name="allergies" defaultValue={c?.allergies ?? ""} /></Field>
        <Field label="Dietary preferences"><Input name="dietary_preferences" defaultValue={c?.dietary_preferences ?? ""} /></Field>
        <Field label="Special requests" className="sm:col-span-2"><Textarea name="special_requests" rows={2} defaultValue={c?.special_requests ?? ""} /></Field>
        <Field label="Internal notes (staff only)" className="sm:col-span-2"><Textarea name="internal_notes" rows={2} defaultValue={c?.internal_notes ?? ""} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_vip" defaultChecked={c?.is_vip} /> VIP</label>
        <Field label="VIP note"><Input name="vip_note" defaultValue={c?.vip_note ?? ""} /></Field>
        {!readOnly ? <div className="sm:col-span-2"><Button type="submit">{pending ? "Saving…" : "Save guest"}</Button></div> : null}
      </fieldset>
    </form>
  );
}
