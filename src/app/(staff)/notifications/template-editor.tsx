"use client";
import { useT } from "@/components/staff-locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveTemplateAction } from "./actions";

type T = { id?: string; event: string; channel: string; locale: string; subject: string | null; body: string; is_active: boolean };

export function TemplateEditor({ template }: { template?: T }) {
  const t = useT();
  const [tpl, setTpl] = useState<T>(template ?? { event: "booking_confirmation", channel: "email", locale: "en", subject: "", body: "", is_active: true });
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label={t("Event")}>
          <Select value={tpl.event} onChange={(e) => setTpl({ ...tpl, event: e.target.value })} disabled={Boolean(template)}>
            {["booking_confirmation", "booking_reminder", "booking_modification", "booking_cancellation", "waitlist_ready", "birthday_campaign"].map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
          </Select>
        </Field>
        <Field label={t("Channel")}>
          <Select value={tpl.channel} onChange={(e) => setTpl({ ...tpl, channel: e.target.value })} disabled={Boolean(template)}>
            {["email", "sms", "line", "whatsapp"].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label={t("Language")}>
          <Select value={tpl.locale} onChange={(e) => setTpl({ ...tpl, locale: e.target.value })} disabled={Boolean(template)}>
            <option value="en">{t("English")}</option><option value="th">{t("Thai")}</option><option value="fr">{t("French")}</option>
          </Select>
        </Field>
      </div>
      {tpl.channel === "email" ? (
        <Field label={t("Subject")}><Input value={tpl.subject ?? ""} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} /></Field>
      ) : null}
      <Field label={t("Body")} hint="Variables: {{customer_name}} {{restaurant_name}} {{reference}} {{date}} {{time}} {{party_size}} {{manage_url}} {{queue_number}}">
        <Textarea rows={8} value={tpl.body.replace(/\\n/g, "\n")} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tpl.is_active} onChange={(e) => setTpl({ ...tpl, is_active: e.target.checked })} />{" "}{t("Active")}</label>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveTemplateAction({ ...tpl, subject: tpl.subject ?? undefined });
            if (res.ok) { toast.success(t("Template saved")); router.refresh(); } else toast.error(res.error);
          })
        }
      >
        {t("Save template")}
      </Button>
    </div>
  );
}
