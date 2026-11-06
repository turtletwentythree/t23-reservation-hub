"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anonymizeCustomerAction, createTagAction, recordConsentAction, setCustomerTagsAction } from "../actions";

export function TagPicker({ customerId, tags, assigned, canEdit }: { customerId: string; tags: { id: string; name: string; color: string }[]; assigned: string[]; canEdit: boolean }) {
  const [sel, setSel] = useState(assigned);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (id: string) => {
    if (!canEdit) return;
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    start(async () => { const r = await setCustomerTagsAction(customerId, next); if (!r.ok) toast.error(r.error); });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button key={t.id} disabled={pending || !canEdit} onClick={() => toggle(t.id)} className="rounded-full border-2 px-2.5 py-0.5 text-xs font-medium transition" style={sel.includes(t.id) ? { background: t.color, borderColor: t.color, color: "white" } : { borderColor: t.color, color: t.color }}>
            {t.name}
          </button>
        ))}
      </div>
      {canEdit ? (
        <form className="flex gap-1" action={(fd) => start(async () => { const r = await createTagAction(String(fd.get("name")), String(fd.get("color"))); if (r.ok) router.refresh(); else toast.error(r.error); })}>
          <Input name="name" placeholder="New tag" className="h-8" required />
          <input type="color" name="color" defaultValue="#2f7d4f" className="h-8 w-10 rounded border" aria-label="Tag colour" />
          <Button size="sm" variant="outline">Add</Button>
        </form>
      ) : null}
    </div>
  );
}

const CONSENTS: [string, string][] = [
  ["data_processing", "Personal data processing for reservations"],
  ["marketing_email", "Marketing by email"],
  ["marketing_sms", "Marketing by SMS"],
  ["marketing_line", "Marketing by LINE"],
  ["birthday_offers", "Birthday offers"],
];

export function ConsentPanel({ customerId, current, canEdit }: { customerId: string; current: Record<string, boolean>; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ul className="space-y-1.5 text-sm">
      {CONSENTS.map(([k, label]) => (
        <li key={k} className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" disabled={!canEdit || pending} checked={current[k] ?? false} onChange={(e) => start(async () => { const r = await recordConsentAction(customerId, k, e.target.checked); if (r.ok) { toast.success("Consent recorded"); router.refresh(); } else toast.error(r.error); })} />
            {current[k] === undefined ? "not asked" : current[k] ? "granted" : "withdrawn"}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPanel({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">Erases name, contact details, notes and allergy data from this profile and all of its reservations and messages. Anonymous booking counts stay for reporting. This cannot be undone.</p>
      <Button variant="destructive" size="sm" disabled={pending} onClick={() => {
        const note = window.prompt("Type the request reference or reason to confirm erasure");
        if (!note) return;
        start(async () => { const r = await anonymizeCustomerAction(customerId, note); if (r.ok) { toast.success("Guest anonymized"); router.refresh(); } else toast.error(r.error); });
      }}>Erase personal data</Button>
    </div>
  );
}
