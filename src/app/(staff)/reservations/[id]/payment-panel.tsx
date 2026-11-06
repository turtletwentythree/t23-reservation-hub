"use client";
import { useT } from "@/components/staff-locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { createPaymentLinkAction, recordPaymentAction, recordRefundAction } from "@/app/(staff)/payments/actions";

type Payment = {
  id: string;
  kind: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  checkout_url: string | null;
  refunds: { id: string; amount: number; status: string; reason: string | null }[];
};

export function PaymentPanel({ reservationId, currency, deposit, payments, canRecord, canRefund, gateways }: {
  reservationId: string;
  currency: string;
  deposit: number;
  payments: Payment[];
  canRecord: boolean;
  canRefund: boolean;
  gateways: { name: string; configured: boolean }[];
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ kind: "deposit", provider: "manual_transfer", amount: deposit || 0, note: "" });

  const paid = payments.filter((p) => p.status === "succeeded").reduce((a, p) => a + Number(p.amount), 0);
  const refunded = payments.flatMap((p) => p.refunds).filter((r) => r.status === "succeeded").reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-muted">{t("Required")}</p><p className="font-semibold">{formatMoney(deposit, currency)}</p></div>
        <div className="rounded-lg bg-brand-50 p-2"><p className="text-xs text-muted">{t("Paid")}</p><p className="font-semibold text-brand-700">{formatMoney(paid, currency)}</p></div>
        <div className="rounded-lg bg-accent-50 p-2"><p className="text-xs text-muted">{t("Refunded")}</p><p className="font-semibold text-accent-700">{formatMoney(refunded, currency)}</p></div>
      </div>

      {payments.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="space-y-1 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">{p.kind.replace("_", " ")} · {formatMoney(p.amount, p.currency)}</span>
                <Badge tone={p.status === "succeeded" ? "green" : p.status === "failed" ? "red" : "yellow"}>{p.status}</Badge>
              </div>
              <p className="text-xs text-muted">{p.provider}{p.paid_at ? ` · ${new Date(p.paid_at).toLocaleString()}` : ""}</p>
              {p.checkout_url && p.status === "pending" ? (
                <p className="truncate text-xs"><a className="text-brand-700 underline" href={p.checkout_url} target="_blank" rel="noreferrer">{t("Payment link")}</a></p>
              ) : null}
              {p.refunds.map((r) => (
                <p key={r.id} className="text-xs text-accent-700">↩ Refund {formatMoney(r.amount, p.currency)} · {r.status}{r.reason ? ` · ${r.reason}` : ""}</p>
              ))}
              {canRefund && p.status === "succeeded" ? (
                <button
                  className="text-xs font-medium text-accent-700 hover:underline"
                  disabled={pending}
                  onClick={() => {
                    const amt = window.prompt(`Refund amount (max ${p.amount})`, String(p.amount));
                    if (!amt) return;
                    const reason = window.prompt(t("Reason")) ?? "";
                    start(async () => {
                      const res = await recordRefundAction({ payment_id: p.id, amount: Number(amt), reason });
                      if (res.ok) { toast.success(res.data.message); router.refresh(); } else toast.error(t(res.error));
                    });
                  }}
                >
                  {t("Refund")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("No payments recorded.")}</p>
      )}

      {canRecord ? (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("Record payment / send payment link")}</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label={t("Type")}>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="deposit">{t("Deposit")}</option>
                <option value="prepayment">{t("Full prepayment")}</option>
                <option value="no_show_fee">{t("No-show fee")}</option>
                <option value="cancellation_fee">{t("Cancellation fee")}</option>
              </Select>
            </Field>
            <Field label={`Amount (${currency})`}>
              <Input type="number" min={1} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </Field>
            <Field label={t("Method")} className="col-span-2">
              <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="manual_transfer">{t("Bank transfer (received)")}</option>
                <option value="manual_cash">{t("Cash (received)")}</option>
                <option value="manual_card_terminal">{t("Card terminal (received)")}</option>
                {gateways.map((g) => (
                  <option key={g.name} value={g.name} disabled={!g.configured}>
                    {t("Online link via")} {g.name}{g.configured ? "" : ` (${t("not configured")})`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Note")} className="col-span-2">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("Transfer slip ref, etc. (never card numbers)")} />
            </Field>
          </div>
          <Button
            className="mt-3 w-full"
            size="sm"
            disabled={pending || form.amount <= 0}
            onClick={() =>
              start(async () => {
                const isGateway = !form.provider.startsWith("manual_");
                const res = isGateway
                  ? await createPaymentLinkAction({ reservation_id: reservationId, kind: form.kind, amount: form.amount, provider: form.provider })
                  : await recordPaymentAction({ reservation_id: reservationId, ...form });
                if (res.ok) { toast.success(isGateway ? t("Payment link created") : t("Payment recorded")); router.refresh(); } else toast.error(t(res.error));
              })
            }
          >
            {form.provider.startsWith("manual_") ? t("Record received payment") : t("Create payment link")}
          </Button>
        </details>
      ) : null}
    </div>
  );
}
