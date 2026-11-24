"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DICTIONARIES, type Locale } from "@/lib/i18n/dictionaries";
import type { PaymentMethod } from "@/lib/integrations/payments/types";
import { checkPaymentAction, simulatePaymentAction, startPaymentAction, type PaymentState } from "../actions";

type OmiseJs = {
  setPublicKey(key: string): void;
  createToken(type: "card", card: Record<string, string | number>, cb: (status: number, res: { id?: string; message?: string }) => void): void;
};
declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

type Props = {
  reference: string;
  token: string;
  locale: Locale;
  dueAt: string;
  methods: PaymentMethod[];
  omisePublicKey: string | null;
  checkOnLoad: boolean;
  lastFailed: boolean;
};

function useCountdown(dueAt: string) {
  const [left, setLeft] = useState(() => new Date(dueAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(dueAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [dueAt]);
  return Math.max(0, left);
}

export function PaymentForm(p: Props) {
  const t = DICTIONARIES[p.locale];
  const ids = { reference: p.reference, token: p.token };
  const left = useCountdown(p.dueAt);
  const [method, setMethod] = useState<PaymentMethod>(p.methods[0]);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(p.lastFailed ? t.payFailed : null);
  const [busy, start] = useTransition();
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const polling = useRef(false);

  const follow = useCallback((s: PaymentState) => {
    if (s.state === "paid" && s.redirect) window.location.href = s.redirect;
    else if (s.state === "expired") window.location.reload();
    else if (s.state === "failed") setError(t.payFailed);
  }, [t.payFailed]);

  // Time ran out: reload so the server shows the "book again" message.
  useEffect(() => {
    if (left === 0) window.location.reload();
  }, [left]);

  // Back from 3-D Secure / hosted checkout, or waiting on a QR: ask the gateway until it settles.
  useEffect(() => {
    if (!(p.checkOnLoad || qr) || polling.current) return;
    polling.current = true;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const res = await checkPaymentAction(ids);
      if (res.ok) {
        follow(res.data);
        if (res.data.state !== "pending") return;
      }
      setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stop = true;
      polling.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.checkOnLoad, qr]);

  const pay = (cardToken?: string) =>
    start(async () => {
      setError(null);
      const res = await startPaymentAction({ ...ids, method, cardToken });
      if (!res.ok) return setError(res.error);
      if (res.data.checkoutUrl) return void (window.location.href = res.data.checkoutUrl);
      if (res.data.authorizeUrl) return void (window.location.href = res.data.authorizeUrl);
      if (res.data.qrImageUrl) setQr(res.data.qrImageUrl);
      follow(res.data.state);
    });

  const payByCard = (e: React.FormEvent) => {
    e.preventDefault();
    const omise = window.Omise;
    if (!omise || !p.omisePublicKey) return setError(t.payFailed);
    const [mm, yy] = card.expiry.split("/").map((x) => x.trim());
    omise.setPublicKey(p.omisePublicKey);
    start(() =>
      new Promise<void>((done) => {
        // Card details go straight from the browser to Omise; we only receive the token.
        omise.createToken("card", { name: card.name, number: card.number.replace(/\s/g, ""), expiration_month: Number(mm), expiration_year: Number(yy?.length === 2 ? `20${yy}` : yy), security_code: card.cvc }, (status, res) => {
          if (status === 200 && res.id) pay(res.id);
          else setError(res.message ?? t.payFailed);
          done();
        });
      }),
    );
  };

  const simulate = (outcome: "succeeded" | "failed") =>
    start(async () => {
      setError(null);
      const started = await startPaymentAction({ ...ids, method: "simulator" });
      if (!started.ok) return setError(started.error);
      const res = await simulatePaymentAction({ ...ids, outcome });
      if (!res.ok) return setError(res.error);
      follow(res.data);
    });

  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const label: Record<PaymentMethod, string> = { promptpay: t.payPromptpay, card: t.payCard, checkout: t.payCheckout, simulator: "Simulator" };

  return (
    <div className="space-y-4">
      {p.methods.includes("card") && p.omisePublicKey ? <Script src="https://cdn.omise.co/omise.js" strategy="afterInteractive" /> : null}
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center text-sm">
        {t.payHold} <span className="font-semibold tabular-nums" suppressHydrationWarning>{mins}:{String(secs).padStart(2, "0")}</span>
      </p>

      {p.methods.length > 1 ? (
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {p.methods.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(null); }}
              className={cn("flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium", method === m ? "border-brand-500 bg-brand-50 text-brand-800" : "bg-white")}>
              {m === "card" ? <CreditCard className="size-4" /> : <QrCode className="size-4" />} {label[m]}
            </button>
          ))}
        </div>
      ) : null}

      {method === "promptpay" ? (
        qr ? (
          <div className="space-y-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="PromptPay QR" className="mx-auto w-64 max-w-full rounded-lg border bg-white p-2" />
            <p className="text-sm text-slate-600">{t.payScan}</p>
            <p className="text-xs text-muted">{t.payWaiting}</p>
          </div>
        ) : (
          <Button size="lg" variant="accent" className="w-full" disabled={busy} onClick={() => pay()}>{busy ? t.payProcessing : `${t.payNow} · ${t.payPromptpay}`}</Button>
        )
      ) : null}

      {method === "card" ? (
        <form onSubmit={payByCard} className="space-y-3">
          <Field label={t.payCardName}><Input required autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></Field>
          <Field label={t.payCardNumber}><Input required inputMode="numeric" autoComplete="cc-number" maxLength={23} value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.payCardExpiry}><Input required placeholder="MM/YY" autoComplete="cc-exp" maxLength={7} value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} /></Field>
            <Field label={t.payCardCvc}><Input required inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></Field>
          </div>
          <Button size="lg" variant="accent" className="w-full" disabled={busy}>{busy ? t.payProcessing : t.payNow}</Button>
        </form>
      ) : null}

      {method === "checkout" ? (
        <Button size="lg" variant="accent" className="w-full" disabled={busy} onClick={() => pay()}>{busy ? t.payProcessing : t.payCheckout}</Button>
      ) : null}

      {method === "simulator" ? (
        <div className="grid gap-2">
          <Button size="lg" variant="accent" disabled={busy} onClick={() => simulate("succeeded")}>{t.paySimSuccess}</Button>
          <Button size="lg" variant="outline" disabled={busy} onClick={() => simulate("failed")}>{t.paySimFail}</Button>
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
