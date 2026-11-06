"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { BookingPolicy } from "@/lib/supabase/types";
import { updatePolicyAction } from "../actions";

export function PolicyForm({ restaurantId, policy, readOnly }: { restaurantId: string; policy: BookingPolicy | null; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const p = policy;
  const [rules, setRules] = useState<{ max_party: number; minutes: number }[]>((p?.duration_rules as { max_party: number; minutes: number }[]) ?? []);
  const cp = (p?.cancellation_policy ?? {}) as Record<string, string>;

  return (
    <form
      action={(fd) =>
        start(async () => {
          const data = { ...Object.fromEntries(fd), duration_rules: rules };
          const res = await updatePolicyAction(restaurantId, data);
          if (res.ok) { toast.success("Booking rules saved"); router.refresh(); } else toast.error(res.error);
        })
      }
    >
      <fieldset disabled={readOnly || pending} className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Seating & turn time</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Default seating duration (min)"><Input type="number" name="default_duration_minutes" defaultValue={p?.default_duration_minutes ?? 120} /></Field>
            <Field label="Buffer between bookings (min)"><Input type="number" name="buffer_minutes" defaultValue={p?.buffer_minutes ?? 15} /></Field>
            <Field label="Booking interval (min)">
              <Select name="slot_interval_minutes" defaultValue={String(p?.slot_interval_minutes ?? 15)}>
                {[5, 10, 15, 20, 30, 60].map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Large party needs approval (≥)"><Input type="number" name="large_party_threshold" defaultValue={p?.large_party_threshold ?? ""} /></Field>
          </div>
          <div className="mt-3 rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium">Turn time by party size</p>
            {rules.map((r, i) => (
              <div key={i} className="mb-2 flex items-center gap-2 text-sm">
                Up to <Input type="number" className="w-20" value={r.max_party} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, max_party: Number(e.target.value) } : x)))} /> guests →
                <Input type="number" className="w-24" value={r.minutes} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} /> min
                <button type="button" className="p-1 text-red-600" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label="Remove rule"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setRules([...rules, { max_party: 4, minutes: 120 }])}><Plus /> Add rule</Button>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Party size & booking window</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Min party (online)"><Input type="number" name="min_party_size" defaultValue={p?.min_party_size ?? 1} /></Field>
            <Field label="Max party (online)"><Input type="number" name="max_party_size" defaultValue={p?.max_party_size ?? 8} /></Field>
            <Field label="Min notice (minutes)"><Input type="number" name="min_advance_minutes" defaultValue={p?.min_advance_minutes ?? 60} /></Field>
            <Field label="Book up to (days ahead)"><Input type="number" name="max_advance_days" defaultValue={p?.max_advance_days ?? 60} /></Field>
            <Field label="Guest cancel cut-off (hours)"><Input type="number" name="cancellation_cutoff_hours" defaultValue={p?.cancellation_cutoff_hours ?? 24} /></Field>
            <Field label="Guest modify cut-off (hours)"><Input type="number" name="modification_cutoff_hours" defaultValue={p?.modification_cutoff_hours ?? 24} /></Field>
            <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="auto_confirm_online" defaultChecked={p?.auto_confirm_online ?? true} /> Auto-confirm online bookings</label>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Deposit, prepayment & no-show fee</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Deposit type">
              <Select name="deposit_type" defaultValue={p?.deposit_type ?? "none"}>
                <option value="none">No deposit</option>
                <option value="per_person">Per person</option>
                <option value="flat">Flat per booking</option>
                <option value="full_prepayment">Full prepayment</option>
              </Select>
            </Field>
            <Field label="Amount"><Input type="number" step="0.01" name="deposit_amount" defaultValue={Number(p?.deposit_amount ?? 0)} /></Field>
            <Field label="Applies from party of"><Input type="number" name="deposit_min_party_size" defaultValue={p?.deposit_min_party_size ?? 1} /></Field>
            <Field label="No-show fee"><Input type="number" step="0.01" name="no_show_fee_amount" defaultValue={Number(p?.no_show_fee_amount ?? 0)} /></Field>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Cancellation policy shown to guests</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="English"><Textarea name="cancellation_policy_en" rows={3} defaultValue={cp.en ?? ""} /></Field>
            <Field label="ไทย"><Textarea name="cancellation_policy_th" rows={3} defaultValue={cp.th ?? ""} /></Field>
            <Field label="日本語"><Textarea name="cancellation_policy_ja" rows={3} defaultValue={cp.ja ?? ""} /></Field>
          </div>
        </div>
        {!readOnly ? <Button type="submit">{pending ? "Saving…" : "Save booking rules"}</Button> : null}
      </fieldset>
    </form>
  );
}
