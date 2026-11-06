import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLocale } from "@/lib/i18n/dictionaries";
import { addDays, todayIn } from "@/lib/data/common";
import { BookingWizard } from "./booking-wizard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await createAdminClient().from("restaurants").select("name").eq("slug", slug).maybeSingle();
  return { title: data ? `Book a table at ${data.name}` : "Book a table" };
}

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string; embed?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: r } = await admin.from("restaurants").select("id, name, slug, cuisine, timezone, currency, is_active, accepts_online_bookings").eq("slug", slug).maybeSingle();
  if (!r || !r.is_active) notFound();
  const [{ data: policy }, { data: types }] = await Promise.all([
    admin.from("booking_policies").select("*").eq("restaurant_id", r.id).maybeSingle(),
    admin.from("booking_types").select("id, name, description, price, deposit_override").eq("restaurant_id", r.id).eq("is_active", true).eq("is_online", true).order("sort_order"),
  ]);
  const locale = resolveLocale(sp.lang, (await headers()).get("accept-language"));
  const today = todayIn(r.timezone);
  const embed = sp.embed === "1";

  if (!r.accepts_online_bookings) {
    return <div className="mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-semibold">{r.name}</h1><p className="mt-2 text-muted">Online booking is currently unavailable. Please contact the restaurant.</p></div>;
  }
  return (
    <div className={embed ? "bg-transparent" : "min-h-dvh bg-gradient-to-b from-brand-50 to-white"}>
      <BookingWizard
        slug={r.slug}
        name={r.name}
        cuisine={r.cuisine}
        currency={r.currency}
        today={today}
        maxDate={addDays(today, policy?.max_advance_days ?? 60)}
        minParty={policy?.min_party_size ?? 1}
        maxParty={policy?.max_party_size ?? 8}
        deposit={{ type: policy?.deposit_type ?? "none", amount: Number(policy?.deposit_amount ?? 0), minParty: policy?.deposit_min_party_size ?? 1 }}
        policyText={(policy?.cancellation_policy as Record<string, string>) ?? {}}
        termsText={(policy?.booking_terms as Record<string, string>) ?? {}}
        bookingTypes={(types ?? []).map((t) => ({ id: t.id, name: t.name as Record<string, string>, description: t.description as Record<string, string> | null, price: t.price === null ? null : Number(t.price), deposit_override: t.deposit_override === null ? null : Number(t.deposit_override) }))}
        initialLocale={locale}
        embed={embed}
      />
    </div>
  );
}
