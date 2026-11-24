"use client";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Clock, Users, ChevronLeft, ChevronRight, Minus, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn, formatMoney } from "@/lib/utils";
import { DATE_LOCALES, DICTIONARIES, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { computeDeposit, prepaymentBreakdown, type DepositRule } from "@/lib/domain/deposit";
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
  deposit: DepositRule;
  /** The guest must answer the dietary / allergy question. */
  dietaryRequired: boolean;
  /** Minutes the table is held while the guest pays; null when online payment is not set up. */
  paymentHoldMinutes: number | null;
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

type Fmt = (d: string, opts: Intl.DateTimeFormatOptions) => string;

/** Full month grid (Monday first) with month navigation, limited to [min, max]. */
function MonthCalendar({ value, onChange, min, max, fmt }: { value: string; onChange: (d: string) => void; min: string; max: string; fmt: Fmt }) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const shift = (n: number) => setMonth(addDays(`${month}-15`, n * 30).slice(0, 7));
  const canPrev = month > min.slice(0, 7);
  const canNext = month < max.slice(0, 7);
  // 2024-01-01 is a Monday; used only to label weekday headers.
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays("2024-01-01", i), { weekday: "short" }));
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg border disabled:opacity-30"><ChevronLeft className="size-4" /></button>
        <span className="text-sm font-semibold">{fmt(first, { month: "long", year: "numeric" })}</span>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label="Next month" className="grid size-8 place-items-center rounded-lg border disabled:opacity-30"><ChevronRight className="size-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => <span key={w} className="py-1 text-[11px] font-medium uppercase text-muted">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const disabled = d < min || d > max;
          return (
            <button key={d} type="button" disabled={disabled} onClick={() => onChange(d)}
              className={cn("aspect-square rounded-lg text-sm", value === d ? "bg-brand-500 font-semibold text-white" : disabled ? "text-gray-300" : "hover:bg-brand-50", d === min && value !== d && "ring-1 ring-brand-300")}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingWizard(p: Props) {
  const [locale, setLocale] = useState<Locale>(p.initialLocale);
  const t = DICTIONARIES[locale];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState(p.today);
  const [party, setPartyValue] = useState(Math.min(p.maxParty, Math.max(2, p.minParty)));
  const [partyText, setPartyText] = useState(String(party));
  const setParty = (n: number) => {
    setPartyValue(n);
    setPartyText(String(n));
  };
  const [typeId, setTypeId] = useState(p.bookingTypes[0]?.id ?? "");
  const [time, setTime] = useState("");
  const [times, setTimes] = useState<string[] | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", special_occasion: "", dietary_requirements: "", allergies: "", guest_notes: "", accept_policy: false, accept_privacy_notice: false, health_data_consent: false, dietary_none: false, marketing_consent: false, marketing_channels: ["email"] as ("email" | "sms" | "line")[], website: "" });
  const hasDietary = Boolean(form.dietary_requirements.trim() || form.allergies.trim());

  const selectedType = p.bookingTypes.find((b) => b.id === typeId);
  const depositAmount = computeDeposit(p.deposit, party, selectedType?.deposit_override, selectedType?.price);
  const breakdown = prepaymentBreakdown(p.deposit, party, selectedType?.deposit_override, selectedType?.price);
  const money = (n: number) => formatMoney(n, p.currency);
  const [purpose, setPurpose] = useState("");
  const paysOnline = depositAmount > 0 && p.paymentHoldMinutes != null;

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
    if (form.marketing_consent && form.marketing_channels.length === 0) { setError(t.channelMissing); return; }
    startSubmit(async () => {
      const res = await publicBookAction({ ...form, health_data_consent: hasDietary && form.health_data_consent, dietary_none: !hasDietary && form.dietary_none, marketing_channels: form.marketing_consent ? form.marketing_channels : [], restaurant_slug: p.slug, reservation_date: date, reservation_time: time, party_size: party, booking_type_id: typeId || undefined, language: locale });
      if (!res.ok) { setError(res.error); return; }
      window.location.href = res.data.redirect;
    });
  };

  return (
    <div className={cn("mx-auto w-full max-w-lg md:max-w-4xl", p.embed ? "p-3" : "px-4 py-6 md:px-6 md:py-10")}>
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

      <ol className="mb-3 flex gap-1.5 text-[11px] font-medium sm:gap-2 sm:text-xs" aria-label="Steps">
        {[t.stepWhen, t.stepDetails, t.stepReview, ...(paysOnline ? [t.stepPay] : [])].map((label, i) => (
          <li key={label} className={cn("flex-1 rounded-full px-3 py-1.5 text-center", i + 1 === step ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-800")}>{i + 1}. {label}</li>
        ))}
      </ol>
      {step === 1 ? (
        <div className="grid gap-5 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 md:gap-8 md:p-6">
          <div className="min-w-0 space-y-5">
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Users className="size-4 text-brand-600" /> {t.guests}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="−"
                disabled={party <= p.minParty}
                onClick={() => setParty(Math.max(p.minParty, party - 1))}
                className="flex size-12 items-center justify-center rounded-xl border bg-white text-brand-700 hover:border-brand-400 disabled:opacity-30"
              >
                <Minus className="size-5" />
              </button>
              <label className="flex flex-1 items-baseline justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 py-2">
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={t.guests}
                  min={p.minParty}
                  max={p.maxParty}
                  value={partyText}
                  onChange={(e) => {
                    setPartyText(e.target.value);
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= p.minParty && n <= p.maxParty) setParty(n);
                  }}
                  onBlur={() => setPartyText(String(party))}
                  style={{ width: `${Math.max(1, partyText.length) + 0.6}ch` }}
                  className="bg-transparent text-center text-3xl font-semibold tabular-nums text-brand-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-sm text-slate-600">{party === 1 ? t.guest : t.guestsPlural}</span>
              </label>
              <button
                type="button"
                aria-label="+"
                disabled={party >= p.maxParty}
                onClick={() => setParty(Math.min(p.maxParty, party + 1))}
                className="flex size-12 items-center justify-center rounded-xl border bg-white text-brand-700 hover:border-brand-400 disabled:opacity-30"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">{t.maxParty.replace("{n}", String(p.maxParty))} {t.largeParty}</p>
          </section>
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="size-4 text-brand-600" /> {t.date}</p>
            <MonthCalendar value={date} onChange={setDate} min={p.today} max={p.maxDate} fmt={fmtDate} />
            <p className="mt-2 text-sm text-muted">{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </section>
          </div>
          <div className="min-w-0 space-y-5 md:border-l md:pl-8">
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
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{reason === "closed" ? t.closed : reason === "fully_booked" ? t.fullyBooked : error ?? t.noTimes}</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
                {(times ?? []).map((x) => (
                  <button key={x} type="button" onClick={() => setTime(x)} className={cn("rounded-xl border py-2.5 text-sm font-medium tabular-nums", time === x ? "border-accent-500 bg-accent-500 text-white" : "bg-white hover:border-accent-300")}>{x}</button>
                ))}
              </div>
            )}
          </section>
          <Button size="lg" className="w-full" disabled={!time} onClick={() => setStep(2)}>{t.next}</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8 md:p-6">
          <div className="min-w-0 space-y-4 md:sticky md:top-6 md:self-start">
          <button type="button" onClick={() => setStep(step === 3 ? 2 : 1)} className="flex items-center gap-1 text-sm text-muted"><ChevronLeft className="size-4" /> {t.back}</button>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-brand-800">{t.summary}</p>
              <button type="button" onClick={() => setStep(1)} className="shrink-0 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800">{t.changeDateTime}</button>
            </div>
            <p>{fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {time} · {party} {party === 1 ? t.guest : t.guestsPlural}</p>
            {selectedType && p.bookingTypes.length > 1 ? <p>{selectedType.name[locale] || selectedType.name.en}</p> : null}
            {depositAmount > 0 ? <p className="mt-1 font-medium text-accent-700">{p.deposit.type === "full_prepayment" ? t.payAmountPrepayment : t.deposit}: {formatMoney(depositAmount, p.currency)}</p> : null}
            {paysOnline ? <p className="mt-1 text-xs text-slate-600">{t.payHoldNote.replace("{n}", String(p.paymentHoldMinutes))}</p> : null}
          </div>
          </div>
          {step === 2 ? (
          <form onSubmit={(e) => { e.preventDefault(); if (hasDietary && !form.health_data_consent) { setError(t.healthMissing); return; } if (p.dietaryRequired && !hasDietary && !form.dietary_none) { setError(t.dietaryMissing); return; } setError(null); setStep(3); window.scrollTo({ top: 0 }); }} className="min-w-0 space-y-4 md:border-l md:pl-8">
          <p className="text-sm font-semibold">{t.yourDetails}</p>
          <Field label={<>{t.fullName} <Req t={t} /></>}><Input required minLength={2} maxLength={120} autoComplete="name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={<>{t.phone} <Req t={t} /></>}><Input required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label={<>{t.email} <Req t={t} /></>}><Input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label={t.purpose}>
            <Select value={purpose} onChange={(e) => { setPurpose(e.target.value); setForm({ ...form, special_occasion: e.target.value ? DICTIONARIES.en.purposes[e.target.value as keyof typeof t.purposes] : "" }); }}>
              <option value="">{t.purposePh}</option>
              {Object.entries(t.purposes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <fieldset className="space-y-2 rounded-xl border p-3" aria-describedby="dietary-q">
            <p id="dietary-q" className="text-sm font-medium text-slate-800">{t.dietaryQuestion} {p.dietaryRequired ? <Req t={t} /> : null}</p>
            <p className="text-xs text-muted">{p.dietaryRequired ? t.dietaryRequiredHint : t.dietaryNone}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.dietary}><Input value={form.dietary_requirements} onChange={(e) => setForm({ ...form, dietary_requirements: e.target.value })} /></Field>
              <Field label={t.allergies}><Input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></Field>
            </div>
            {hasDietary ? (
              <div className="space-y-1 rounded-lg bg-slate-50 p-2.5">
                <label className="flex items-start gap-2 text-sm text-slate-800"><input type="checkbox" className="mt-1" required checked={form.health_data_consent} onChange={(e) => setForm({ ...form, health_data_consent: e.target.checked })} /> <span>{t.healthConsent} <Req t={t} /></span></label>
                <p className="pl-6 text-xs text-muted">{t.healthConsentHint}</p>
              </div>
            ) : p.dietaryRequired ? (
              <label className="flex items-start gap-2 text-sm text-slate-800"><input type="checkbox" className="mt-1" checked={form.dietary_none} onChange={(e) => setForm({ ...form, dietary_none: e.target.checked })} /> {t.dietaryNoneBox}</label>
            ) : null}
          </fieldset>
          <Field label={t.requests}><Textarea rows={2} maxLength={1000} value={form.guest_notes} onChange={(e) => setForm({ ...form, guest_notes: e.target.value })} /></Field>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
          <Button size="lg" className="w-full">{t.reviewNext}</Button>
          </form>
          ) : (
          <form onSubmit={submit} className="min-w-0 space-y-4 md:border-l md:pl-8">
          <p className="text-base font-semibold">{t.reviewTitle}</p>
          <section className="rounded-xl border p-3 text-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800">{t.reservationDetails}</p>
              <button type="button" onClick={() => setStep(1)} className="rounded-md border px-2 py-0.5 text-xs font-medium text-slate-700">{t.changeDateTime}</button>
            </div>
            <ul className="grid gap-1.5 text-slate-700 sm:grid-cols-2">
              <li className="flex items-center gap-2"><Store className="size-4 text-muted" /> {p.name}</li>
              <li className="flex items-center gap-2"><Users className="size-4 text-muted" /> {party} {party === 1 ? t.guest : t.guestsPlural}</li>
              <li className="flex items-center gap-2"><CalendarDays className="size-4 text-muted" /> {fmtDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</li>
              <li className="flex items-center gap-2"><Clock className="size-4 text-muted" /> {time}</li>
            </ul>
          </section>
          <section className="rounded-xl border p-3 text-sm">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800">{t.guestLabel}</p>
              <button type="button" onClick={() => setStep(2)} className="rounded-md border px-2 py-0.5 text-xs font-medium text-slate-700">{t.edit}</button>
            </div>
            <p>{form.customer_name}</p>
            <p className="text-slate-600">{form.phone} · {form.email}</p>
            {[purpose && `${t.purpose}: ${t.purposes[purpose as keyof typeof t.purposes]}`, form.dietary_requirements && `${t.dietary}: ${form.dietary_requirements}`, form.allergies && `${t.allergies}: ${form.allergies}`, form.guest_notes && `${t.notesLabel}: ${form.guest_notes}`].filter(Boolean).map((line) => <p key={line as string} className="text-slate-600">{line}</p>)}
          </section>
          {depositAmount > 0 ? (
            <section className="rounded-xl border p-3 text-sm">
              <p className="mb-2 font-semibold text-slate-800">{t.yourExperience}</p>
              {breakdown && selectedType ? (
                <>
                  <p className="flex justify-between gap-3"><span><span className="text-muted">{party} ×</span> {selectedType.name[locale] || selectedType.name.en}</span><span className="font-medium">{money(breakdown.subtotal)}</span></p>
                  <div className="mt-2 space-y-0.5 border-t pt-2 text-slate-600">
                    <p className="flex justify-between"><span>{t.subtotal}</span><span>{money(breakdown.subtotal)}</span></p>
                    {breakdown.serviceCharge > 0 ? <p className="flex justify-between"><span>{t.serviceCharge} ({p.deposit.serviceChargePct}%)</span><span>{money(breakdown.serviceCharge)}</span></p> : null}
                    {breakdown.vat > 0 ? <p className="flex justify-between"><span>{t.vat} ({p.deposit.vatPct}%)</span><span>{money(breakdown.vat)}</span></p> : null}
                  </div>
                </>
              ) : (
                <p className="flex justify-between gap-3"><span>{selectedType && p.bookingTypes.length > 1 ? `${selectedType.name[locale] || selectedType.name.en} · ` : ""}{p.deposit.type === "full_prepayment" ? t.payAmountPrepayment : t.payAmountDeposit}</span><span className="font-medium">{money(depositAmount)}</span></p>
              )}
              <p className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><span>{t.total}</span><span>{money(depositAmount)}</span></p>
              {paysOnline ? <p className="mt-2 text-xs text-slate-600">{t.chargeNote.replace("{amount}", money(depositAmount))}</p> : null}
            </section>
          ) : null}
          {p.termsText[locale] || p.termsText.en ? (
            <section className="rounded-xl border p-3 text-xs text-slate-600">
              <p className="mb-1 text-sm font-semibold text-slate-800">{t.importantInfo}</p>
              <p className="whitespace-pre-line">{p.termsText[locale] || p.termsText.en}</p>
            </section>
          ) : null}
          <section className="space-y-2 rounded-xl border p-3 text-xs text-slate-600">
            <p className="text-sm font-semibold text-slate-800">{t.cancellationTitle}</p>
            {p.policyText[locale] || p.policyText.en ? <p className="whitespace-pre-line">{p.policyText[locale] || p.policyText.en}</p> : null}
            <p>{t.agreeAll}</p>
            <label className="flex items-start gap-2 pt-1 text-sm text-slate-800"><input type="checkbox" className="mt-1" required checked={form.accept_policy} onChange={(e) => setForm({ ...form, accept_policy: e.target.checked })} /> <span>{t.agreeCancellation} <Req t={t} /></span></label>
          </section>
          <section className="space-y-3 rounded-xl border p-3 text-sm">
            <p className="font-semibold text-slate-800">{t.privacyTitle}</p>
            <label className="flex items-start gap-2 text-slate-800"><input type="checkbox" className="mt-1" required checked={form.accept_privacy_notice} onChange={(e) => setForm({ ...form, accept_privacy_notice: e.target.checked })} /> <span>{t.privacyAck} <a href={`/privacy?lang=${locale}`} target="_blank" rel="noopener" className="font-medium text-brand-700 underline">{t.privacyLink}</a> <Req t={t} /></span></label>
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-start gap-2 text-slate-800"><input type="checkbox" className="mt-1" checked={form.marketing_consent} onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })} /> <span>{t.marketingVenue.replace("{name}", p.name)} <span className="text-xs text-muted">({t.optional})</span></span></label>
              {form.marketing_consent ? (
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-sm">
                  <legend className="sr-only">{t.marketingChannels}</legend>
                  <span className="text-xs text-muted">{t.marketingChannels}:</span>
                  {(["email", "sms", "line"] as const).map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5"><input type="checkbox" checked={form.marketing_channels.includes(ch)} onChange={(e) => setForm({ ...form, marketing_channels: e.target.checked ? [...form.marketing_channels, ch] : form.marketing_channels.filter((c) => c !== ch) })} /> {ch === "email" ? t.channelEmail : ch.toUpperCase()}</label>
                  ))}
                </fieldset>
              ) : null}
            </div>
            <p className="text-xs text-muted">{t.contractNote}</p>
          </section>
          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
          <Button size="lg" variant="accent" className="w-full" disabled={submitting || !form.accept_policy || !form.accept_privacy_notice}>{submitting ? t.confirming : paysOnline ? t.payAmountBtn.replace("{amount}", money(depositAmount)) : t.confirm}</Button>
          </form>
          )}
        </div>
      )}
      {!p.embed ? <div className="mt-8 flex flex-col items-center gap-1"><Image src="/turtle23-logo.png" width={956} height={114} alt="Turtle 23 Company Limited" className="h-5 w-auto opacity-80" /><p className="text-[11px] text-muted">T23 Reservation Hub</p></div> : null}
    </div>
  );
}

function Req({ t }: { t: { required: string } }) {
  return <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-red-700">{t.required}</span>;
}
