import { headers } from "next/headers";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyManageToken, manageUrl } from "@/lib/tokens";
import { DICTIONARIES, resolveLocale } from "@/lib/i18n/dictionaries";
import { QrCode } from "@/components/qr-code";
import { formatMoney } from "@/lib/utils";
import { GuestActions } from "./guest-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your reservation", robots: { index: false } };

export default async function GuestReservationPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string; lang?: string; new?: string; paid?: string }> }) {
  const { reference } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("reservations")
    .select("id, reference, restaurant_id, customer_name, reservation_date, reservation_time, starts_at, party_size, status, language, deposit_amount, payment_status, special_occasion, restaurants(name, slug, phone, currency), booking_types(name)")
    .eq("reference", decodeURIComponent(reference))
    .maybeSingle();
  const locale = resolveLocale(sp.lang ?? r?.language, (await headers()).get("accept-language"));
  const t = DICTIONARIES[locale];

  if (!r || !verifyManageToken(r.id, sp.t)) {
    return <div className="mx-auto max-w-md p-10 text-center"><XCircle className="mx-auto size-10 text-red-500" /><p className="mt-3 font-medium">{t.invalidLink}</p></div>;
  }
  const [{ data: policy }, { data: pending }] = await Promise.all([
    admin.from("booking_policies").select("cancellation_cutoff_hours, modification_cutoff_hours, max_party_size, cancellation_policy").eq("restaurant_id", r.restaurant_id).maybeSingle(),
    admin.from("payments").select("checkout_url").eq("reservation_id", r.id).eq("status", "pending").not("checkout_url", "is", null).limit(1).maybeSingle(),
  ]);
  const msLeft = new Date(r.starts_at).getTime() - Date.now();
  const open = ["pending", "confirmed"].includes(r.status);
  const canModify = open && msLeft > (policy?.modification_cutoff_hours ?? 24) * 3600_000;
  const canCancel = open && msLeft > (policy?.cancellation_cutoff_hours ?? 24) * 3600_000;
  const dateLabel = new Date(r.reservation_date + "T00:00:00Z").toLocaleDateString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const Icon = r.status === "cancelled" ? XCircle : r.status === "pending" ? Clock3 : CheckCircle2;
  const title = r.status === "cancelled" ? t.cancelledTitle : r.status === "pending" ? t.pendingTitle : t.confirmedTitle;
  const currency = r.restaurants?.currency ?? "THB";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white px-4 py-8">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-center">
          <Icon className={`mx-auto size-12 ${r.status === "cancelled" ? "text-red-500" : r.status === "pending" ? "text-amber-500" : "text-brand-500"}`} />
          <h1 className="mt-2 text-lg font-semibold">{title}</h1>
          {r.status === "pending" ? <p className="text-sm text-muted">{t.pendingNote}</p> : null}
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p className="text-lg font-semibold">{r.restaurants?.name}</p>
          <p>{dateLabel}</p>
          <p className="text-2xl font-semibold text-brand-700">{r.reservation_time.slice(0, 5)}</p>
          <p>{r.party_size} {r.party_size === 1 ? t.guest : t.guestsPlural} · {r.customer_name}</p>
          {r.booking_types ? <p>{(r.booking_types.name as Record<string, string>)[locale] ?? (r.booking_types.name as Record<string, string>).en}</p> : null}
          <p className="mt-2 text-xs text-muted">{t.reference}: <span className="font-mono font-semibold text-slate-800">{r.reference}</span> · {t.status}: {t.statuses[r.status]}</p>
        </div>
        {Number(r.deposit_amount) > 0 && r.status !== "cancelled" ? (
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm">
            <p className="font-medium">{t.deposit}: {formatMoney(r.deposit_amount, currency)} {r.payment_status === "paid" ? `· ${t.paid}` : ""}</p>
            {r.payment_status !== "paid" ? (pending?.checkout_url ? <a href={pending.checkout_url} className="mt-2 inline-block font-medium text-accent-700 underline">{t.payDeposit}</a> : <p className="text-xs text-slate-600">{t.depositPendingContact}</p>) : null}
          </div>
        ) : null}
        {r.status !== "cancelled" ? (
          <div className="text-center">
            <QrCode value={manageUrl(r.reference, r.id)} size={180} />
            <p className="mt-1 text-xs text-muted">{t.showQr}</p>
          </div>
        ) : null}
        <GuestActions reference={r.reference} token={sp.t!} reservationId={r.id} slug={r.restaurants?.slug ?? ""} locale={locale} date={r.reservation_date} time={r.reservation_time.slice(0, 5)} party={r.party_size} canModify={canModify} canCancel={canCancel} maxParty={policy?.max_party_size ?? 8} />
        {r.restaurants?.phone ? <p className="text-center text-xs text-muted">{r.restaurants.phone}</p> : null}
      </div>
    </div>
  );
}
