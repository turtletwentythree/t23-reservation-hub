"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createApiKeyAction, createWebhookAction, retentionAction, revokeApiKeyAction, saveSourceAction, toggleWebhookAction } from "./actions";

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, msg: string, then?: (d: T) => void) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(msg); then?.(r.data); router.refresh(); } else toast.error(r.error); });
  return { pending, run };
}

export function SourceRow({ s }: { s?: { id: string; code: string; name: string; is_active: boolean; is_system: boolean } }) {
  const { pending, run } = useRun();
  return (
    <form className="flex flex-wrap items-end gap-2 border-b py-2" action={(fd) => run(() => saveSourceAction({ id: s?.id, code: s?.code ?? fd.get("code"), name: fd.get("name"), is_active: fd.get("is_active") === "on" }), "Saved")}>
      <Field label="Code"><Input name="code" defaultValue={s?.code} disabled={Boolean(s)} className="w-36" required /></Field>
      <Field label="Name"><Input name="name" defaultValue={s?.name} className="w-56" required /></Field>
      <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} /> Active</label>
      <Button size="sm" variant="outline" disabled={pending}>{s ? "Save" : "Add source"}</Button>
    </form>
  );
}

export function ApiKeys({ keys, restaurants }: { keys: { id: string; name: string; key_prefix: string; scopes: string[]; restaurant: string | null; last_used_at: string | null; revoked_at: string | null }[]; restaurants: { id: string; name: string }[] }) {
  const { pending, run } = useRun();
  const [shown, setShown] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {shown ? <div className="rounded-lg border border-accent-300 bg-accent-50 p-3 text-sm"><p className="font-medium">Copy this key now — it will not be shown again:</p><code className="break-all">{shown}</code></div> : null}
      <ul className="divide-y text-sm">
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><span className="font-medium">{k.name}</span> <code className="text-xs">{k.key_prefix}…</code> · {k.scopes.join(", ")} · {k.restaurant ?? "all branches"}{k.last_used_at ? ` · used ${new Date(k.last_used_at).toLocaleDateString()}` : ""}</span>
            {k.revoked_at ? <span className="text-xs text-red-600">revoked</span> : <Button size="sm" variant="ghost" className="text-red-700" disabled={pending} onClick={() => run(() => revokeApiKeyAction(k.id), "Key revoked")}>Revoke</Button>}
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap items-end gap-2" action={(fd) => run(() => createApiKeyAction({ name: fd.get("name"), restaurant_id: fd.get("restaurant_id"), scopes: fd.getAll("scopes") }), "API key created", (d) => setShown(d.key))}>
        <Field label="Key name"><Input name="name" required placeholder="e.g. Hotel concierge partner" /></Field>
        <Field label="Restrict to branch"><Select name="restaurant_id"><option value="">All branches</option>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
        <div className="flex gap-2 pb-2 text-xs">{["availability:read", "reservations:read", "reservations:write"].map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" name="scopes" value={s} defaultChecked={s === "availability:read"} /> {s}</label>)}</div>
        <Button size="sm" disabled={pending}>Create key</Button>
      </form>
    </div>
  );
}

export function Webhooks({ hooks }: { hooks: { id: string; url: string; events: string[]; is_active: boolean; deliveries: { status: string }[] }[] }) {
  const { pending, run } = useRun();
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {secret ? <div className="rounded-lg border border-accent-300 bg-accent-50 p-3 text-sm"><p className="font-medium">Signing secret (verify the X-T23-Signature header):</p><code className="break-all">{secret}</code></div> : null}
      <ul className="divide-y text-sm">
        {hooks.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="break-all"><span className="font-medium">{h.url}</span> · {h.events.join(", ")} · {h.deliveries.filter((d) => d.status === "delivered").length} delivered / {h.deliveries.filter((d) => d.status === "failed").length} failed</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => toggleWebhookAction(h.id, !h.is_active), h.is_active ? "Disabled" : "Enabled")}>{h.is_active ? "Disable" : "Enable"}</Button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap items-end gap-2" action={(fd) => run(() => createWebhookAction({ url: fd.get("url"), events: fd.getAll("events") }), "Webhook added", (d) => setSecret(d.secret))}>
        <Field label="HTTPS endpoint"><Input name="url" type="url" required placeholder="https://example.com/t23-webhook" className="w-80" /></Field>
        <div className="flex gap-2 pb-2 text-xs">{["reservation.created", "reservation.updated", "reservation.cancelled"].map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" name="events" value={s} defaultChecked /> {s}</label>)}</div>
        <Button size="sm" disabled={pending}>Add webhook</Button>
      </form>
    </div>
  );
}

export function Retention() {
  const { pending, run } = useRun();
  const [months, setMonths] = useState(36);
  const [preview, setPreview] = useState<{ customers: number; notification_logs: number; cutoff: string } | null>(null);
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted">Guests with no visit and no booking activity for the chosen period are anonymized; old message bodies are erased. Run a preview first.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Inactive for (months)"><Input type="number" min={6} max={240} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-32" /></Field>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => retentionAction(months, true), "Preview ready", setPreview)}>Preview</Button>
        <Button size="sm" variant="destructive" disabled={pending || !preview} onClick={() => { if (window.confirm(`Anonymize ${preview?.customers} guests permanently?`)) run(() => retentionAction(months, false), "Retention applied", setPreview); }}>Apply</Button>
      </div>
      {preview ? <p>{preview.customers} guest profiles and {preview.notification_logs} message logs older than {new Date(preview.cutoff).toLocaleDateString()} would be affected.</p> : null}
    </div>
  );
}
