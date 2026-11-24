import { privacyNotice } from "@/lib/privacy-notice";

export const metadata = { title: "Privacy Notice" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const n = privacyNotice(lang ?? "en");
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <h1 className="text-2xl font-semibold">{n.title}</h1>
      <p className="mt-1 text-sm text-muted">{n.meta}</p>
      <div className="mt-6 space-y-5">
        {n.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-base font-semibold">{s.h}</h2>
            {Array.isArray(s.body) ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{s.body.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : (
              <p className="mt-1 text-sm text-slate-700">{s.body}</p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
