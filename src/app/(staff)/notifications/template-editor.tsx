"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveTemplateAction } from "./actions";

type T = { id?: string; event: string; channel: string; locale: string; subject: string | null; body: string; is_active: boolean };

export function TemplateEditor({ template }: { template?: T }) {
  const [t, setT] = useState<T>(template ?? { event: "booking_confirmation", channel: "email", locale: "en", subject: "", body: "", is_active: true });
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Event">
          <Select value={t.event} onChange={(e) => setT({ ...t, event: e.target.value })} disabled={Boolean(template)}>
            {["booking_confirmation", "booking_reminder", "booking_modification", "booking_cancellation", "waitlist_ready", "birthday_campaign"].map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
          </Select>
        </Field>
        <Field label="Channel">
          <Select value={t.channel} onChange={(e) => setT({ ...t, channel: e.target.value })} disabled={Boolean(template)}>
            {["email", "sms", "line", "whatsapp"].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={t.locale} onChange={(e) => setT({ ...t, locale: e.target.value })} disabled={Boolean(template)}>
            <option value="en">English</option><option value="th">Thai</option><option value="ja">Japanese</option>
          </Select>
        </Field>
      </div>
      {t.channel === "email" ? (
        <Field label="Subject"><Input value={t.subject ?? ""} onChange={(e) => setT({ ...t, subject: e.target.value })} /></Field>
      ) : null}
      <Field label="Body" hint="Variables: {{customer_name}} {{restaurant_name}} {{reference}} {{date}} {{time}} {{party_size}} {{manage_url}} {{queue_number}}">
        <Textarea rows={8} value={t.body.replace(/\\n/g, "\n")} onChange={(e) => setT({ ...t, body: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.is_active} onChange={(e) => setT({ ...t, is_active: e.target.checked })} /> Active</label>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveTemplateAction({ ...t, subject: t.subject ?? undefined });
            if (res.ok) { toast.success("Template saved"); router.refresh(); } else toast.error(res.error);
          })
        }
      >
        Save template
      </Button>
    </div>
  );
}
