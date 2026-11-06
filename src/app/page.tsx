import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Public, non-sensitive fields only.
  const { data: restaurants } = await createAdminClient()
    .from("restaurants")
    .select("name, slug, cuisine, description")
    .eq("is_active", true)
    .eq("accepts_online_bookings", true)
    .order("name");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold text-brand-800">
          <Image src="/turtle23-mark.png" width={256} height={256} alt="Turtle 23" className="size-10" />
          Turtle23 Restaurants
        </div>
        <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline">Staff sign in</Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <h1 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">Reserve a table</h1>
        <p className="mt-2 text-slate-600">Choose a restaurant to see real-time availability. · เลือกร้านอาหาร · Choisissez un restaurant</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(restaurants ?? []).map((r) => (
            <Link key={r.slug} href={`/book/${r.slug}`} className="group rounded-2xl border bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-md">
              <p className="text-lg font-semibold text-slate-900 group-hover:text-brand-700">{r.name}</p>
              {r.cuisine ? <p className="mt-0.5 text-sm text-muted">{r.cuisine}</p> : null}
              <p className="mt-4 text-sm font-medium text-accent-600">Book now →</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
