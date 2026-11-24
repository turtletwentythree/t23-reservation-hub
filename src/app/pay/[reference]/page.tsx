import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Clock3, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { manageToken, verifyManageToken } from "@/lib/tokens";
import { DATE_LOCALES, DICTIONARIES, resolveLocale } from "@/lib/i18n/dictionaries";
import { bookingGateway } from "@/lib/integrations/payments/registry";
import { formatMoney } from "@/lib/utils";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay for your reservation", robots: { index: false } };

/**
 * Step 3 of online booking: the guest pays the deposit / prepayment while the table is held.
 * Paid → the manage page. Hold ran out → a "book again" message.
 */
export default async function PayPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; lang?: string; check?: string }> }) {
  const { reference } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: found } = await admin.from("reservations").select("id, restaurant_id").eq("reference", decodeURIComponent(reference)).maybeSingle();
  const valid = Boolean(found && verifyManageToken(found.id, sp.t));
  if (valid) await admin.rpc("release_expired_payment_holds", { p_restaurant_id: found!.restaurant_id });
  const { data: r } = valid
    ? await admin
        .from("reservations")
        .select("id, reference, restaurant_id, customer_name, reservation_date, reservation_time, party_size, status, language, deposit_amount, payment_status, payment_due_at, restaurants(name, slug, currency)")
        .eq("id", found!.id)
        .single()
    : { data: null };
  const locale = resolveLocale(sp.lang ?? r?.language, (await headers()).get("accept-language"));
  const t = DICTIONARIES[locale];

  if (!r) {
    return <div className="mx-auto max-w-md p-10 text-center"><XCircle className="mx-auto size-10 text-red-500" /><p className="mt-3 font-medium">{t.invalidLink}</p></div>;
  }
  const manage = `/reservation/${encodeURIComponent(r.reference)}?t=${manageToken(r.id)}`;
  if (r.payment_status === "paid" || r.payment_status === "waived") redirect(`${manage}&new=1&paid=1`);

  const gateway = bookingGateway();
  if (r.status === "cancelled") {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white px-4 py-8">
        <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-white p-6 text-center shadow-sm">
          <Clock3 className="mx-auto size-12 text-amber-500" />
          <h1 className="text-lg font-semibold">{t.payExpiredTitle}</h1>
          <p className="text-sm text-muted">{t.payExpiredNote}</p>
          {r.restaurants?.slug ? <a href={`/book/${r.restaurants.slug}?lang=${locale}`} className="inline-block rounded-xl bg-brand-500 px-5 py-2.5 font-medium text-white">{t.bookAgain}</a> : null}
        </div>
      </div>
    );
  }
  // No gateway, or a booking staff handle by hand: the manage page explains what happens next.
  if (!gateway || !r.payment_due_at || !(Number(r.deposit_amount) > 0)) redirect(manage);

  const { data: pol } = await admin.from("booking_policies").select("deposit_type").eq("restaurant_id", r.restaurant_id).maybeSingle();
  const currency = r.restaurants?.currency ?? "THB";
  const dateLabel = new Date(r.reservation_date + "T00:00:00Z").toLocaleDateString(DATE_LOCALES[locale], { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const testMode = gateway.name === "simulator" || (process.env.OMISE_SECRET_KEY ?? "").startsWith("skey_test_") || (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-lg space-y-4 md:max-w-4xl">
        <ol className="flex gap-2 text-xs font-medium md:max-w-xl">
          {[t.stepWhen, t.stepDetails, t.stepPay].map((s, i) => (
            <li key={s} className={`flex-1 rounded-full px-3 py-1.5 text-center ${i === 2 ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-800"}`}>{i + 1}. {s}</li>
          ))}
        </ol>
        <div className="grid gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 md:gap-8 md:p-6">
          <div className="min-w-0 space-y-4 md:sticky md:top-6 md:self-start">
          <h1 className="text-lg font-semibold">{t.payTitle}</h1>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="font-semibold text-brand-800">{r.restaurants?.name}</p>
            <p>{dateLabel} · {r.reservation_time.slice(0, 5)} · {r.party_size} {r.party_size === 1 ? t.guest : t.guestsPlural}</p>
            <p>{r.customer_name} · {t.reference} <span className="font-mono font-semibold">{r.reference}</span></p>
            <p className="mt-2 flex items-baseline justify-between border-t border-brand-200 pt-2">
              <span>{pol?.deposit_type === "full_prepayment" ? t.payAmountPrepayment : t.payAmountDeposit}</span>
              <span className="text-xl font-semibold text-accent-700">{formatMoney(Number(r.deposit_amount), currency)}</span>
            </p>
          </div>
          {testMode ? <p className="rounded-lg bg-amber-50 p-2 text-center text-xs font-medium text-amber-800">{t.payTestMode}</p> : null}
          </div>
          <div className="min-w-0 space-y-4 md:border-l md:pl-8">
          <PaymentForm
            reference={r.reference}
            token={sp.t!}
            locale={locale}
            dueAt={r.payment_due_at}
            methods={gateway.methods()}
            omisePublicKey={gateway.name === "omise" ? process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY ?? null : null}
            checkOnLoad={sp.check === "1"}
            lastFailed={r.payment_status === "failed"}
          />
          <p className="text-center text-[11px] text-muted">{t.paySecure}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
