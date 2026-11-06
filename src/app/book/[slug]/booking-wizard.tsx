"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Clock, Users, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import { DATE_LOCALES, DICTIONARIES, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { getPublicSlotsAction, publicBookAction } from "../actions";

type BookingType = { id: string; name: Record<string, string>; description: Record<string, string> | null; price: number | null; deposit_override: number | null };
type Props = {
  slug: string;
  name: string;
  cuisine: string | null;
  currency: string;
  today: string;
  maxDate: string;
  minParty: number;
  maxParty: number;
  deposit: { type: string; amount: number; minParty: number };
  policyText: Record<string, string>;
  termsText: Record<string, string>;
  bookingTypes: BookingType[];
  initialLocale: Locale;
  embed: boolean;
};

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function BookingWizard(p: Props) {
  const [locale, setLocale] = useState<Locale>(p.initialLocale);
  const t = DICTIONARIES[locale];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState(p.today);
  const [party, setParty] = useState(Math.max(2, p.minParty));
  const [typeId, setTypeId] = useState(p.bookingTypes[0]?.id ?? "");
  const [time, setTime] = useState("");
  const [times, setTimes] = useState<string[] | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", special_occasion: "", dietary_requirements: "", allergies: "", guest_notes: "", accept_policy: false, marketing_consent: false, website: "" });

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(p.today, i)).filter((d) => d <= p.maxDate), [p.today, p.maxDate]);
  const selectedType = p.bookingTypes.find((b) => b.id === typeId);
  const depositAmount = selectedType?.deposit_override != null
    ? selectedType.deposit_override * party
    : p.deposit.type === "none" || party < p.deposit.minParty ? 0 : p.deposit.type === "per_person" ? p.deposit.amount * party : p.deposit.amount;

  useEffect(() => {
    setTime("");
    startLoad(async () => {
      const res = await getPublicSlotsAction({ slug: p.slug, date, partySize: party, bookingTypeId: typeId || undefined });
      if (res.ok) { setTimes(res.data.times); setReason(res.data.reason); setError(null); } else { setTimes([]); setError(res.error); }
    });
  }, [date, party, typeId, p.slug]);

  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + "T00:00:00Z").toLocaleDateString(DATE_LOCALES[locale], { timeZone: "UTC", ...opts });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startSubmit(async () => {
      const res = await publicBookAction({ ...form, restaurant_slug: p.slug, reservation_date: date, reservation_time: time, party_size: party, booking_type_id: typeId || undefined, language: locale });
      if (!res.ok) { setError(res.error); return; }
      window.location.href = res.data.redirect;
    });
  };

  return (
    <div className={cn("mx-auto w-full max-w-lg", p.embed ? "p-3" : "px-4 py-6")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{t.bookTable}</p>
          <h1 className="text-2xl font-semibold text-slate-900">{p.name}</h1>
          {p.cuisine ? <p className="text-sm text-muted">{p.cuisine}</p> : null}
        </div>
        <div className="flex rounded-lg border bg-white p-0.5 text-xs">
          {LOCALES.map((l) => (
            <button key={l} type="button" onClick={() => setLocale(l)} className={cn("rounded-md px-2 py-1", locale === l ? "bg-brand-500 text-white" : "text-slate-600")} aria-label={LOCALE_NAMES[l]}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-5 rounded-2xl border bg-white p-4 shadow-sm">
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Users className="size-4 text-brand-600" /> {t.guests}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: p.maxParty - p.minParty + 1 }, (_, i) => p.minParty + i).map((n) => (
                <button key={n} type="button" onClick={() => setParty(n)} className={cn("size-11 rounded-xl border text-sm font-medium", party === n ? "border-brand-500 bg-brand-500 text-white" : "bg-white hover:border-brand-300")}>{n}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{t.maxParty.replace("{n}", String(p.maxParty))} {t.largeParty}</p>
          </section>
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="size-4 text-brand-600" /> {t.date}</p>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {days.map((d) => (
                <button key={d} type="button" onClick={() => setDate(d)} className={cn("flex w-14 shrink-0 flex-col items-center rounded-xl border py-2", date === d ? "border-brand-500 bg-brand-500 text-white" : "bg-white")}>
                  <span className="text-[11px] uppercase opacity-80">{fmtDate(d, { weekday: "short" })}</span>
                  <span className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</span>
                  <span className="text-[10px] opacity-80">{fmtDate(d, { month: "short" })}</span>
                </button>
              ))}
            </div>
            <Input type="date" className="mt-2 w-44" min={p.today} max={p.maxDate} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t.date} />
          </section>
          {p.bookingTypes.length > 1 ? (
            <section>
              <p className="mb-2 text-sm font-medium">{t.bookingType}</p>
              <div className="space-y-1.5">
                {p.bookingTypes.map((b) => (
                  <label key={b.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border p-3", typeId === b.id && "border-brand-500 bg-brand-50")}>
                    <span className="flex items-center gap-2"><input type="radio" name="bt" checked={typeId === b.id} onChange={() => setTypeId(b.id)} /> <span>{b.name[locale] || b.name.en}<span className="block text-xs text-muted">{b.description?.[locale] || b.description?.en}</span></span></span>
                    {b.price ? <span className="text-sm font-medium">{formatMoney(b.price, p.currency)}</span> : null}
                  </label>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Clock className="size-4 text-brand-600" /> {t.selectTime}</p>
            {loading ? <p className="text-sm text-muted">{t.loading}</p> : times && times.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{reason === "closed" ? t.closed : error ?? t.noTimes}</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                {(times ?? []).map((x) => (
                  <button key={x} type="button" onClick={() => setTime(x)} className={cn("rounded-xl border py-2.5 text-sm font-medium tabular-nums", time === x ? "border-accent-500 bg-accent-500 text-white" : "bg-white hover:border-accent-300")}>{x}</button>
                ))}
              </div>
            )}
          </section>
          <Button size="lg" className="w-full" disabled={!time} onClick={() => setStep(2)}>{t.next}</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted"><ChevronLeft className="size-4" /> {t.back}</button>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="font-semibold text-brand-800">{t.summary}</p>
            <p>{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {time} · {party} {party === 1 ? t.guest : t.guestsPlural}</p>
            {selectedType && p.bookingTypes.length > 1 ? <p>{selectedType.name[locale] || selectedType.name.en}</p> : null}
            {depositAmount > 0 ? <p className="mt-1 font-medium text-accent-700">{t.deposit}: {formatMoney(depositAmount, p.currency)}</p> : null}
          </div>
          <p className="text-sm font-semibold">{t.yourDetails}</p>
          <Field label={t.fullName}><Input required minLength={2} maxLength={120} autoComplete="name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.phone}><Input required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label={t.email}><Input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label={t.occasion}><Input placeholder={t.occasionPh} value={form.special_occasion} onChange={(e) => setForm({ ...form, special_occasion: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.dietary}><Input value={form.dietary_requirements} onChange={(e) => setForm({ ...form, dietary_requirements: e.target.value })} /></Field>
            <Field label={t.allergies}><Input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></Field>
          </div>
          <Field label={t.requests}><Textarea rows={2} maxLength={1000} value={form.guest_notes} onChange={(e) => setForm({ ...form, guest_notes: e.target.value })} /></Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
          <div className="rounded-xl border p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold text-slate-800">{t.policy}</p>
            <p>{p.policyText[locale] || p.policyText.en}</p>
            {p.termsText[locale] || p.termsText.en ? <p className="mt-1">{p.termsText[locale] || p.termsText.en}</p> : null}
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={form.accept_policy} onChange={(e) => setForm({ ...form, accept_policy: e.target.checked })} /> {t.acceptPolicy}</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={form.marketing_consent} onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })} /> {t.marketing}</label>
          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
          <Button size="lg" variant="accent" className="w-full" disabled={submitting || !form.accept_policy}>{submitting ? t.confirming : t.confirm}</Button>
        </form>
      )}
      {!p.embed ? <p className="mt-6 text-center text-xs text-muted">Turtle23 Restaurant Group · T23 Reservation Hub</p> : null}
    </div>
  );
}
